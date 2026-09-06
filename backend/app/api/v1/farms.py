"""
Farm read endpoints.

Requirements: 5.1, 5.2, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.6

Phase 1 implements only GET operations for farms.
POST/PATCH/DELETE operations belong to Phase 4.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, Field
from shapely.geometry import mapping

from app.api.dependencies import get_current_principal, get_farm_service
from app.api.schemas import (
    ErrorResponse,
    PaginatedResponse,
    PaginationParams,
    ReadBaseSchema,
    TimestampMixin,
    persisted_datetime_to_utc,
)
from app.core.security import Principal
from app.repositories.base import NotFoundError
from app.services.farm import FarmService

router = APIRouter(prefix="/farms", tags=["Farms"])


async def get_pagination_params(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PaginationParams:
    """Build validated pagination without a synchronous class dependency."""
    return PaginationParams(limit=limit, offset=offset)


class GeometryRevisionResponse(ReadBaseSchema):
    """
    Farm geometry revision response.
    
    Requirements: 7.5, 8.6
    """

    id: UUID = Field(description="Revision UUID")
    revision: int = Field(description="Sequential revision number", ge=1)
    geometry: dict = Field(
        description="GeoJSON polygon geometry in WGS84 (SRID 4326)"
    )
    centroid: dict = Field(description="GeoJSON centroid point")
    label_point: dict = Field(description="GeoJSON interior label point")
    hectares: float = Field(description="Farm area in hectares", gt=0)
    created_at: datetime = Field(description="Revision creation timestamp")


class FarmSummaryResponse(ReadBaseSchema, TimestampMixin):
    """
    Farm summary for list responses.
    
    Requirements: 7.5, 7.7
    """

    id: UUID = Field(description="Farm UUID")
    name: str = Field(description="Farm name")
    current_geometry_revision: int = Field(
        description="Current geometry revision number", ge=1
    )
    hectares: float = Field(
        description="Current farm area in hectares", gt=0
    )


class FarmDetailResponse(ReadBaseSchema, TimestampMixin):
    """
    Detailed farm response with current geometry.
    
    Requirements: 7.5, 7.7, 8.6
    """

    id: UUID = Field(description="Farm UUID")
    name: str = Field(description="Farm name")
    current_geometry_revision: int = Field(
        description="Current geometry revision number", ge=1
    )
    current_geometry: GeometryRevisionResponse = Field(
        description="Current saved geometry revision"
    )


class FarmListResponse(PaginatedResponse):
    """
    Paginated farm list response.
    
    Requirements: 7.5, 8.1, 8.2, 8.3, 8.6
    """

    items: list[FarmSummaryResponse] = Field(
        description="Farms in this page"
    )


def _geometry_to_geojson(wkb_element) -> dict:
    """
    Convert PostGIS geometry to GeoJSON dict.
    
    Requirements: 7.5, 8.6
    """
    # Convert WKBElement to Shapely geometry
    shape = to_shape(wkb_element)
    # Convert Shapely geometry to GeoJSON dict
    return mapping(shape)


@router.get(
    "",
    response_model=FarmListResponse,
    summary="List farms",
    description="Returns paginated list of farms owned by the authenticated user.",
)
async def list_farms(
    principal: Principal = Depends(get_current_principal),
    pagination: PaginationParams = Depends(get_pagination_params),
    farm_service: FarmService = Depends(get_farm_service),
) -> FarmListResponse:
    """
    List farms owned by the authenticated user.
    
    Requirements: 5.1, 5.2, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.6
    
    Returns ownership-scoped paginated farm list with:
    - Stable deterministic ordering (by creation time, then ID)
    - Current farm metadata including area from current geometry
    - Scoped total count
    
    May return empty list if user has no farms.
    """
    # Get farms and count from service
    farms, total = await farm_service.list_farms(
        limit=pagination.limit,
        offset=pagination.offset,
        sort_by="created_at",
    )

    # Convert to response models
    items = [
        FarmSummaryResponse(
            id=farm.id,
            name=farm.name,
            current_geometry_revision=farm.current_geometry_revision,
            hectares=farm.current_geometry.hectares,
            created_at=persisted_datetime_to_utc(farm.created_at),
            updated_at=persisted_datetime_to_utc(farm.updated_at),
        )
        for farm in farms
    ]

    return FarmListResponse(
        items=items,
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
    )


@router.get(
    "/{farm_id}",
    response_model=FarmDetailResponse,
    summary="Get farm details",
    description="Returns detailed farm information with current geometry "
    "for the specified farm owned by the authenticated user.",
    responses={
        404: {
            "description": "Farm not found or not owned by user",
            "model": ErrorResponse,
        }
    },
)
async def get_farm(
    farm_id: UUID,
    principal: Principal = Depends(get_current_principal),
    farm_service: FarmService = Depends(get_farm_service),
) -> FarmDetailResponse:
    """
    Get detailed farm information.
    
    Requirements: 5.1, 5.2, 7.5, 7.6, 7.7, 8.6
    
    Returns:
    - Farm metadata
    - Current geometry revision with full geometry data
    
    Returns 404 for both:
    - Nonexistent farms
    - Farms owned by other users
    
    This prevents cross-user existence disclosure.
    """
    try:
        # Get farm from service (includes ownership check)
        farm = await farm_service.get_farm(farm_id)

        # Convert current geometry to response
        current_geo = farm.current_geometry
        current_geometry_response = GeometryRevisionResponse(
            id=current_geo.id,
            revision=current_geo.revision,
            geometry=_geometry_to_geojson(current_geo.geometry),
            centroid=_geometry_to_geojson(current_geo.centroid),
            label_point=_geometry_to_geojson(current_geo.label_point),
            hectares=current_geo.hectares,
            created_at=persisted_datetime_to_utc(current_geo.created_at),
        )

        return FarmDetailResponse(
            id=farm.id,
            name=farm.name,
            current_geometry_revision=farm.current_geometry_revision,
            current_geometry=current_geometry_response,
            created_at=persisted_datetime_to_utc(farm.created_at),
            updated_at=persisted_datetime_to_utc(farm.updated_at),
        )

    except NotFoundError:
        # Convert to HTTP 404 (handled by exception handler)
        raise
