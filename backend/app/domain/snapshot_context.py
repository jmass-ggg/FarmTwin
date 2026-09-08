"""
Snapshot context adapter.

Converts a Phase 5 AnalysisSnapshot (or a demonstration profile) into a
unified SnapshotContext used by the CropEngine for scoring.

Public API:
    context_from_snapshot(snapshot, planting_month, crop_duration)
        → SnapshotContext  (source="snapshot")

    context_from_demonstration(latitude, longitude, planting_month)
        → SnapshotContext  (source="demonstration")

Requirements: 2.1, 2.2, 3.4
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.models.snapshot import AnalysisSnapshot

from app.services.decision_support import _seasonal_climate  # type: ignore[private-usage]


# ---------------------------------------------------------------------------
# SnapshotContext dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SnapshotContext:
    """Unified environmental inputs passed to the CropEngine for scoring.

    All numeric fields are optional — None means "not available from this
    source".  The *demonstration_input_fields* frozenset documents which
    fields were filled from the demonstration fallback rather than a real
    snapshot.

    Requirements: 2.1, 2.2, 3.4
    """

    source: Literal["snapshot", "demonstration"]

    # Snapshot reference (null when source="demonstration")
    snapshot_id: str | None
    data_mode: str   # "live" | "historical_replay" | "demonstration"

    # Temperature — mean over the crop duration (°C)
    temperature_mean_c: float | None
    temperature_source: str | None

    # Rainfall — total over the crop duration (mm)
    rainfall_total_mm: float | None
    rainfall_source: str | None

    # Soil (0–5 cm depth)
    soil_ph: float | None
    soil_clay_pct: float | None
    soil_sand_pct: float | None
    soil_source: str | None
    soil_is_modelled: bool

    # Environmental condition — NDVI mean from satellite
    ndvi_mean: float | None
    ndvi_source: str | None

    # Conduit VPD (kPa) from an eligible Conduit station
    vpd_kpa: float | None

    # Completeness bookkeeping
    real_input_fields: frozenset[str]
    demonstration_input_fields: frozenset[str]

    # ---------------------------------------------------------------------------
    # Risk engine fields (Phase 7) — optional, default None for back-compat
    # ---------------------------------------------------------------------------

    # 7-day cumulative rainfall (mm) for heavy rainfall / flood assessments
    rain_7d_mm: float | None = None

    # Maximum wind speed (m/s) for wind hazard assessment
    wind_max_ms: float | None = None

    # Terrain slope (%) derived from mean_slope_deg (degrees → percent)
    slope_pct: float | None = None

    # Seasonal climate baseline rainfall (mm) for drought ratio calculation
    climate_baseline_rainfall_mm: float | None = None


# ---------------------------------------------------------------------------
# Helper: safely extract a numeric value from a provenance envelope
# ---------------------------------------------------------------------------

def _env_value(envelope: dict | None) -> float | None:
    """Return the numeric value from a provenance envelope dict, or None."""
    if envelope is None:
        return None
    return envelope.get("value")


def _env_source(envelope: dict | None) -> str | None:
    """Return the source string from a provenance envelope dict, or None."""
    if envelope is None:
        return None
    return envelope.get("source")


def _is_accepted(envelope: dict | None) -> bool:
    """Return True when the envelope quality is 'accepted'."""
    if envelope is None:
        return False
    return envelope.get("quality") == "accepted"


# ---------------------------------------------------------------------------
# context_from_snapshot
# ---------------------------------------------------------------------------

def context_from_snapshot(
    snapshot: "AnalysisSnapshot",
    planting_month: int,
    crop_duration: int,
) -> SnapshotContext:
    """Build a SnapshotContext from a Phase 5 AnalysisSnapshot.

    Extracts temperature, rainfall, soil, NDVI, and VPD from the snapshot
    payloads.  Fields that are unavailable are set to None and recorded in
    *demonstration_input_fields*.

    The *planting_month* and *crop_duration* parameters are accepted for
    future projection logic (e.g. selecting the right seasonal window from
    the climate baseline).  In Phase 6 the climate baseline monthly means
    are used if available; otherwise the snapshot's current weather value
    is used.

    Requirements: 2.1, 3.4
    """
    real_fields: set[str] = set()
    demo_fields: set[str] = set()

    # ------------------------------------------------------------------
    # Temperature — prefer climate_baseline monthly mean for planting_month;
    # fall back to current weather temperature_2m.
    # ------------------------------------------------------------------
    temperature_mean_c: float | None = None
    temperature_source: str | None = None

    climate = snapshot.climate_baseline or {}
    temp_baseline_entry = climate.get("temperature_2m_mean")
    temp_val: float | None = None
    temp_src: str | None = None

    if isinstance(temp_baseline_entry, dict):
        # Try all_monthly_means first (30-year means per month)
        all_monthly = climate.get("all_monthly_means", {})
        temp_monthly = all_monthly.get("temperature_2m_mean", {})
        month_key = str(planting_month)
        monthly_val = temp_monthly.get(month_key)
        if monthly_val is not None:
            temp_val = float(monthly_val)
            temp_src = "open-meteo-era5"
        else:
            # Fall back to baseline monthly mean from the provenance envelope
            baseline_env = temp_baseline_entry.get("baseline_monthly_mean")
            if _is_accepted(baseline_env):
                temp_val = _env_value(baseline_env)
                temp_src = _env_source(baseline_env)

    if temp_val is None:
        # Last resort: current weather temperature_2m
        weather = snapshot.weather or {}
        temp_env = (weather.get("fields") or {}).get("temperature_2m")
        if _is_accepted(temp_env):
            temp_val = _env_value(temp_env)
            temp_src = _env_source(temp_env)

    if temp_val is not None:
        temperature_mean_c = temp_val
        temperature_source = temp_src
        real_fields.add("temperature_mean_c")
    else:
        demo_fields.add("temperature_mean_c")

    # ------------------------------------------------------------------
    # Rainfall — multiply monthly precipitation by crop_duration to get
    # total mm over the full growing period.
    # ------------------------------------------------------------------
    rainfall_total_mm: float | None = None
    rainfall_source: str | None = None

    precip_baseline_entry = climate.get("precipitation_sum")
    precip_val: float | None = None
    precip_src: str | None = None

    if isinstance(precip_baseline_entry, dict):
        all_monthly = climate.get("all_monthly_means", {})
        precip_monthly = all_monthly.get("precipitation_sum", {})
        month_key = str(planting_month)
        monthly_precip = precip_monthly.get(month_key)
        if monthly_precip is not None:
            # Scale monthly precipitation by number of growing months
            precip_val = float(monthly_precip) * crop_duration
            precip_src = "open-meteo-era5"
        else:
            baseline_env = precip_baseline_entry.get("baseline_monthly_mean")
            if _is_accepted(baseline_env):
                base_monthly = _env_value(baseline_env)
                if base_monthly is not None:
                    precip_val = base_monthly * crop_duration
                    precip_src = _env_source(baseline_env)

    if precip_val is None:
        # Last resort: current weather precipitation (single snapshot value)
        weather = snapshot.weather or {}
        precip_env = (weather.get("fields") or {}).get("precipitation")
        if _is_accepted(precip_env):
            raw = _env_value(precip_env)
            if raw is not None:
                precip_val = raw * crop_duration
                precip_src = _env_source(precip_env)

    if precip_val is not None:
        rainfall_total_mm = precip_val
        rainfall_source = precip_src
        real_fields.add("rainfall_total_mm")
    else:
        demo_fields.add("rainfall_total_mm")

    # ------------------------------------------------------------------
    # Soil — use 0–5 cm depth; extract pH, clay, sand
    # ------------------------------------------------------------------
    soil_ph: float | None = None
    soil_clay_pct: float | None = None
    soil_sand_pct: float | None = None
    soil_source: str | None = None
    soil_is_modelled = True

    soil_payload = snapshot.soil or {}
    depths = soil_payload.get("depths", {})
    top_depth = depths.get("0-5cm") or depths.get("0_5cm") or {}

    ph_entry = top_depth.get("phh2o", {})
    ph_env = ph_entry.get("mean") if isinstance(ph_entry, dict) else None
    if _is_accepted(ph_env):
        soil_ph = _env_value(ph_env)
        soil_source = _env_source(ph_env)
        real_fields.add("soil_ph")
    else:
        demo_fields.add("soil_ph")

    clay_entry = top_depth.get("clay", {})
    clay_env = clay_entry.get("mean") if isinstance(clay_entry, dict) else None
    if _is_accepted(clay_env):
        soil_clay_pct = _env_value(clay_env)
        if soil_source is None:
            soil_source = _env_source(clay_env)
        real_fields.add("soil_clay_pct")
    else:
        demo_fields.add("soil_clay_pct")

    sand_entry = top_depth.get("sand", {})
    sand_env = sand_entry.get("mean") if isinstance(sand_entry, dict) else None
    if _is_accepted(sand_env):
        soil_sand_pct = _env_value(sand_env)
        real_fields.add("soil_sand_pct")
    else:
        demo_fields.add("soil_sand_pct")

    # ------------------------------------------------------------------
    # NDVI — from satellite payload
    # ------------------------------------------------------------------
    ndvi_mean: float | None = None
    ndvi_source: str | None = None

    satellite = snapshot.satellite or {}
    ndvi_env = satellite.get("ndvi")
    if _is_accepted(ndvi_env):
        ndvi_mean = _env_value(ndvi_env)
        ndvi_source = _env_source(ndvi_env)
        real_fields.add("ndvi_mean")
    else:
        demo_fields.add("ndvi_mean")

    # ------------------------------------------------------------------
    # VPD — from Conduit payload
    # ------------------------------------------------------------------
    vpd_kpa: float | None = None

    conduit = snapshot.conduit or {}
    vpd_env = conduit.get("vpd_mean_kpa")
    if _is_accepted(vpd_env):
        vpd_kpa = _env_value(vpd_env)
        real_fields.add("vpd_kpa")
    else:
        demo_fields.add("vpd_kpa")

    return SnapshotContext(
        source="snapshot",
        snapshot_id=str(snapshot.id),
        data_mode=snapshot.data_mode,
        temperature_mean_c=temperature_mean_c,
        temperature_source=temperature_source,
        rainfall_total_mm=rainfall_total_mm,
        rainfall_source=rainfall_source,
        soil_ph=soil_ph,
        soil_clay_pct=soil_clay_pct,
        soil_sand_pct=soil_sand_pct,
        soil_source=soil_source,
        soil_is_modelled=soil_is_modelled,
        ndvi_mean=ndvi_mean,
        ndvi_source=ndvi_source,
        vpd_kpa=vpd_kpa,
        real_input_fields=frozenset(real_fields),
        demonstration_input_fields=frozenset(demo_fields),
    )


# ---------------------------------------------------------------------------
# context_from_demonstration
# ---------------------------------------------------------------------------

def context_from_demonstration(
    latitude: float,
    longitude: float,
    planting_month: int,
    crop_duration: int = 4,
) -> SnapshotContext:
    """Build a demonstration SnapshotContext using the existing decision_support profile.

    Calls _seasonal_climate() to get temperature and monthly rainfall for the
    planting month, then multiplies rainfall by crop_duration to get total mm.

    All fields are sourced from demonstration; snapshot_id is None.

    Requirements: 2.2, 3.4
    """
    temperature_c, monthly_rainfall_mm = _seasonal_climate(latitude, longitude, planting_month)
    rainfall_total_mm = monthly_rainfall_mm * crop_duration

    # Demonstration uses neutral soil and environmental placeholders
    # (documented in the decision_support.py comments)
    all_fields = frozenset({
        "temperature_mean_c",
        "rainfall_total_mm",
        "soil_ph",
        "soil_clay_pct",
        "soil_sand_pct",
        "ndvi_mean",
        "vpd_kpa",
    })

    return SnapshotContext(
        source="demonstration",
        snapshot_id=None,
        data_mode="demonstration",
        temperature_mean_c=temperature_c,
        temperature_source="decision_support_demonstration",
        rainfall_total_mm=rainfall_total_mm,
        rainfall_source="decision_support_demonstration",
        # Neutral soil placeholders — not real farm measurements
        soil_ph=None,
        soil_clay_pct=None,
        soil_sand_pct=None,
        soil_source=None,
        soil_is_modelled=False,
        # Neutral environmental placeholder — not a real farm measurement
        ndvi_mean=None,
        ndvi_source=None,
        vpd_kpa=None,
        real_input_fields=frozenset(),
        demonstration_input_fields=all_fields,
    )
