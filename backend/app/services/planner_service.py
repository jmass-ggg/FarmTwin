"""
Planner service for the Annual Planner feature (Phase 8).

Manages Plan_Entry persistence, overlap validation, harvest date derivation,
12-month crop recommendations, and Change_Proposal acceptance.

Requirements: 1.1, 1.2, 2.1–2.6, 3.1–3.4, 4.3, 4.4
"""

from __future__ import annotations

import calendar
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from geoalchemy2.shape import to_shape
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import FarmValidationError, NotFoundError
from app.core.security import Principal
from app.domain.crop_engine import ENGINE_VERSION, rank_all
from app.domain.crop_register import CROP_REGISTER
from app.domain.snapshot_context import context_from_demonstration, context_from_snapshot
from app.models.farm import Farm
from app.models.plan import ChangeProposal, PlanEntry, ProposalStatus
from app.models.snapshot import AnalysisSnapshot
from app.repositories.farm import FarmRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Response dataclasses (lightweight, no ORM coupling)
# ---------------------------------------------------------------------------


@dataclass
class MonthRecommendation:
    """Top-3 crop recommendations for a single calendar month."""

    month: int
    month_name: str
    data_mode: str
    snapshot_id: str | None
    recommendations: list[dict]  # top-3 ranked results as dicts


@dataclass
class AnnualPlanResponse:
    """All 12 monthly recommendations plus saved entries and proposals."""

    farm_id: str
    year: int
    months: list[MonthRecommendation]  # exactly 12
    entries: list[PlanEntry]
    proposals: list[ChangeProposal]


@dataclass
class PlanEntryCreate:
    """Input data for creating a new PlanEntry."""

    crop_name: str
    planting_date: date
    cultivation_mode: str
    irrigation_mm: float | None
    area_ha: float


@dataclass
class PlanEntryUpdate:
    """Input data for updating an existing PlanEntry."""

    planting_date: date | None = None
    cultivation_mode: str | None = None
    irrigation_mm: float | None = None
    area_ha: float | None = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _derive_harvest_date(planting_date: date, crop_name: str) -> date:
    """
    Derive harvest_date from planting_date + crop.duration_months.

    Finds the crop in CROP_REGISTER (case-insensitive) and adds
    duration_months calendar months to planting_date.  Cross-year
    boundaries are handled correctly by calendar arithmetic.

    Requirements: 3.1, 3.2
    """
    crop = next(
        (c for c in CROP_REGISTER if c.name.lower() == crop_name.lower()),
        None,
    )
    if crop is None:
        raise FarmValidationError(
            field="body.crop_name",
            detail_code="INVALID_VALUE",
            message=f"Unknown crop name: {crop_name!r}",
        )

    # Add duration_months to planting_date using calendar arithmetic
    month = planting_date.month + crop.duration_months
    year = planting_date.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    # Use last day of month if the day exceeds month length
    max_day = calendar.monthrange(year, month)[1]
    day = min(planting_date.day, max_day)
    return date(year, month, day)


async def _load_latest_snapshot(
    session: AsyncSession,
    farm_id: UUID,
    geometry_revision: int,
) -> AnalysisSnapshot | None:
    """Return the latest completed snapshot for the farm, or None."""
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


async def _check_overlap(
    session: AsyncSession,
    farm_id: UUID,
    planting_date: date,
    harvest_date: date,
    exclude_entry_id: UUID | None = None,
) -> PlanEntry | None:
    """
    Return the first existing entry whose date range overlaps [planting_date, harvest_date].

    Two ranges [a, b] and [c, d] overlap when a < d AND c < b.

    Requirements: 2.2, 2.3, 3.3
    """
    stmt = (
        select(PlanEntry)
        .where(
            PlanEntry.farm_id == farm_id,
            PlanEntry.planting_date < harvest_date,
            PlanEntry.harvest_date > planting_date,
        )
    )
    if exclude_entry_id is not None:
        stmt = stmt.where(PlanEntry.id != exclude_entry_id)

    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _fetch_farm(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
) -> Farm:
    """Load a farm with ownership check; raises NotFoundError for wrong owner."""
    repo = FarmRepository(session, principal.user_id)
    return await repo.get_by_id(farm_id)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


async def get_annual_plan(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    year: int,
) -> AnnualPlanResponse:
    """
    Build the annual plan response.

    For each of the 12 calendar months:
    - Build a SnapshotContext (snapshot-backed when available, else demonstration).
    - Rank all crops and take top 3.

    Overlay saved PlanEntry rows for the given farm and year.
    Include pending Change_Proposals for the farm.

    Requirements: 1.1, 1.2, 1.3, 1.4
    """
    farm = await _fetch_farm(session, principal, farm_id)
    centroid = to_shape(farm.current_geometry.centroid)

    # Attempt to load latest snapshot (shared across all 12 months)
    snapshot = await _load_latest_snapshot(
        session, farm.id, farm.current_geometry_revision
    )

    months: list[MonthRecommendation] = []
    for month in range(1, 13):
        if snapshot is not None:
            # Use a default crop_duration of 4 months for building the monthly context
            context = context_from_snapshot(snapshot, month, 4)
        else:
            context = context_from_demonstration(
                latitude=centroid.y,
                longitude=centroid.x,
                planting_month=month,
            )

        ranked = rank_all(context)
        top3 = [
            {
                "crop_name": r.crop_name,
                "suitability_index": r.suitability_index,
                "label": r.label,
                "limiting_factor": r.limiting_factor,
            }
            for r in ranked[:3]
        ]

        months.append(
            MonthRecommendation(
                month=month,
                month_name=calendar.month_name[month],
                data_mode=context.data_mode,
                snapshot_id=context.snapshot_id,
                recommendations=top3,
            )
        )

    # Load saved entries for this farm and year
    entries_result = await session.execute(
        select(PlanEntry)
        .where(
            PlanEntry.farm_id == farm.id,
        )
        .order_by(PlanEntry.planting_date)
    )
    entries = list(entries_result.scalars().all())

    # Filter entries to the requested year (planting_date year or harvest_date year)
    year_entries = [
        e for e in entries
        if e.planting_date.year == year or e.harvest_date.year == year
    ]

    # Load pending proposals for this farm
    proposals_result = await session.execute(
        select(ChangeProposal)
        .where(
            ChangeProposal.farm_id == farm.id,
            ChangeProposal.status == ProposalStatus.PENDING,
        )
        .order_by(ChangeProposal.issue_date)
    )
    proposals = list(proposals_result.scalars().all())

    return AnnualPlanResponse(
        farm_id=str(farm.id),
        year=year,
        months=months,
        entries=year_entries,
        proposals=proposals,
    )


async def create_entry(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    data: PlanEntryCreate,
) -> PlanEntry:
    """
    Create a new PlanEntry with overlap validation and harvest date derivation.

    Steps:
    1. Ownership check on farm.
    2. Resolve crop from register; derive harvest_date.
    3. Validate no overlap with existing entries.
    4. Persist and return new entry.

    Requirements: 2.1, 2.2, 2.3, 3.1, 3.2
    """
    farm = await _fetch_farm(session, principal, farm_id)

    # Derive harvest date from planting_date + crop.duration_months (Req 3.1)
    harvest_date = _derive_harvest_date(data.planting_date, data.crop_name)

    # Overlap check (Req 2.2, 2.3, 3.3)
    conflicting = await _check_overlap(
        session, farm.id, data.planting_date, harvest_date
    )
    if conflicting is not None:
        raise FarmValidationError(
            field="body.planting_date",
            detail_code="OVERLAP_CONFLICT",
            message=(
                f"Planting window [{data.planting_date} – {harvest_date}] overlaps "
                f"with existing entry {conflicting.id} "
                f"[{conflicting.planting_date} – {conflicting.harvest_date}]"
            ),
        )

    # Load snapshot to capture data_mode and snapshot_id at save time
    snapshot = await _load_latest_snapshot(
        session, farm.id, farm.current_geometry_revision
    )

    # Build context for suitability score at save time
    from geoalchemy2.shape import to_shape as _to_shape
    centroid = _to_shape(farm.current_geometry.centroid)
    crop_obj = next(
        c for c in CROP_REGISTER if c.name.lower() == data.crop_name.lower()
    )
    if snapshot is not None:
        context = context_from_snapshot(snapshot, data.planting_date.month, crop_obj.duration_months)
    else:
        context = context_from_demonstration(
            latitude=centroid.y,
            longitude=centroid.x,
            planting_month=data.planting_date.month,
        )

    from app.domain.crop_engine import score as _score
    result = _score(crop_obj, context)

    entry = PlanEntry(
        farm_id=farm.id,
        crop_name=crop_obj.name,
        planting_date=data.planting_date,
        harvest_date=harvest_date,
        cultivation_mode=data.cultivation_mode,
        irrigation_mm=data.irrigation_mm,
        area_ha=data.area_ha,
        snapshot_id=snapshot.id if snapshot is not None else None,
        data_mode=context.data_mode,
        suitability_index=result.suitability_index,
        engine_version=ENGINE_VERSION,
    )
    session.add(entry)
    await session.flush()
    await session.refresh(entry)
    await session.commit()
    return entry


async def update_entry(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    entry_id: UUID,
    data: PlanEntryUpdate,
) -> PlanEntry:
    """
    Update an existing PlanEntry; re-validates overlap.

    Requirements: 2.5, 3.3
    """
    farm = await _fetch_farm(session, principal, farm_id)

    result = await session.execute(
        select(PlanEntry).where(
            PlanEntry.id == entry_id,
            PlanEntry.farm_id == farm.id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise NotFoundError(f"Plan entry {entry_id} not found")

    # Apply updates
    new_planting = data.planting_date if data.planting_date is not None else entry.planting_date
    new_cultivation = data.cultivation_mode if data.cultivation_mode is not None else entry.cultivation_mode
    new_irrigation = data.irrigation_mm if data.irrigation_mm is not None else entry.irrigation_mm
    new_area = data.area_ha if data.area_ha is not None else entry.area_ha

    # Re-derive harvest date if planting date changed
    new_harvest = _derive_harvest_date(new_planting, entry.crop_name)

    # Overlap check (excluding this entry itself)
    conflicting = await _check_overlap(
        session, farm.id, new_planting, new_harvest, exclude_entry_id=entry_id
    )
    if conflicting is not None:
        raise FarmValidationError(
            field="body.planting_date",
            detail_code="OVERLAP_CONFLICT",
            message=(
                f"Updated planting window [{new_planting} – {new_harvest}] overlaps "
                f"with existing entry {conflicting.id} "
                f"[{conflicting.planting_date} – {conflicting.harvest_date}]"
            ),
        )

    entry.planting_date = new_planting
    entry.harvest_date = new_harvest
    entry.cultivation_mode = new_cultivation
    entry.irrigation_mm = new_irrigation
    entry.area_ha = new_area

    await session.flush()
    await session.refresh(entry)
    await session.commit()
    return entry


async def delete_entry(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    entry_id: UUID,
) -> None:
    """
    Delete a PlanEntry; ownership-scoped.

    Requirements: 2.6
    """
    farm = await _fetch_farm(session, principal, farm_id)

    result = await session.execute(
        select(PlanEntry).where(
            PlanEntry.id == entry_id,
            PlanEntry.farm_id == farm.id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise NotFoundError(f"Plan entry {entry_id} not found")

    await session.delete(entry)
    await session.flush()
    await session.commit()


async def accept_proposal(
    session: AsyncSession,
    principal: Principal,
    farm_id: UUID,
    proposal_id: UUID,
) -> PlanEntry:
    """
    Accept a Change_Proposal: update the linked PlanEntry's suitability index
    and mark the proposal as accepted.

    Requirements: 4.3, 4.4
    """
    farm = await _fetch_farm(session, principal, farm_id)

    # Load proposal (ownership-scoped via farm_id)
    result = await session.execute(
        select(ChangeProposal).where(
            ChangeProposal.id == proposal_id,
            ChangeProposal.farm_id == farm.id,
            ChangeProposal.status == ProposalStatus.PENDING,
        )
    )
    proposal = result.scalar_one_or_none()
    if proposal is None:
        raise NotFoundError(f"Change proposal {proposal_id} not found or not pending")

    # Load the linked entry
    entry_result = await session.execute(
        select(PlanEntry).where(PlanEntry.id == proposal.entry_id)
    )
    entry = entry_result.scalar_one_or_none()
    if entry is None:
        raise NotFoundError(f"Plan entry {proposal.entry_id} not found")

    # Apply the proposal's new recommendation
    entry.suitability_index = proposal.new_suitability_index
    entry.snapshot_id = proposal.new_snapshot_id

    # Mark proposal as accepted (Req 4.3)
    proposal.status = ProposalStatus.ACCEPTED

    await session.flush()
    await session.refresh(entry)
    await session.commit()
    return entry
