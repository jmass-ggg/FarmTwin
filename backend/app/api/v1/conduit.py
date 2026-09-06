"""
Conduit pipeline API endpoints.

Exposes normalized observations, derived features, and data-source status.
All endpoints require bearer auth or demo principal (Phase 1 auth boundary).

Requirements: 11.1–11.8
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import Field, computed_field, model_validator
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_principal, get_request_session
from app.api.schemas import (
    PaginatedResponse,
    PaginationParams,
    ReadBaseSchema,
    TimestampMixin,
    persisted_datetime_to_utc,
)
from app.core.security import Principal
from app.models.conduit import (
    DailyAggregate,
    HourlyAggregate,
    IngestionRun,
    IngestionStatus,
    NormalizedObservation,
    QualityFlag,
    Station,
)

router = APIRouter(prefix="/conduit", tags=["Conduit"])
data_sources_router = APIRouter(tags=["Data Sources"])

# ---------------------------------------------------------------------------
# Shared sub-schemas
# ---------------------------------------------------------------------------


class QualifiedFloat(ReadBaseSchema):
    """A nullable float measurement with its quality flag."""

    value: float | None = Field(None)
    quality: str = Field(description="Quality flag for this measurement")


class SourceInfo(ReadBaseSchema):
    """Provenance metadata for a conduit observation."""

    provider: str = Field(default="conduit")
    station_id: str = Field(description="Provider-assigned station identifier")
    retrieval_time: datetime = Field(description="Time this record was ingested (UTC)")


# ---------------------------------------------------------------------------
# 10.1  GET /api/v1/conduit/current
# ---------------------------------------------------------------------------


class NormalizedObservationResponse(ReadBaseSchema):
    """
    Normalized observation response shape.

    Requirements: 11.1
    """

    id: UUID
    valid_time: datetime = Field(description="Observation valid time (UTC)")
    data_mode: str = Field(description="Data mode for this record")
    temperature_consensus: float | None = Field(None)
    temperature_consensus_quality: str
    temperature_channel_count: int
    humidity_sht: float | None = Field(None)
    humidity_sht_quality: str
    vpd_kpa: float | None = Field(None)
    vpd_quality: str
    wind_spd: float | None = Field(None)
    wind_spd_quality: str
    wind_gust: float | None = Field(None)
    wind_gust_quality: str
    press_hpa: float | None = Field(None)
    press_quality: str
    staleness_hours: float = Field(description="Hours elapsed since valid_time at response time")
    source: SourceInfo


class ConduitCurrentResponse(ReadBaseSchema):
    """Successful current-observation response. Requirements: 11.1"""

    status: Literal["ok"] = "ok"
    data: NormalizedObservationResponse


class ConduitUnavailableResponse(ReadBaseSchema):
    """Unavailable response when no accepted observation exists. Requirements: 11.2"""

    status: Literal["unavailable"] = "unavailable"
    data: None = None


def _obs_to_response(obs: NormalizedObservation, station: Station) -> NormalizedObservationResponse:
    """Map an ORM NormalizedObservation to the API response schema."""
    now = datetime.now(UTC)
    valid_time = persisted_datetime_to_utc(obs.valid_time_utc)
    staleness_hours = (now - valid_time).total_seconds() / 3600.0

    return NormalizedObservationResponse(
        id=obs.id,
        valid_time=valid_time,
        data_mode=obs.data_mode,
        temperature_consensus=obs.temperature_consensus,
        temperature_consensus_quality=obs.temperature_consensus_quality.value
        if hasattr(obs.temperature_consensus_quality, "value")
        else str(obs.temperature_consensus_quality),
        temperature_channel_count=obs.temperature_channel_count,
        humidity_sht=obs.humidity_sht_pct,
        humidity_sht_quality=obs.humidity_sht_quality.value
        if hasattr(obs.humidity_sht_quality, "value")
        else str(obs.humidity_sht_quality),
        vpd_kpa=obs.vpd_kpa,
        vpd_quality=obs.vpd_quality.value
        if hasattr(obs.vpd_quality, "value")
        else str(obs.vpd_quality),
        wind_spd=obs.wind_spd_ms,
        wind_spd_quality=obs.wind_spd_quality.value
        if hasattr(obs.wind_spd_quality, "value")
        else str(obs.wind_spd_quality),
        wind_gust=obs.wind_gust_ms,
        wind_gust_quality=obs.wind_gust_quality.value
        if hasattr(obs.wind_gust_quality, "value")
        else str(obs.wind_gust_quality),
        press_hpa=obs.press_hpa,
        press_quality=obs.press_quality.value
        if hasattr(obs.press_quality, "value")
        else str(obs.press_quality),
        staleness_hours=round(staleness_hours, 4),
        source=SourceInfo(
            provider="conduit",
            station_id=station.provider_station_id,
            retrieval_time=persisted_datetime_to_utc(obs.created_at),
        ),
    )


@router.get(
    "/current",
    response_model=ConduitCurrentResponse | ConduitUnavailableResponse,
    summary="Get most recent Conduit observation",
    description=(
        "Returns the most recent accepted normalized observation for the configured "
        "station, including quality flags and staleness. Returns status='unavailable' "
        "with null data when no accepted observation exists."
    ),
)
async def get_current(
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> ConduitCurrentResponse | ConduitUnavailableResponse:
    """
    Most recent accepted Conduit observation.

    Requirements: 11.1, 11.2, 11.6, 11.7
    """
    # Find the station
    station_result = await session.execute(select(Station).limit(1))
    station = station_result.scalar_one_or_none()

    if station is None:
        return ConduitUnavailableResponse()

    # Fetch the most recent accepted observation
    result = await session.execute(
        select(NormalizedObservation)
        .where(
            NormalizedObservation.station_id == station.id,
            NormalizedObservation.temperature_consensus_quality.in_(
                [QualityFlag.ACCEPTED, QualityFlag.SINGLE_CHANNEL]
            ),
        )
        .order_by(desc(NormalizedObservation.valid_time_utc))
        .limit(1)
    )
    obs = result.scalar_one_or_none()

    if obs is None:
        return ConduitUnavailableResponse()

    return ConduitCurrentResponse(data=_obs_to_response(obs, station))


# ---------------------------------------------------------------------------
# 10.2  GET /api/v1/conduit/features
# ---------------------------------------------------------------------------


class ConduitFeaturesResponse(ReadBaseSchema):
    """
    Latest daily aggregate feature response.

    Requirements: 11.3
    """

    status: Literal["ok"] = "ok"
    window_start: datetime = Field(description="UTC midnight start of the daily window")
    data_mode: str
    vpd_mean_kpa: float | None = Field(None)
    temp_mean_celsius: float | None = Field(None)
    temp_min_celsius: float | None = Field(None)
    temp_max_celsius: float | None = Field(None)
    humidity_mean_pct: float | None = Field(None)
    humidity_min_pct: float | None = Field(None)
    humidity_max_pct: float | None = Field(None)
    wind_spd_mean_ms: float | None = Field(None)
    wind_spd_min_ms: float | None = Field(None)
    wind_spd_max_ms: float | None = Field(None)
    observation_count: int
    accepted_count: int
    coverage_ratio: float


class ConduitFeaturesUnavailableResponse(ReadBaseSchema):
    """Unavailable when no daily aggregate exists. Requirements: 11.3"""

    status: Literal["unavailable"] = "unavailable"
    data: None = None


@router.get(
    "/features",
    response_model=ConduitFeaturesResponse | ConduitFeaturesUnavailableResponse,
    summary="Get latest daily feature aggregate",
    description=(
        "Returns the most recent daily aggregate including VPD, temperature stats, "
        "humidity, wind, and coverage. Returns status='unavailable' when no aggregate exists."
    ),
)
async def get_features(
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> ConduitFeaturesResponse | ConduitFeaturesUnavailableResponse:
    """
    Latest Conduit daily feature aggregate.

    Requirements: 11.3, 11.6, 11.7
    """
    station_result = await session.execute(select(Station).limit(1))
    station = station_result.scalar_one_or_none()

    if station is None:
        return ConduitFeaturesUnavailableResponse()

    result = await session.execute(
        select(DailyAggregate)
        .where(DailyAggregate.station_id == station.id)
        .order_by(desc(DailyAggregate.window_start_utc))
        .limit(1)
    )
    agg = result.scalar_one_or_none()

    if agg is None:
        return ConduitFeaturesUnavailableResponse()

    return ConduitFeaturesResponse(
        window_start=persisted_datetime_to_utc(agg.window_start_utc),
        data_mode=agg.data_mode,
        vpd_mean_kpa=agg.vpd_mean_kpa,
        temp_mean_celsius=agg.temp_mean_celsius,
        temp_min_celsius=agg.temp_min_celsius,
        temp_max_celsius=agg.temp_max_celsius,
        humidity_mean_pct=agg.humidity_mean_pct,
        humidity_min_pct=agg.humidity_min_pct,
        humidity_max_pct=agg.humidity_max_pct,
        wind_spd_mean_ms=agg.wind_spd_mean_ms,
        wind_spd_min_ms=agg.wind_spd_min_ms,
        wind_spd_max_ms=agg.wind_spd_max_ms,
        observation_count=agg.observation_count,
        accepted_count=agg.accepted_count,
        coverage_ratio=agg.coverage_ratio,
    )


# ---------------------------------------------------------------------------
# 10.3  GET /api/v1/conduit/history
# ---------------------------------------------------------------------------

_MAX_HISTORY_DAYS = 7
_DEFAULT_HISTORY_HOURS = 24


class ConduitHistoryResponse(PaginatedResponse):
    """Paginated observation history. Requirements: 11.4, 11.5"""

    items: list[NormalizedObservationResponse]


@router.get(
    "/history",
    response_model=ConduitHistoryResponse,
    summary="Get paginated observation history",
    description=(
        "Returns a paginated, reverse-chronological list of normalized observations. "
        "Defaults to the last 24 hours; maximum range is 7 days."
    ),
)
async def get_history(
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
    from_time: datetime | None = Query(
        None,
        alias="from",
        description="Start of time range (ISO 8601 UTC). Defaults to 24 hours ago.",
    ),
    to_time: datetime | None = Query(
        None,
        alias="to",
        description="End of time range (ISO 8601 UTC). Defaults to now.",
    ),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ConduitHistoryResponse:
    """
    Paginated Conduit observation history, bounded to 7 days.

    Requirements: 11.4, 11.5, 11.6, 11.7
    """
    now = datetime.now(UTC)

    # Default and cap the time range
    effective_to = to_time if to_time is not None else now
    effective_from = (
        from_time
        if from_time is not None
        else effective_to - timedelta(hours=_DEFAULT_HISTORY_HOURS)
    )

    # Cap maximum range to 7 days
    max_from = effective_to - timedelta(days=_MAX_HISTORY_DAYS)
    if effective_from < max_from:
        effective_from = max_from

    # Find the station
    station_result = await session.execute(select(Station).limit(1))
    station = station_result.scalar_one_or_none()

    if station is None:
        return ConduitHistoryResponse(items=[], limit=limit, offset=offset, total=0)

    # Base filter
    base_filter = (
        NormalizedObservation.station_id == station.id,
        NormalizedObservation.valid_time_utc >= effective_from,
        NormalizedObservation.valid_time_utc <= effective_to,
    )

    # Count total matching rows (scoped to window)
    total = await session.scalar(
        select(func.count())
        .select_from(NormalizedObservation)
        .where(*base_filter)
    )

    # Fetch page
    result = await session.execute(
        select(NormalizedObservation)
        .where(*base_filter)
        .order_by(desc(NormalizedObservation.valid_time_utc))
        .offset(offset)
        .limit(limit)
    )
    observations = result.scalars().all()

    items = [_obs_to_response(obs, station) for obs in observations]

    return ConduitHistoryResponse(
        items=items,
        limit=limit,
        offset=offset,
        total=total or 0,
    )


# ---------------------------------------------------------------------------
# 10.4  GET /api/v1/data-sources
# ---------------------------------------------------------------------------


class DataSourceRecord(ReadBaseSchema):
    """
    Provider record in the data-sources list.

    Requirements: 11.8
    No secrets or provider URLs included.
    """

    name: str = Field(description="Provider name")
    data_mode: str = Field(description="Data mode for this source")
    last_ingestion_time: datetime | None = Field(
        None, description="Time of last successful ingestion (UTC)"
    )
    record_count: int = Field(description="Total normalized observation count from this source")
    status: str = Field(description="Current status of this data source")


class DataSourcesResponse(ReadBaseSchema):
    """Data sources list response. Requirements: 11.8"""

    sources: list[DataSourceRecord]


@data_sources_router.get(
    "/data-sources",
    response_model=DataSourcesResponse,
    summary="List configured data sources",
    description=(
        "Returns a list of configured provider records with name, data mode, "
        "last ingestion time, record count, and status. "
        "No secrets or provider URLs are included."
    ),
)
async def get_data_sources(
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> DataSourcesResponse:
    """
    Data source provider list.

    Requirements: 11.8
    """
    # Get all completed ingestion runs grouped by source_id with latest retrieval time
    run_result = await session.execute(
        select(
            IngestionRun.source_id,
            func.max(IngestionRun.retrieval_time).label("last_ingestion_time"),
            func.sum(IngestionRun.accepted_count).label("total_accepted"),
        )
        .where(IngestionRun.status == IngestionStatus.COMPLETED)
        .group_by(IngestionRun.source_id)
    )
    runs = run_result.all()

    if not runs:
        # No ingestion runs yet — report fixture source as pending
        return DataSourcesResponse(
            sources=[
                DataSourceRecord(
                    name="conduit",
                    data_mode="historical_replay",
                    last_ingestion_time=None,
                    record_count=0,
                    status="pending",
                )
            ]
        )

    # Get the most recent run to determine current data_mode
    latest_run_result = await session.execute(
        select(IngestionRun)
        .where(IngestionRun.status == IngestionStatus.COMPLETED)
        .order_by(desc(IngestionRun.retrieval_time))
        .limit(1)
    )
    latest_run = latest_run_result.scalar_one_or_none()

    sources = []
    for row in runs:
        record_count = int(row.total_accepted or 0)
        last_time = persisted_datetime_to_utc(row.last_ingestion_time) if row.last_ingestion_time else None

        # Determine data_mode from the most recent run for this source
        source_run_result = await session.execute(
            select(IngestionRun)
            .where(
                IngestionRun.source_id == row.source_id,
                IngestionRun.status == IngestionStatus.COMPLETED,
            )
            .order_by(desc(IngestionRun.retrieval_time))
            .limit(1)
        )
        source_run = source_run_result.scalar_one_or_none()
        # Infer data_mode from accepted observations for this source
        obs_mode_result = await session.execute(
            select(NormalizedObservation.data_mode)
            .join(IngestionRun, NormalizedObservation.ingestion_run_id == IngestionRun.id)
            .where(IngestionRun.source_id == row.source_id)
            .limit(1)
        )
        obs_mode = obs_mode_result.scalar_one_or_none() or "historical_replay"

        sources.append(
            DataSourceRecord(
                name=row.source_id,
                data_mode=obs_mode,
                last_ingestion_time=last_time,
                record_count=record_count,
                status="active" if record_count > 0 else "empty",
            )
        )

    return DataSourcesResponse(sources=sources)
