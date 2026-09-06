#!/usr/bin/env python3
"""
Quick verification script for Phase 1 models.
This script verifies that all models can be imported and have the expected structure.
"""

import sys

try:
    from app.models import (
        Base,
        CreatedAtMixin,
        Farm,
        FarmGeometryRevision,
        InstallationMetadata,
        InstallationMode,
        OwnershipMixin,
        TimestampMixin,
        User,
        UUIDMixin,
    )

    print("✓ All models imported successfully")

    # Verify Base has metadata
    assert hasattr(Base, "metadata"), "Base should have metadata"
    print("✓ Base has metadata")

    # Verify User model structure
    assert hasattr(User, "__tablename__"), "User should have __tablename__"
    assert User.__tablename__ == "users", "User tablename should be 'users'"
    assert hasattr(User, "issuer"), "User should have issuer field"
    assert hasattr(User, "subject"), "User should have subject field"
    assert hasattr(User, "email"), "User should have email field"
    assert hasattr(User, "display_name"), "User should have display_name field"
    assert hasattr(User, "preferences"), "User should have preferences field"
    print("✓ User model structure verified")

    # Verify InstallationMetadata model structure
    assert hasattr(InstallationMetadata, "__tablename__")
    assert InstallationMetadata.__tablename__ == "installation_metadata"
    assert hasattr(InstallationMetadata, "mode")
    print("✓ InstallationMetadata model structure verified")

    # Verify Farm model structure
    assert hasattr(Farm, "__tablename__")
    assert Farm.__tablename__ == "farms"
    assert hasattr(Farm, "user_id"), "Farm should have user_id field"
    assert hasattr(Farm, "name"), "Farm should have name field"
    assert hasattr(Farm, "current_geometry_revision")
    print("✓ Farm model structure verified")

    # Verify FarmGeometryRevision model structure
    assert hasattr(FarmGeometryRevision, "__tablename__")
    assert FarmGeometryRevision.__tablename__ == "farm_geometry_revisions"
    assert hasattr(FarmGeometryRevision, "farm_id")
    assert hasattr(FarmGeometryRevision, "revision")
    assert hasattr(FarmGeometryRevision, "geometry")
    assert hasattr(FarmGeometryRevision, "centroid")
    assert hasattr(FarmGeometryRevision, "label_point")
    assert hasattr(FarmGeometryRevision, "hectares")
    print("✓ FarmGeometryRevision model structure verified")

    # Verify mixins
    print("✓ UUIDMixin available")
    print("✓ TimestampMixin available")
    print("✓ CreatedAtMixin available")
    print("✓ OwnershipMixin available")

    print("\n✅ All model verifications passed!")
    sys.exit(0)

except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)
except AssertionError as e:
    print(f"❌ Assertion failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1)
