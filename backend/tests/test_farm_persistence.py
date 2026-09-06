"""Phase 4 farm persistence properties and integration evidence."""

import asyncio
import uuid

import pytest
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select

from app.api.v1.farm_schemas import FarmCreate, FarmUpdate
from app.core.exceptions import (
    FarmDeleteConflict,
    IdempotencyConflict,
    StaleRevisionError,
)
from app.models.farm import Farm, FarmGeometryRevision
from app.models.user import User
from app.repositories.base import NotFoundError
from app.repositories.farm import FarmRepository
from app.services.farm_service import FarmService


BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[[36.80, -1.30], [36.805, -1.30], [36.805, -1.295], [36.80, -1.30]]],
}
BOUNDARY_2 = {
    "type": "Polygon",
    "coordinates": [[[36.80, -1.30], [36.806, -1.30], [36.806, -1.294], [36.80, -1.30]]],
}
BOUNDARY_3 = {
    "type": "Polygon",
    "coordinates": [[[36.80, -1.30], [36.807, -1.30], [36.807, -1.293], [36.80, -1.30]]],
}


async def _user(session_factory, subject: str) -> User:
    async with session_factory() as session:
        user = User(
            id=uuid.uuid4(),
            issuer="phase-4-tests",
            subject=subject,
            email=f"{subject}@example.test",
            display_name=subject,
        )
        session.add(user)
        await session.commit()
        return user


@pytest.mark.asyncio
async def test_property_1_persistence_round_trip_after_new_session(session_factory):
    user = await _user(session_factory, "round-trip")
    async with session_factory() as session:
        result = await FarmService(session, user.id).create_farm_request(
            FarmCreate(name="Persistent Farm", geometry=BOUNDARY)
        )
        farm_id = result.farm.id
        expected_area = result.farm.current_geometry.hectares

    async with session_factory() as restarted_session:
        farm = await FarmService(restarted_session, user.id).get_farm(farm_id)
        assert farm.name == "Persistent Farm"
        assert farm.current_geometry_revision == 1
        assert farm.current_geometry.hectares == pytest.approx(expected_area)
        assert to_shape(farm.current_geometry.geometry).__geo_interface__["coordinates"]


@pytest.mark.asyncio
async def test_property_8_idempotent_creation_and_payload_conflict(session_factory):
    user = await _user(session_factory, "idempotency")
    key = uuid.uuid4()
    async with session_factory() as session:
        service = FarmService(session, user.id)
        first = await service.create_farm_request(
            FarmCreate(name="Same Farm", geometry=BOUNDARY), key
        )
        second = await service.create_farm_request(
            FarmCreate(name="Same Farm", geometry=BOUNDARY), key
        )
        assert first.created is True
        assert second.created is False
        assert first.farm.id == second.farm.id

        with pytest.raises(IdempotencyConflict):
            await service.create_farm_request(
                FarmCreate(name="Different Farm", geometry=BOUNDARY), key
            )

    async with session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(Farm))
        revision_count = await session.scalar(
            select(func.count()).select_from(FarmGeometryRevision)
        )
        assert count == revision_count == 1


@pytest.mark.asyncio
async def test_property_6_revision_monotonicity_and_name_only_update(session_factory):
    user = await _user(session_factory, "revisions")
    async with session_factory() as session:
        service = FarmService(session, user.id)
        created = await service.create_farm_request(
            FarmCreate(name="Revision Farm", geometry=BOUNDARY)
        )
        farm_id = created.farm.id
        for expected, geometry in enumerate((BOUNDARY_2, BOUNDARY_3), start=1):
            farm = await service.update_farm_request(
                farm_id,
                FarmUpdate(geometry=geometry, expected_revision=expected),
            )
            assert farm.current_geometry_revision == expected + 1
            assert farm.current_geometry.revision == expected + 1

        renamed = await service.update_farm_request(
            farm_id, FarmUpdate(name="Renamed Farm")
        )
        assert renamed.name == "Renamed Farm"
        assert renamed.current_geometry_revision == 3


@pytest.mark.asyncio
async def test_property_7_stale_write_does_not_change_geometry(session_factory):
    user = await _user(session_factory, "stale")
    async with session_factory() as session:
        service = FarmService(session, user.id)
        created = await service.create_farm_request(
            FarmCreate(name="Stale Farm", geometry=BOUNDARY)
        )
        farm_id = created.farm.id
        with pytest.raises(StaleRevisionError):
            await service.update_farm_request(
                farm_id,
                FarmUpdate(geometry=BOUNDARY_2, expected_revision=2),
            )

    async with session_factory() as session:
        farm = await FarmService(session, user.id).get_farm(farm_id)
        assert farm.current_geometry_revision == 1
        count = await session.scalar(
            select(func.count()).select_from(FarmGeometryRevision)
        )
        assert count == 1


@pytest.mark.asyncio
async def test_property_2_all_writes_are_owner_isolated(session_factory):
    owner = await _user(session_factory, "owner")
    outsider = await _user(session_factory, "outsider")
    async with session_factory() as session:
        created = await FarmService(session, owner.id).create_farm_request(
            FarmCreate(name="Private Farm", geometry=BOUNDARY)
        )
        farm_id = created.farm.id

    async with session_factory() as session:
        service = FarmService(session, outsider.id)
        with pytest.raises(NotFoundError):
            await service.update_farm_request(farm_id, FarmUpdate(name="Stolen"))
        with pytest.raises(NotFoundError):
            await service.update_farm_request(
                farm_id,
                FarmUpdate(geometry=BOUNDARY_2, expected_revision=1),
            )
        with pytest.raises(NotFoundError):
            await service.delete_farm(farm_id)


@pytest.mark.asyncio
async def test_concurrent_patch_allows_exactly_one_revision(session_factory):
    user = await _user(session_factory, "concurrent")
    async with session_factory() as session:
        created = await FarmService(session, user.id).create_farm_request(
            FarmCreate(name="Concurrent Farm", geometry=BOUNDARY)
        )
        farm_id = created.farm.id

    async def update_one(geometry):
        async with session_factory() as session:
            try:
                await FarmService(session, user.id).update_farm_request(
                    farm_id,
                    FarmUpdate(geometry=geometry, expected_revision=1),
                )
                return "ok"
            except StaleRevisionError:
                return "stale"

    outcomes = await asyncio.gather(update_one(BOUNDARY_2), update_one(BOUNDARY_3))
    assert sorted(outcomes) == ["ok", "stale"]


@pytest.mark.asyncio
async def test_delete_blocker_and_successful_delete(session_factory, monkeypatch):
    user = await _user(session_factory, "delete")
    async with session_factory() as session:
        created = await FarmService(session, user.id).create_farm_request(
            FarmCreate(name="Delete Farm", geometry=BOUNDARY)
        )
        farm_id = created.farm.id

    async def blocked(self, target_id):
        return ["analysis_snapshots"]

    monkeypatch.setattr(FarmRepository, "_blocking_resource_types", blocked)
    async with session_factory() as session:
        with pytest.raises(FarmDeleteConflict) as error:
            await FarmService(session, user.id).delete_farm(farm_id)
        assert "analysis_snapshots" in error.value.details[0].message

    monkeypatch.undo()
    async with session_factory() as session:
        await FarmService(session, user.id).delete_farm(farm_id)
    async with session_factory() as session:
        with pytest.raises(NotFoundError):
            await FarmService(session, user.id).get_farm(farm_id)
