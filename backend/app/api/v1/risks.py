"""
Risk Center API routes.

GET  /api/v1/farms/{farm_id}/risks
    → 200 RiskResponse; 404 wrong owner/not found; 401 unauthenticated

PATCH /api/v1/farms/{farm_id}/actions/{action_id}
    → 200 ActionCompletionResponse; 404 farm; 422 unknown action_id

Both routes require bearer authentication via get_current_principal.

Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
"""

from __future__ import annotations

from datetime import timezone
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_principal, get_request_session
from app.api.schemas import ErrorResponse
from app.api.v1.risk_schemas import (
    ActionCompletionResponse,
    ActionRuleResponse,
    HazardAssessmentResponse,
    RiskResponse,
)
from app.core.security import Principal
from app.models.actions import ActionCompletion
from app.domain.risk_engine import HazardAssessment, RiskResponse as DomainRiskResponse
from app.domain.risk_rules import ActionRule
from app.services import risk_service

router = APIRouter(tags=["Risk Center"])


# ---------------------------------------------------------------------------
# Domain → API response converters
# ---------------------------------------------------------------------------

def _normalize_dt(dt) -> "datetime":
    """Ensure datetime is timezone-aware (UTC)."""
    from datetime import datetime
    if dt is None:
        return None
    if hasattr(dt, "tzinfo") and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _action_rule_to_response(
    rule: ActionRule,
    completions: dict[str, ActionCompletion],
) -> ActionRuleResponse:
    """Convert a domain ActionRule to its API schema, overlaying completion state."""
    completion = completions.get(rule.id)
    completed = completion is not None
    completed_at = _normalize_dt(completion.completed_at) if completion else None
    return ActionRuleResponse(
        id=rule.id,
        priority=rule.priority,
        text=rule.text,
        source=rule.source,
        review_date=rule.review_date,
        completed=completed,
        completed_at=completed_at,
    )


def _assessment_to_response(
    assessment: HazardAssessment,
    completions: dict[str, ActionCompletion],
) -> HazardAssessmentResponse:
    """Convert a domain HazardAssessment to its API schema."""
    action_responses = [
        _action_rule_to_response(rule, completions)
        for rule in assessment.actions
    ]
    return HazardAssessmentResponse(
        hazard=assessment.hazard,
        index=assessment.index,
        level=assessment.level,
        driver=assessment.driver,
        explanation=assessment.explanation,
        horizon=assessment.horizon,
        at_risk_crops=list(assessment.at_risk_crops),
        actions=action_responses,
        evidence_used=dict(assessment.evidence_used),
        engine_version=assessment.engine_version,
        snapshot_id=assessment.snapshot_id,
        data_mode=assessment.data_mode,
    )


async def _load_completions(
    session: AsyncSession,
    farm_id: UUID,
) -> dict[str, ActionCompletion]:
    """Load all action completions for a farm into a lookup dict."""
    from sqlalchemy import select
    from app.models.actions import ActionCompletion as AC

    result = await session.execute(
        select(AC).where(AC.farm_id == farm_id)
    )
    rows = result.scalars().all()
    return {row.action_id: row for row in rows}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "/farms/{farm_id}/risks",
    response_model=RiskResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthenticated"},
        404: {
            "model": ErrorResponse,
            "description": "Farm not found or owned by a different user",
        },
    },
    summary="Get all hazard assessments for a farm",
    description=(
        "Returns all five hazard assessments (Drought, Heat, Heavy Rainfall, "
        "Flood Exposure, Wind) for the specified farm. Uses the latest Phase 5 "
        "snapshot when available; falls back to demonstration profile otherwise. "
        "Requirements: 8.1, 8.2, 8.3, 8.4, 8.5"
    ),
)
async def get_farm_risks(
    farm_id: UUID,
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> RiskResponse:
    """
    GET /api/v1/farms/{farm_id}/risks

    Delegates to risk_service.get_risks(), then overlays action completion
    status from the database before serialising.

    Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
    """
    # Run the risk engine (ownership check happens inside)
    domain_response: DomainRiskResponse = await risk_service.get_risks(
        session=session,
        principal=principal,
        farm_id=farm_id,
    )

    # Load action completions to overlay on each assessment's action list
    completions = await _load_completions(session, farm_id)

    # Convert domain response → API schema
    assessment_responses = [
        _assessment_to_response(a, completions)
        for a in domain_response.assessments
    ]

    return RiskResponse(
        farm_id=domain_response.farm_id,
        assessments=assessment_responses,
        engine_version=domain_response.engine_version,
        snapshot_id=domain_response.snapshot_id,
        data_mode=domain_response.data_mode,
    )


@router.patch(
    "/farms/{farm_id}/actions/{action_id}",
    response_model=ActionCompletionResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthenticated"},
        404: {
            "model": ErrorResponse,
            "description": "Farm not found or owned by a different user",
        },
        422: {
            "model": ErrorResponse,
            "description": "Unknown action_id",
        },
    },
    summary="Mark an action recommendation as complete",
    description=(
        "Marks the specified action as complete for this farm. "
        "Idempotent — subsequent calls retain the original completion timestamp. "
        "Requirements: 7.4, 7.5, 8.1"
    ),
)
async def complete_farm_action(
    farm_id: UUID,
    action_id: str,
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_request_session),
) -> ActionCompletionResponse:
    """
    PATCH /api/v1/farms/{farm_id}/actions/{action_id}

    Upserts an ActionCompletion record. The original completion timestamp
    is preserved on repeated calls (idempotent).

    Requirements: 7.4, 7.5
    """
    completion: ActionCompletion = await risk_service.complete_action(
        session=session,
        principal=principal,
        farm_id=farm_id,
        action_id=action_id,
    )

    return ActionCompletionResponse(
        farm_id=str(completion.farm_id),
        action_id=completion.action_id,
        completed=True,
        completed_at=_normalize_dt(completion.completed_at),
    )
