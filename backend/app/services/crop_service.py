"""
Crop simulation service.

Orchestrates farm ownership checks, snapshot loading, context building,
and crop engine calls to produce a SimulationResponse or CropRankingResponse.

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2
"""

from __future__ import annotations

import logging
from datetime import date
from uuid import UUID

from geoalchemy2.shape import to_shape
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.crop_schemas import (
    ComponentScoresResponse,
    CropRankingResponse,
    SimulationResponse,
    SimulationResultResponse,
)
from app.core.exceptions import FarmValidationError, NotFoundError
from app.core.security import Principal
from app.domain.crop_engine import ENGINE_VERSION, SimulationResult, rank_all, score
from app.domain.crop_register import CROP_REGISTER
from app.domain.snapshot_context import context_from_demonstration, context_from_snapshot
from app.models.farm import Farm
from app.models.snapshot import AnalysisSnapshot
from app.repositories.farm import FarmRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _result_to_response(result: SimulationResult) -> SimulationResultResponse:
    """Convert a domain SimulationResult to its API response schema."""
    return SimulationResultResponse(
        crop_name=result.crop_name,
        suitability_index=result.suitability_index,
        label=result.label,
        components=ComponentScoresResponse(
            temperature=int(round(result.components.temperature)),
            water=int(round(result.components.water)),
            soil=int(round(result.components.soil)),
            heat_safety=int(round(result.components.heat_safety)),
            drought_flood_safety=int(round(result.components.drought_flood_safety)),
            environmental_condition=int(round(result.components.environmental_condition)),
        ),
        limiting_factor=result.limiting_factor,
        reason=result.reason,
        hard_exclusion=result.hard_exclusion,
        hard_exclusion_reason=result.hard_exclusion_reason,
        engine_version=result.engine_version,
        snapshot_id=result.snapshot_id,
        data_mode=result.data_mode,
        input_completeness=result.input_completeness,
    )


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


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def simulate(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    crop_name: str | None,
    planting_date: date,
    cultivation_mode: str,
    irrigation_mm: float | None,
) -> SimulationResponse | CropRankingResponse:
    """
    Simulate crop suitability for *farm_id* under the given planting parameters.

    Steps:
    1. Fetch the farm via FarmRepository (ownership check).
    2. Attempt to load the latest AnalysisSnapshot for the current geometry revision.
    3. Build SnapshotContext from snapshot or demonstration fallback.
    4. Score one crop (returns SimulationResponse + 3 alternatives) or rank all
       crops (returns CropRankingResponse) depending on whether crop_name was supplied.

    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2
    """
    # 1. Ownership-scoped farm fetch (raises NotFoundError → 404 for wrong owner)
    repo = FarmRepository(session, principal.user_id)
    farm: Farm = await repo.get_by_id(farm_id)

    centroid = to_shape(farm.current_geometry.centroid)

    # 2. Attempt to load latest snapshot
    snapshot = await _load_latest_snapshot(
        session, farm.id, farm.current_geometry_revision
    )

    # 3. Build SnapshotContext
    planting_month = planting_date.month

    if snapshot is not None:
        # Determine crop duration: use the requested crop's duration or a default of 4 months
        if crop_name is not None:
            crop_obj = next(
                (c for c in CROP_REGISTER if c.name.lower() == crop_name.lower()),
                None,
            )
            crop_duration = crop_obj.duration_months if crop_obj is not None else 4
        else:
            crop_duration = 4  # default for ranking context

        context = context_from_snapshot(snapshot, planting_month, crop_duration)
        logger.debug(
            "Built snapshot context for farm %s (snapshot=%s, data_mode=%s)",
            farm_id,
            snapshot.id,
            snapshot.data_mode,
        )
    else:
        # Demonstration fallback (Requirement 2.2)
        context = context_from_demonstration(
            latitude=centroid.y,
            longitude=centroid.x,
            planting_month=planting_month,
        )
        logger.debug(
            "No snapshot for farm %s — using demonstration fallback.", farm_id
        )

    # 4. Score or rank
    if crop_name is not None:
        # Find the crop in the register (case-insensitive match)
        crop_obj = next(
            (c for c in CROP_REGISTER if c.name.lower() == crop_name.lower()),
            None,
        )
        if crop_obj is None:
            raise FarmValidationError(
                field="body.crop_name",
                detail_code="INVALID_VALUE",
                message=f"Unknown crop name: {crop_name!r}",
            )

        selected_result = score(crop_obj, context)
        selected_response = _result_to_response(selected_result)

        # Top 3 alternatives (excluding the selected crop)
        all_ranked = rank_all(context)
        alternatives = [
            _result_to_response(r)
            for r in all_ranked
            if r.crop_name.lower() != crop_name.lower()
        ][:3]

        return SimulationResponse(
            farm_id=str(farm.id),
            selected=selected_response,
            alternatives=alternatives,
            engine_version=ENGINE_VERSION,
            snapshot_id=context.snapshot_id,
            data_mode=context.data_mode,
        )

    else:
        # Rank all crops (Requirement 4.1)
        all_ranked = rank_all(context)
        ranked_responses = [_result_to_response(r) for r in all_ranked]

        return CropRankingResponse(
            farm_id=str(farm.id),
            ranked=ranked_responses,
            engine_version=ENGINE_VERSION,
            snapshot_id=context.snapshot_id,
            data_mode=context.data_mode,
        )
