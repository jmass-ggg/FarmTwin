"""
Pydantic schemas for the Risk Center API.

Requirements: 8.5
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.api.schemas import ReadBaseSchema


# ---------------------------------------------------------------------------
# Action rule
# ---------------------------------------------------------------------------


class ActionRuleResponse(ReadBaseSchema):
    """
    A single reviewed action recommendation attached to a hazard assessment.

    Requirements: 7.2, 8.5
    """

    id: str = Field(description="Rule identifier, e.g. 'drought-irrigate-or-mulch'")
    priority: int = Field(description="Rule priority; 1 = highest")
    text: str = Field(description="Recommendation text")
    source: str = Field(description="Reviewed agronomic source")
    review_date: str = Field(description="ISO date string when this rule was last reviewed")
    completed: bool = Field(
        default=False,
        description="True when the farmer has marked this action as complete",
    )
    completed_at: datetime | None = Field(
        default=None,
        description="UTC timestamp when the action was first marked complete, or null",
    )


# ---------------------------------------------------------------------------
# Hazard assessment
# ---------------------------------------------------------------------------


class HazardAssessmentResponse(ReadBaseSchema):
    """
    Assessment for a single hazard type.

    Requirements: 1.3, 1.4, 1.5, 8.2, 8.5
    """

    hazard: str = Field(
        description="Hazard type: drought | heat | heavy_rainfall | flood_exposure | wind"
    )
    index: int = Field(description="Hazard intensity index (0–100)", ge=0, le=100)
    level: Literal["Low", "Medium", "High", "Unknown"] = Field(
        description="Qualitative hazard level"
    )
    driver: str = Field(description="Primary evidence driver name")
    explanation: str = Field(description="Plain-language explanation of the hazard level")
    horizon: str = Field(
        description="Assessment time horizon: current | short_term | seasonal"
    )
    at_risk_crops: list[str] = Field(
        description="Crops near heat tolerance ceiling (heat hazard only; empty otherwise)"
    )
    actions: list[ActionRuleResponse] = Field(
        description="Resolved action recommendations (non-empty for Medium/High levels)"
    )
    evidence_used: dict[str, str] = Field(
        description="Per-field evidence status: 'real' | 'demonstration' | 'missing'"
    )
    engine_version: str = Field(description="Engine identifier, e.g. 'farmtwin-risk-v1'")
    snapshot_id: str | None = Field(
        description="Snapshot UUID used as evidence basis, or null for demonstration fallback"
    )
    data_mode: str = Field(
        description="Evidence mode: 'live' | 'historical_replay' | 'demonstration'"
    )


# ---------------------------------------------------------------------------
# Risk response
# ---------------------------------------------------------------------------


class RiskResponse(ReadBaseSchema):
    """
    Aggregated risk response with all 5 hazard assessments.

    Requirements: 1.3, 8.2, 8.5
    """

    farm_id: str = Field(description="Farm UUID")
    assessments: list[HazardAssessmentResponse] = Field(
        description="Five hazard assessments (Drought, Heat, Heavy Rainfall, Flood Exposure, Wind)"
    )
    engine_version: str = Field(description="Engine identifier")
    snapshot_id: str | None = Field(
        description="Snapshot UUID when real data is used, or null for demonstration fallback"
    )
    data_mode: str = Field(
        description="Evidence mode for the overall assessment"
    )


# ---------------------------------------------------------------------------
# Action completion
# ---------------------------------------------------------------------------


class ActionCompletionRequest(ReadBaseSchema):
    """
    Request body for PATCH /api/v1/farms/{farm_id}/actions/{action_id}.

    Currently no body fields are required — the action_id comes from the path.
    Kept for forward compatibility.

    Requirements: 7.4
    """

    pass


class ActionCompletionResponse(ReadBaseSchema):
    """
    Response from marking an action as complete.

    Requirements: 7.4, 7.5
    """

    farm_id: str = Field(description="Farm UUID")
    action_id: str = Field(description="Action rule identifier")
    completed: bool = Field(description="Always True when returned from a PATCH")
    completed_at: datetime = Field(
        description="UTC timestamp when the action was first marked complete"
    )
