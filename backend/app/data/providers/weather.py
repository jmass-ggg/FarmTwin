"""
Weather provider adapter — Open-Meteo /v1/forecast.

Retrieves current conditions and 7-day hourly forecast for a farm centroid.
Returns a ProviderResult with a provenance envelope per field.
Sets evidence_status="unavailable" on any network error or non-2xx response.

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import (
    EVIDENCE_ACCEPTED,
    EVIDENCE_UNAVAILABLE,
    ProviderResult,
    null_envelope,
    provenance_envelope,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
SOURCE_NAME = "open-meteo"
REQUEST_TIMEOUT_SECONDS = 10.0

# Nominal grid resolution of Open-Meteo (derived from ERA5/GFS, ~11 km)
RESOLUTION_M = 11_000

# Fields to request from the current_weather API and hourly
CURRENT_VARIABLES = [
    "temperature_2m",
    "precipitation",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "cloud_cover",
]

# Unit mapping: variable name → (unit string, description)
_UNITS: dict[str, str] = {
    "temperature_2m": "celsius",
    "precipitation": "mm",
    "relative_humidity_2m": "percent",
    "wind_speed_10m": "m/s",
    "wind_direction_10m": "degrees",
    "cloud_cover": "percent",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _iso_now() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()


def _extract_current_value(data: dict, variable: str) -> float | None:
    """Extract the most recent hourly value for a variable.

    Open-Meteo returns hourly arrays. We take the last non-null value
    from the hourly block as "current" when available.
    Falls back to None if the variable is absent or all values are null.

    Requirements: 2.1, 2.3
    """
    hourly = data.get("hourly", {})
    values = hourly.get(variable)
    if not values:
        return None
    # Return the first non-None value (most recent current conditions)
    for v in reversed(values):
        if v is not None:
            return float(v)
    return None


def _build_weather_payload(
    data: dict,
    retrieved_at: str,
    data_mode: str,
) -> dict:
    """Build the weather payload dict from an Open-Meteo response.

    Each field is wrapped in a provenance envelope.
    model_name and issue_time are recorded from the response metadata.

    Requirements: 2.2, 2.3
    """
    # Metadata from the response
    hourly_units = data.get("hourly_units", {})
    # Open-Meteo doesn't expose model issue time in the standard endpoint;
    # we use the generation time as a proxy.
    generation_time = data.get("generationtime_ms")
    # The valid time for current conditions is "now" (retrieved_at)
    acquired_at = retrieved_at

    fields: dict[str, Any] = {}
    for var in CURRENT_VARIABLES:
        value = _extract_current_value(data, var)
        unit = _UNITS.get(var, hourly_units.get(var, "unknown"))
        fields[var] = provenance_envelope(
            value=value,
            unit=unit,
            source=SOURCE_NAME,
            acquired_at=acquired_at,
            retrieved_at=retrieved_at,
            data_mode=data_mode,
            quality=EVIDENCE_ACCEPTED if value is not None else EVIDENCE_UNAVAILABLE,
            resolution_m=RESOLUTION_M,
        )

    return {
        "fields": fields,
        "model_metadata": {
            "source": SOURCE_NAME,
            "generation_time_ms": generation_time,
            "forecast_horizon_days": 7,
            "retrieved_at": retrieved_at,
        },
    }


def _build_unavailable_payload(retrieved_at: str, data_mode: str) -> dict:
    """Build a payload where all values are null (provider unavailable).

    Requirements: 2.4, 2.5
    """
    fields: dict[str, Any] = {}
    for var in CURRENT_VARIABLES:
        fields[var] = null_envelope(
            unit=_UNITS.get(var, "unknown"),
            source=SOURCE_NAME,
            retrieved_at=retrieved_at,
            data_mode=data_mode,
        )
    return {"fields": fields, "model_metadata": None}


# ---------------------------------------------------------------------------
# Public adapter interface
# ---------------------------------------------------------------------------

async def fetch(
    centroid_lat: float,
    centroid_lon: float,
    data_mode: str = "live",
) -> ProviderResult:
    """Fetch weather data from Open-Meteo for the given centroid.

    Args:
        centroid_lat: Farm centroid latitude in decimal degrees.
        centroid_lon: Farm centroid longitude in decimal degrees.
        data_mode: Data mode label for provenance (default "live").

    Returns:
        ProviderResult with a weather payload and evidence_status="accepted"
        on success, or evidence_status="unavailable" on any failure.

    Never raises; all errors are captured and returned as ProviderResult.

    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    """
    retrieved_at = _iso_now()

    params = {
        "latitude": centroid_lat,
        "longitude": centroid_lon,
        "hourly": ",".join(CURRENT_VARIABLES),
        "forecast_days": 7,
        "timezone": "UTC",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as exc:
        msg = f"Open-Meteo request timed out after {REQUEST_TIMEOUT_SECONDS}s: {exc}"
        logger.warning(msg)
        return ProviderResult(
            payload=_build_unavailable_payload(retrieved_at, data_mode),
            evidence_status=EVIDENCE_UNAVAILABLE,
            error_message=msg,
        )
    except httpx.HTTPStatusError as exc:
        msg = f"Open-Meteo returned HTTP {exc.response.status_code}"
        logger.warning(msg)
        return ProviderResult(
            payload=_build_unavailable_payload(retrieved_at, data_mode),
            evidence_status=EVIDENCE_UNAVAILABLE,
            error_message=msg,
        )
    except Exception as exc:
        msg = f"Open-Meteo request failed: {exc}"
        logger.warning(msg)
        return ProviderResult(
            payload=_build_unavailable_payload(retrieved_at, data_mode),
            evidence_status=EVIDENCE_UNAVAILABLE,
            error_message=msg,
        )

    payload = _build_weather_payload(data, retrieved_at, data_mode)
    return ProviderResult(
        payload=payload,
        evidence_status=EVIDENCE_ACCEPTED,
        error_message=None,
    )
