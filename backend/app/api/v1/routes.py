"""
API v1 routes composition.

Requirements: 7.1, 7.2, 7.3, 7.4

All application operations are exposed under /api/v1.
Health and documentation routes are explicit exceptions.
"""

from fastapi import APIRouter

from app.api.schemas import ErrorResponse

from . import profile, farms, conduit

COMMON_ERROR_RESPONSES = {
    401: {"model": ErrorResponse, "description": "Missing or invalid bearer token"},
    403: {"model": ErrorResponse, "description": "Insufficient permissions"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    422: {"model": ErrorResponse, "description": "Invalid request"},
    503: {"model": ErrorResponse, "description": "Dependency unavailable"},
}


router = APIRouter(
    prefix="/api/v1",
    tags=["API v1"],
    responses=COMMON_ERROR_RESPONSES,
)

# Include endpoint routers
router.include_router(profile.router)
router.include_router(farms.router)
router.include_router(conduit.router)
router.include_router(conduit.data_sources_router)
