"""
Tests for local demo setup command.

Requirements: 1.6, 4.3, 12.2

Tests verify:
- Idempotency (can run multiple times)
- Refuses authenticated/live databases
- Doesn't mix demo records with real-user storage
- Preserves fixture timestamps
- All demo responses remain labeled non-live after restart
"""

from datetime import datetime, timezone
from uuid import UUID

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import AuthMode, DataMode, Environment, Settings
from app.core.security import DEMO_ISSUER, DEMO_SUBJECT, DEMO_USER_UUID
from app.db.demo_setup import (
    check_installation_marker,
    create_demo_user,
    initialize_demo_marker,
    seed_demo_farms,
    setup_demo_database,
)
from app.models.farm import Farm, FarmGeometryRevision
from app.models.user import InstallationMetadata, InstallationMode, User


@pytest.mark.asyncio
async def test_initialize_demo_marker_creates_marker(session: AsyncSession):
    """Test that initialize_demo_marker creates the marker"""
    # Verify no marker exists
    existing_mode = await check_installation_marker(session)
    assert existing_mode is None
    
    # Initialize marker
    await initialize_demo_marker(session)
    
    # Verify marker was created
    result = await session.execute(select(InstallationMetadata))
    marker = result.scalar_one()
    assert marker.mode == InstallationMode.LOCAL_DEMO
    assert marker.id == 1


@pytest.mark.asyncio
async def test_initialize_demo_marker_is_idempotent(session: AsyncSession):
    """Test that initialize_demo_marker is idempotent"""
    # Initialize marker twice
    await initialize_demo_marker(session)
    await initialize_demo_marker(session)
    
    # Verify only one marker exists
    result = await session.execute(select(func.count()).select_from(InstallationMetadata))
    count = result.scalar_one()
    assert count == 1
    
    # Verify it's still local_demo
    result = await session.execute(select(InstallationMetadata))
    marker = result.scalar_one()
    assert marker.mode == InstallationMode.LOCAL_DEMO


@pytest.mark.asyncio
async def test_initialize_demo_marker_refuses_authenticated_database(session: AsyncSession):
    """Test that initialize_demo_marker refuses authenticated database"""
    # Create authenticated marker
    marker = InstallationMetadata(id=1, mode=InstallationMode.AUTHENTICATED)
    session.add(marker)
    await session.commit()
    
    # Attempt to initialize demo should fail
    with pytest.raises(RuntimeError, match="Cannot initialize demo on an authenticated database"):
        await initialize_demo_marker(session)
    
    # Verify marker is still authenticated
    result = await session.execute(select(InstallationMetadata))
    marker = result.scalar_one()
    assert marker.mode == InstallationMode.AUTHENTICATED


@pytest.mark.asyncio
async def test_create_demo_user_creates_fixed_user(session: AsyncSession):
    """Test that create_demo_user creates user with fixed UUID and identity"""
    demo_user = await create_demo_user(session)
    
    assert demo_user.id == DEMO_USER_UUID
    assert demo_user.issuer == DEMO_ISSUER
    assert demo_user.subject == DEMO_SUBJECT
    assert demo_user.email == "demo@farmtwin.local"
    assert demo_user.display_name == "Demo User"
    assert demo_user.preferences == {}


@pytest.mark.asyncio
async def test_create_demo_user_is_idempotent(session: AsyncSession):
    """Test that create_demo_user is idempotent"""
    # Create demo user twice
    user1 = await create_demo_user(session)
    user2 = await create_demo_user(session)
    
    # Should be the same user
    assert user1.id == user2.id == DEMO_USER_UUID
    
    # Verify only one user exists
    result = await session.execute(select(func.count()).select_from(User))
    count = result.scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_seed_demo_farms_creates_fixtures(session: AsyncSession):
    """Test that seed_demo_farms creates farm fixtures with historical timestamps"""
    # Create demo user first
    demo_user = await create_demo_user(session)
    
    # Seed farms
    await seed_demo_farms(session, demo_user)
    
    # Verify farms were created
    result = await session.execute(
        select(Farm).where(Farm.user_id == demo_user.id)
    )
    farms = result.scalars().all()
    
    assert len(farms) > 0
    for farm in farms:
        # Names should be marked as demo
        assert "[DEMO]" in farm.name
        
        # Timestamps should be historical (June 2025)
        assert farm.created_at.year == 2025
        assert farm.created_at.month == 6
        
        # Should have geometry revisions
        assert farm.current_geometry_revision == 1


@pytest.mark.asyncio
async def test_seed_demo_farms_preserves_historical_timestamps(session: AsyncSession):
    """Test that seed_demo_farms preserves historical fixture timestamps"""
    demo_user = await create_demo_user(session)
    await seed_demo_farms(session, demo_user)
    
    # Get farms and revisions
    result = await session.execute(
        select(Farm).where(Farm.user_id == demo_user.id)
    )
    farms = result.scalars().all()
    
    for farm in farms:
        # Farm timestamp should be historical
        historical_time = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert farm.created_at == historical_time
        assert farm.updated_at == historical_time
        
        # Get geometry revisions
        result = await session.execute(
            select(FarmGeometryRevision).where(FarmGeometryRevision.farm_id == farm.id)
        )
        revisions = result.scalars().all()
        
        for revision in revisions:
            # Revision timestamp should also be historical
            assert revision.created_at == historical_time


@pytest.mark.asyncio
async def test_seed_demo_farms_is_idempotent(session: AsyncSession):
    """Test that seed_demo_farms is idempotent"""
    demo_user = await create_demo_user(session)
    
    # Seed farms twice
    await seed_demo_farms(session, demo_user)
    await seed_demo_farms(session, demo_user)
    
    # Count farms - should not duplicate
    result = await session.execute(
        select(func.count()).select_from(Farm).where(Farm.user_id == demo_user.id)
    )
    count = result.scalar_one()
    
    # Should have the original fixtures, not duplicates
    # (exact count depends on fixture definition, but should be consistent)
    assert count == 2  # Based on current fixture definition


@pytest.mark.asyncio
async def test_seed_demo_farms_has_valid_geometry(session: AsyncSession):
    """Test that seeded farms have valid WGS84 geometry"""
    demo_user = await create_demo_user(session)
    await seed_demo_farms(session, demo_user)
    
    # Get geometry revisions
    result = await session.execute(select(FarmGeometryRevision))
    revisions = result.scalars().all()
    
    for revision in revisions:
        # Should have non-null geometry fields
        assert revision.geometry is not None
        assert revision.centroid is not None
        assert revision.label_point is not None
        
        # Hectares should be positive and finite
        assert revision.hectares > 0
        assert revision.hectares == revision.hectares  # NaN check


def test_setup_demo_database_refuses_wrong_auth_mode():
    """Test that setup validates auth mode before attempting database connection"""
    # Use OIDC mode which is incompatible with demo
    settings = Settings(
        environment="development",
        data_mode="demonstration",
        auth__mode="oidc",  # Wrong mode
        auth__issuer="https://example.com",
        auth__audience="farmtwin",
        auth__jwks_url="https://example.com/.well-known/jwks.json",
        auth__algorithms='["RS256"]',
        demo__local_only=True,
        demo__isolated_database=True,
        database__host="localhost",
        database__name="farmtwin_demo",
        database__user="demo_user",
        database__password="demo_pass",
    )
    
    # Should fail validation before attempting database connection
    import asyncio
    with pytest.raises(RuntimeError, match="Demo setup requires AUTH__MODE=local_demo"):
        asyncio.run(setup_demo_database(settings, seed_farms=False))


def test_setup_demo_database_refuses_wrong_environment():
    """Test that config validation rejects non-development environment for demo"""
    # Settings validation should reject this at config level
    from pydantic import ValidationError
    with pytest.raises(ValidationError, match="LOCAL_DEMO requires ENVIRONMENT=development"):
        Settings(
            environment="production",  # Wrong environment
            data_mode="demonstration",
            auth__mode="local_demo",
            demo__local_only=True,
            demo__isolated_database=True,
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="demo_user",
            database__password="demo_pass",
            _env_file=None,  # Don't read from .env
        )


def test_setup_demo_database_refuses_live_data_mode():
    """Test that config validation rejects live data mode for demo"""
    # Settings validation should reject this at config level
    from pydantic import ValidationError
    with pytest.raises(ValidationError, match="LOCAL_DEMO requires non-live DATA_MODE"):
        Settings(
            environment="development",
            data_mode="live",  # Wrong mode
            auth__mode="local_demo",
            demo__local_only=True,
            demo__isolated_database=True,
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="demo_user",
            database__password="demo_pass",
            _env_file=None,  # Don't read from .env
        )


def test_setup_demo_database_requires_local_only():
    """Test that config validation requires DEMO__LOCAL_ONLY=true for demo"""
    # Settings validation should catch this when auth mode is local_demo
    from pydantic import ValidationError
    with pytest.raises(ValidationError, match="LOCAL_DEMO requires DEMO__LOCAL_ONLY=true"):
        Settings(
            environment="development",
            data_mode="demonstration",
            auth__mode="local_demo",
            demo__local_only=False,  # Missing flag - validation should catch this
            demo__isolated_database=True,
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="demo_user",
            database__password="demo_pass",
            _env_file=None,  # Don't read from .env
        )


def test_setup_demo_database_requires_isolated_database():
    """Test that config validation requires DEMO__ISOLATED_DATABASE=true for demo"""
    # Settings validation should catch this when auth mode is local_demo
    from pydantic import ValidationError
    with pytest.raises(ValidationError, match="LOCAL_DEMO requires DEMO__ISOLATED_DATABASE=true"):
        Settings(
            environment="development",
            data_mode="demonstration",
            auth__mode="local_demo",
            demo__local_only=True,
            demo__isolated_database=False,  # Missing flag - validation should catch this
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="demo_user",
            database__password="demo_pass",
            _env_file=None,  # Don't read from .env
        )


@pytest.mark.asyncio
async def test_demo_fixtures_do_not_mix_with_real_users(session: AsyncSession):
    """Test that demo fixtures are isolated from real users"""
    # Create demo user and farms
    demo_user = await create_demo_user(session)
    await seed_demo_farms(session, demo_user)
    
    # Create a "real" user (simulated)
    real_user = User(
        issuer="https://real-provider.com",
        subject="real-user-123",
        email="real@example.com",
        display_name="Real User",
    )
    session.add(real_user)
    await session.commit()
    
    # Verify demo farms belong only to demo user
    result = await session.execute(
        select(Farm).where(Farm.user_id == demo_user.id)
    )
    demo_farms = result.scalars().all()
    assert len(demo_farms) > 0
    assert all(farm.user_id == demo_user.id for farm in demo_farms)
    
    # Verify real user has no farms
    result = await session.execute(
        select(Farm).where(Farm.user_id == real_user.id)
    )
    real_farms = result.scalars().all()
    assert len(real_farms) == 0
    
    # Verify demo user UUID is distinct
    assert demo_user.id != real_user.id


@pytest.mark.asyncio
async def test_complete_setup_is_idempotent(session: AsyncSession):
    """Test that complete demo setup can be run multiple times safely"""
    # Note: This test uses the session fixture which connects to a test database
    # We'll test individual components since setup_demo_database creates its own engine
    
    # Run setup steps twice
    await initialize_demo_marker(session)
    demo_user = await create_demo_user(session)
    await seed_demo_farms(session, demo_user)
    
    # Run again
    await initialize_demo_marker(session)
    demo_user2 = await create_demo_user(session)
    await seed_demo_farms(session, demo_user2)
    
    # Verify single marker
    result = await session.execute(select(func.count()).select_from(InstallationMetadata))
    marker_count = result.scalar_one()
    assert marker_count == 1
    
    # Verify single user
    result = await session.execute(select(func.count()).select_from(User))
    user_count = result.scalar_one()
    assert user_count == 1
    
    # Verify farms not duplicated
    result = await session.execute(
        select(func.count()).select_from(Farm).where(Farm.user_id == demo_user.id)
    )
    farm_count = result.scalar_one()
    assert farm_count == 2  # Original fixtures, not doubled
