"""
FarmTwin analysis job worker.

Reads job IDs from the Redis queue (key: ``farmtwin:jobs``) and calls
``run_analysis_job`` for each one.  Processes one job at a time.

Retry policy: up to 2 retries with 30-second back-off.
Shutdown: handles SIGTERM by finishing the current job then exiting cleanly.

Uses a separate async SQLAlchemy session factory — does NOT share the API
process connection pool.

Usage::

    python -m app.worker

Requirements: 1.3, 1.5
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys
import uuid
from typing import NoReturn

import redis.asyncio as aioredis

from app.core.config import Settings
from app.core.database import create_engine, create_session_factory
from app.core.logging import configure_logging
from app.services.snapshot_service import REDIS_JOB_QUEUE_KEY, run_analysis_job

logger = logging.getLogger("farmtwin.worker")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 30
QUEUE_POLL_TIMEOUT_SECONDS = 5  # BLPOP block timeout; 0 = forever


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------


class Worker:
    """Pulls jobs from Redis and runs them one at a time.

    Designed for a single asyncio event loop.  SIGTERM sets
    ``_shutdown`` which prevents accepting new jobs after the current
    one finishes.

    Requirements: 1.3, 1.5
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._shutdown = False

    # ------------------------------------------------------------------
    # Signal handling
    # ------------------------------------------------------------------

    def _handle_sigterm(self, signum: int, frame) -> None:  # noqa: ANN001
        """Set the shutdown flag; the current job will finish normally."""
        logger.info("worker.sigterm: graceful shutdown requested.")
        self._shutdown = True

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        """Connect to Redis and process jobs until SIGTERM."""
        signal.signal(signal.SIGTERM, self._handle_sigterm)

        redis_url = getattr(self._settings, "redis_url", None) or "redis://localhost:6379"
        logger.info("worker.start: connecting to Redis at %s", redis_url)

        # Separate engine / session factory — does NOT share the API pool
        engine = create_engine(self._settings)
        session_factory = create_session_factory(engine)

        try:
            async with aioredis.from_url(redis_url) as redis_client:
                logger.info("worker.ready: waiting for jobs on '%s'.", REDIS_JOB_QUEUE_KEY)
                while not self._shutdown:
                    await self._poll_and_process(redis_client, session_factory)
        finally:
            await engine.dispose()
            logger.info("worker.stopped: database pool disposed.")

    # ------------------------------------------------------------------
    # Poll + process
    # ------------------------------------------------------------------

    async def _poll_and_process(
        self,
        redis_client: aioredis.Redis,
        session_factory,
    ) -> None:
        """Block on BLPOP for one job, then run it with retries."""
        try:
            item = await redis_client.blpop(
                REDIS_JOB_QUEUE_KEY, timeout=QUEUE_POLL_TIMEOUT_SECONDS
            )
        except Exception as exc:
            logger.warning("worker.redis_error: %s; retrying after 5 s.", exc)
            await asyncio.sleep(5)
            return

        if item is None:
            # Timeout — loop back and check _shutdown flag
            return

        _key, raw = item
        try:
            payload = json.loads(raw)
            job_id = uuid.UUID(payload["job_id"])
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.error("worker.bad_payload: %s (raw=%r)", exc, raw)
            return

        await self._run_with_retry(job_id, session_factory)

    async def _run_with_retry(
        self,
        job_id: uuid.UUID,
        session_factory,
    ) -> None:
        """Run a job; retry up to MAX_RETRIES times with back-off."""
        attempt = 0
        while True:
            attempt += 1
            logger.info(
                "worker.run: job=%s attempt=%d/%d",
                job_id,
                attempt,
                MAX_RETRIES + 1,
            )
            try:
                result = await run_analysis_job(job_id, self._settings, session_factory)
                if result is not None:
                    logger.info("worker.done: job=%s completed successfully.", job_id)
                else:
                    logger.error("worker.failed: job=%s returned None (failed).", job_id)
                return
            except Exception as exc:
                logger.exception("worker.error: job=%s attempt=%d: %s", job_id, attempt, exc)
                if attempt > MAX_RETRIES:
                    logger.error(
                        "worker.give_up: job=%s exhausted %d retries.", job_id, MAX_RETRIES
                    )
                    return
                logger.info(
                    "worker.retry: job=%s waiting %ds before retry %d.",
                    job_id,
                    RETRY_BACKOFF_SECONDS,
                    attempt + 1,
                )
                await asyncio.sleep(RETRY_BACKOFF_SECONDS)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> NoReturn:
    """Synchronous entry point for ``python -m app.worker``."""
    settings = Settings()
    configure_logging(settings)
    logger.info("worker.init: environment=%s data_mode=%s", settings.environment, settings.data_mode)
    worker = Worker(settings)
    asyncio.run(worker.run())
    sys.exit(0)


if __name__ == "__main__":
    main()
