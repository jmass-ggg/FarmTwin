"""
Crop Simulator API routes.

GET  /api/v1/crops                              → 200 CropListResponse
POST /api/v1/farms/{farm_id}/simulate-crop      → 200 SimulationResponse | CropRankingResponse

Both routes require bearer authentication via resolve_principal.
Ownership-scoped 404 on wrong owner; 422 on validation failures.

Requirements: 6.1, 6.2, 6.4, 6.5
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_principal,
    get_request_session,
)
from app.api.schemas import ErrorResponse
from app.api.v1.crop_schemas import (
    CropEntry,
    CropListResponse,
    CropRankingResponse,
    SimulateRequest,
    SimulationResponse,
)
from app.core.security import Principal
from app.domain.crop_register import CROP_REGISTER, REGISTER_METADATA
from app.services import crop_service

router = APIRouter(tags=["Crop Simulator"])


@router.get(
    "/crops",
    response_model=CropListResponse,
    summary="List all supported crops",
    description=(
        "Returns the complete crop register with name, category, data_version, "
        "and the register's last_updated date. Requirements: 1.6, 6.2"
    ),
)
async def list_crops(
    principal: Principal = Depends(get_current_principal),
) -> CropListResponse:
    """
    Return all crops in the register.

    The crop list is derived from the in-memory CROP_REGISTER loaded at startup.
    Authentication is required for API surface consistency (Requirement 6.5).

    Requirements: 1.6, 6.2
    """
    crops = [
        CropEntry(
            name=crop.name,
            category=crop.category,
            data_version=crop.data_version,
            last_updated=REGISTER_METADATA.last_updated,
        )
        for crop in CROP_REGISTER
    ]
    return CropListResponse(
        crops=crops,
        register_version=REGISTER_METADATA.version,
        last_updated=REGISTER_METADATA.last_updated,
    )


@router.post(
    "/farms/{farm_id}/simulate-crop",
    response_model=SimulationResponse | CropRankingResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Farm not found or not owned by authenticated user",
        },
        422: {
            "model": ErrorResponse,
            "description": (
                "Invalid request: unknown crop name, missing irrigation_mm "
                "when irrigated, or required inputs absent with no fallback"
            ),
        },
    },
    summary="Simulate crop suitability",
    description=(
        "Score a specific crop (SimulationResponse + 3 alternatives) or rank all "
        "supported crops (CropRankingResponse) for the given farm, planting date, "
        "and cultivation mode. Uses the latest Phase 5 snapshot when available; "
        "falls back to the demonstration climate profile otherwise. "
        "Returns 404 for missing or cross-user farms. "
        "Requirements: 6.1, 6.4, 6.5"
    ),
)
async def simulate_crop(
    farm_id: UUID,
    body: SimulateRequest,
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> SimulationResponse | CropRankingResponse:
    """
    POST /api/v1/farms/{farm_id}/simulate-crop

    Delegates to crop_service.simulate() which:
    1. Fetches the farm with ownership check (NotFoundError → 404).
    2. Loads the latest AnalysisSnapshot or falls back to demonstration profile.
    3. Scores the requested crop or ranks all 12 crops.

    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 6.1, 6.4, 6.5
    """
    return await crop_service.simulate(
        session=session,
        principal=principal,
        farm_id=farm_id,
        crop_name=body.crop_name,
        planting_date=body.planting_date,
        cultivation_mode=body.cultivation_mode,
        irrigation_mm=body.irrigation_mm,
    )
