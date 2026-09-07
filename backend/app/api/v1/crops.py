"""
Crop Simulator API routes.

GET  /api/v1/crops
    Returns the complete crop register (name, category, data_version, last_updated).

POST /api/v1/farms/{farm_id}/simulate-crop
    Scores a specific crop or ranks all crops against the farm's snapshot context.

Requirements: 6.1, 6.2, 6.4, 6.5
"""

from __future__ import annotations

from typing import Union
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_principal, get_request_session
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
from app.services.crop_service import simulate

router = APIRouter(tags=["Crop Simulator"])


@router.get(
    "/crops",
    response_model=CropListResponse,
    summary="List crop register",
    description=(
        "Returns all crops in the register with name, category, data_version, "
        "and the register's last_updated date. Requirements: 1.6, 6.2"
    ),
)
async def list_crops(
    principal: Principal = Depends(get_current_principal),
) -> CropListResponse:
    """
    Return the complete crop register.

    Requirements: 1.6, 6.2
    """
    return CropListResponse(
        crops=[
            CropEntry(
                name=crop.name,
                category=crop.category,
                data_version=crop.data_version,
                last_updated=REGISTER_METADATA.last_updated,
            )
            for crop in CROP_REGISTER
        ],
        register_version=REGISTER_METADATA.version,
        last_updated=REGISTER_METADATA.last_updated,
    )


@router.post(
    "/farms/{farm_id}/simulate-crop",
    response_model=Union[SimulationResponse, CropRankingResponse],
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Farm not found or not owned by the authenticated user",
        },
        422: {
            "model": ErrorResponse,
            "description": "Validation failure — unknown crop name, missing irrigation_mm, etc.",
        },
    },
    summary="Simulate crop suitability",
    description=(
        "Evaluates a specific crop (returns SimulationResponse + 3 alternatives) "
        "or ranks all 12 crops (returns CropRankingResponse) when crop_name is omitted. "
        "Uses the farm's latest Phase 5 snapshot when available, otherwise falls back to "
        "the demonstration climate profile. "
        "Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 6.1, 6.4"
    ),
)
async def simulate_crop(
    farm_id: UUID,
    request: SimulateRequest,
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> SimulationResponse | CropRankingResponse:
    """
    Score or rank crops for a farm.

    - Returns SimulationResponse when crop_name is provided.
    - Returns CropRankingResponse when crop_name is omitted.
    - 404 when farm not found or owned by another user.
    - 422 when crop_name is invalid or required inputs are absent.

    Requirements: 2.1, 2.2, 2.3, 4.1, 6.1, 6.4
    """
    return await simulate(
        session=session,
        principal=principal,
        farm_id=farm_id,
        crop_name=request.crop_name,
        planting_date=request.planting_date,
        cultivation_mode=request.cultivation_mode,
        irrigation_mm=request.irrigation_mm,
    )
