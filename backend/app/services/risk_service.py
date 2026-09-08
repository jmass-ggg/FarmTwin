"""
Risk service for the Farm Risk Center.

Orchestrates farm ownership checks, snapshot loading, risk engine calls,
and action completion persistence for the /risks and /actions routes.

Requirements: 1.1, 1.2, 7.4, 7.5, 8.1
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from geoalchemy2.shape import to_shape
from sqlalchemy import desc, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import FarmValidationError, NotFoundError
from app.core.security import Principal
from app.domain.risk_engine import RiskResponse, assess_all
from app.domain.risk_rules import ACTION_RULES
from app.domain.snapshot_context import context_from_demonstration, context_for_risks
from app.core.config import Settings
from app.models.actions import ActionCompletion
from app.models.farm import Farm
from app.models.snapshot import AnalysisSnapshot
from app.repositories.farm import FarmRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _load_latest_snapshot(
    session: AsyncSession,
    farm_id: UUID,
    geometry_revision: int,
) -> AnalysisSnapshot | None:
    """Return the latest completed snapshot for the current geometry revision, or None."""
    result = await session.execute(
        select(AnalysisSnapshot)
        .where(
            AnalysisSnapshot.farm_id == farm_id,
            AnalysisSnapshot.geometry_revision == geometry_revision,
        )
        .order_by(desc(AnalysisSnapshot.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _load_action_completions(
    session: AsyncSession,
    farm_id: UUID,
) -> dict[str, ActionCompletion]:
    """Return a dict of action_id → ActionCompletion for this farm."""
    result = await session.execute(
        select(ActionCompletion).where(ActionCompletion.farm_id == farm_id)
    )
    rows = result.scalars().all()
    return {row.action_id: row for row in rows}


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

async def get_risks(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
) -> RiskResponse:
    """
    Load the farm, build a SnapshotContext, assess all 5 hazards, and overlay
    action completion status on each assessment's action list.

    1. Ownership check via FarmRepository (raises NotFoundError → 404).
    2. Load the latest AnalysisSnapshot or fall back to demonstration profile.
    3. Build SnapshotContext and call assess_all().
    4. Load ActionCompletion records for this farm.
    5. The returned RiskResponse contains action completion state embedded
       in each action's overlay (the API layer converts this to the response).

    Requirements: 1.1, 1.2, 8.1
    """
    # 1. Ownership-scoped farm fetch
    repo = FarmRepository(session, principal.user_id)
    farm: Farm = await repo.get_by_id(farm_id)

    centroid = to_shape(farm.current_geometry.centroid)

    # 2. Attempt to load the latest snapshot
    snapshot = await _load_latest_snapshot(
        session, farm.id, farm.current_geometry_revision
    )

    # 3. Build SnapshotContext
    if snapshot is not None:
        context = context_for_risks(snapshot)
        logger.debug(
            "Built snapshot context for risk assessment: farm=%s snapshot=%s data_mode=%s",
            farm_id,
            snapshot.id,
            snapshot.data_mode,
        )
    else:
        if Settings().data_mode.value != "demonstration":
            raise NotFoundError("No analysis snapshot available. Run farm analysis first.")
        # Explicit demonstration mode only
        context = context_from_demonstration(
            latitude=centroid.y,
            longitude=centroid.x,
            planting_month=datetime.now(timezone.utc).month,
        )
        logger.debug(
            "No snapshot for farm %s — using demonstration fallback for risk assessment.",
            farm_id,
        )

    # 4. Call the risk engine
    risk_response = assess_all(context, str(farm.id))

    return risk_response


async def complete_action(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    action_id: str,
) -> ActionCompletion:
    """
    Mark an action as complete for the given farm.

    1. Ownership check via FarmRepository.
    2. Validate action_id exists in ACTION_RULES.
    3. Upsert ActionCompletion record (idempotent — retains original timestamp).
    4. Return the completion record.

    Requirements: 7.4, 7.5
    """
    # 1. Ownership check
    repo = FarmRepository(session, principal.user_id)
    await repo.get_by_id(farm_id)  # raises NotFoundError → 404 if not found/not owned

    # 2. Validate action_id
    known_ids = {rule.id for rule in ACTION_RULES}
    if action_id not in known_ids:
        raise FarmValidationError(
            field="path.action_id",
            detail_code="INVALID_VALUE",
            message=f"Unknown action id: {action_id!r}",
        )

    # 3. Upsert — on conflict (farm_id, action_id) do nothing so the original
    #    completed_at timestamp is preserved (idempotent, Requirement 7.5).
    now = datetime.now(tz=timezone.utc)
    stmt = (
        pg_insert(ActionCompletion)
        .values(
            farm_id=farm_id,
            action_id=action_id,
            completed_at=now,
        )
        .on_conflict_do_nothing(
            constraint="uq_action_completions_farm_action",
        )
    )
    await session.execute(stmt)
    await session.flush()

    # 4. Retrieve the persisted record (may be the existing one)
    result = await session.execute(
        select(ActionCompletion).where(
            ActionCompletion.farm_id == farm_id,
            ActionCompletion.action_id == action_id,
        )
    )
    completion = result.scalar_one()

    await session.commit()
    return completion
