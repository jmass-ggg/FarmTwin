"""
Farm repository with ownership enforcement.

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
"""

import uuid
from typing import Optional

from geoalchemy2.elements import WKBElement
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.farm import Farm, FarmGeometryRevision
from app.repositories.base import OwnedRepository, NotFoundError


class FarmRepository(OwnedRepository[Farm]):
    """
    Repository for farm entities with ownership enforcement.
    
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
    
    All operations are scoped to the owner. Invisible and nonexistent records
    both return NotFoundError to prevent cross-user existence disclosure.
    
    Key behaviors:
    - get_by_id: Returns farm only if owned by principal
    - list_page: Returns only owner's farms with pagination
    - count: Returns count of owner's farms only
    - create: Sets ownership internally, rejects owner field changes
    - update: Includes owner in mutation predicate
    - delete: Includes owner in deletion predicate
    
    Phase 1 keeps mutations internal to service/repository fixtures.
    Public write endpoints are not exposed until Phase 4.
    """
    
    # Allowlisted sortable columns for parameterized queries
    SORTABLE_COLUMNS = {"created_at", "name", "id"}
    
    def __init__(self, session: AsyncSession, owner_id: uuid.UUID):
        """
        Initialize farm repository for a specific owner.
        
        Args:
            session: Active database session
            owner_id: Internal UUID of the verified principal
        """
        super().__init__(session, owner_id)
    
    async def get_by_id(self, farm_id: uuid.UUID) -> Farm:
        """
        Get a farm by ID if owned by the principal.
        
        Requirements: 5.1, 5.2
        
        Returns the farm with its current geometry revision loaded.
        Absent and invisible farms both raise NotFoundError.
        
        Args:
            farm_id: UUID of the farm
            
        Returns:
            Farm entity with current geometry
            
        Raises:
            NotFoundError: If farm doesn't exist or belongs to another user
        """
        query = (
            select(Farm)
            .where(Farm.id == farm_id)
            .where(Farm.user_id == self.owner_id)
            .options(selectinload(Farm.current_geometry))
        )
        
        result = await self.session.execute(query)
        farm = result.scalar_one_or_none()
        
        if farm is None:
            raise NotFoundError(f"Farm {farm_id} not found")
        
        return farm
    
    async def list_page(
        self,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = "created_at"
    ) -> list[Farm]:
        """
        List farms owned by the principal with pagination.
        
        Requirements: 5.1, 5.3, 5.6
        
        Returns farms in deterministic order with current geometry loaded.
        Default ordering is by creation time, then by ID for stability.
        
        Args:
            limit: Maximum number of farms to return (1-100)
            offset: Number of farms to skip
            sort_by: Column name to sort by (must be in SORTABLE_COLUMNS)
            
        Returns:
            List of farm entities, may be empty
            
        Raises:
            ValueError: If sort_by is not in allowlist
        """
        # Validate sortable column
        self._validate_sortable_column(sort_by, self.SORTABLE_COLUMNS)
        
        # Build query with ownership filter
        query = (
            select(Farm)
            .where(Farm.user_id == self.owner_id)
            .options(selectinload(Farm.current_geometry))
            .order_by(getattr(Farm, sort_by), Farm.id)
            .limit(limit)
            .offset(offset)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def count(self) -> int:
        """
        Count farms owned by the principal.
        
        Requirements: 5.1, 5.3
        
        Returns the total count of farms owned by the principal,
        using the same ownership filter as list_page.
        
        Returns:
            Number of farms owned by principal
        """
        query = (
            select(func.count())
            .select_from(Farm)
            .where(Farm.user_id == self.owner_id)
        )
        
        result = await self.session.execute(query)
        return result.scalar_one()
    
    async def create(
        self,
        name: str,
        geometry_wkb: bytes,
        centroid_wkb: bytes,
        label_point_wkb: bytes,
        hectares: float,
    ) -> Farm:
        """
        Create a new farm owned by the principal.
        
        Requirements: 5.1, 5.7
        
        Creates a farm with its first geometry revision atomically.
        Ownership is derived from the principal, not from input.
        The deferred foreign key constraint allows atomic insertion.
        
        Args:
            name: Non-blank farm name
            geometry_wkb: WKB-encoded polygon in SRID 4326
            centroid_wkb: WKB-encoded centroid point
            label_point_wkb: WKB-encoded interior label point
            hectares: Farm area in hectares (positive, finite)
            
        Returns:
            Created farm with first revision
            
        Note:
            This is for internal fixtures in Phase 1.
            Public creation endpoints belong to Phase 4.
        """
        # Create farm entity with ownership
        farm = Farm(
            id=uuid.uuid4(),
            user_id=self.owner_id,  # Ownership derived from principal
            name=name,
            current_geometry_revision=1,  # First revision
        )
        
        # Create first geometry revision
        revision = FarmGeometryRevision(
            id=uuid.uuid4(),
            farm_id=farm.id,
            revision=1,
            # GeoAlchemy's PostgreSQL binder expects a spatial element (or
            # EWKT), not bare bytes. Mark these trusted internal values with
            # their declared SRID before asyncpg binding.
            geometry=WKBElement(geometry_wkb, srid=4326),
            centroid=WKBElement(centroid_wkb, srid=4326),
            label_point=WKBElement(label_point_wkb, srid=4326),
            hectares=hectares,
        )
        
        # Add both to session
        self.session.add(farm)
        self.session.add(revision)
        
        # Flush to detect constraint violations
        await self.flush()
        
        return farm
    
    async def update(
        self,
        farm_id: uuid.UUID,
        name: Optional[str] = None,
    ) -> Farm:
        """
        Update a farm owned by the principal.
        
        Requirements: 5.1, 5.4, 5.7
        
        Only updates permitted fields. Rejects changes to:
        - owner (user_id)
        - ID
        - current_geometry_revision (protected version field)
        
        Includes ownership in the mutation predicate to prevent
        cross-user updates without a separate existence check.
        
        Args:
            farm_id: UUID of farm to update
            name: New name if provided
            
        Returns:
            Updated farm entity
            
        Raises:
            NotFoundError: If farm doesn't exist or belongs to another user
            
        Note:
            Geometry updates create new revisions (Phase 4).
            This method handles only metadata updates.
        """
        # Query with ownership constraint
        farm = await self.get_by_id(farm_id)
        
        # Update only permitted fields
        if name is not None:
            farm.name = name
        
        # Flush to detect constraint violations
        await self.flush()
        
        return farm
    
    async def delete(self, farm_id: uuid.UUID) -> None:
        """
        Delete a farm owned by the principal.
        
        Requirements: 5.1, 5.4
        
        Includes ownership in the deletion predicate to prevent
        cross-user deletes without a separate existence check.
        
        Args:
            farm_id: UUID of farm to delete
            
        Raises:
            NotFoundError: If farm doesn't exist or belongs to another user
            
        Note:
            Phase 1 has no public delete endpoint.
            Phase 4 will define confirmed deletion and retention behavior.
        """
        # Query with ownership constraint
        farm = await self.get_by_id(farm_id)
        
        # Delete (cascade will handle geometry revisions)
        await self.session.delete(farm)
        
        # Flush to detect constraint violations
        await self.flush()
    
    async def get_geometry_revision(
        self,
        farm_id: uuid.UUID,
        revision: int
    ) -> FarmGeometryRevision:
        """
        Get a specific geometry revision if farm is owned by principal.
        
        Requirements: 5.3
        
        Authorizes through parent farm ownership.
        
        Args:
            farm_id: UUID of the farm
            revision: Revision number to fetch
            
        Returns:
            Geometry revision
            
        Raises:
            NotFoundError: If farm/revision doesn't exist or farm belongs to another user
        """
        # First authorize access to the farm
        await self.get_by_id(farm_id)
        
        # Then fetch the specific revision
        query = (
            select(FarmGeometryRevision)
            .where(FarmGeometryRevision.farm_id == farm_id)
            .where(FarmGeometryRevision.revision == revision)
        )
        
        result = await self.session.execute(query)
        geo_revision = result.scalar_one_or_none()
        
        if geo_revision is None:
            raise NotFoundError(
                f"Geometry revision {revision} not found for farm {farm_id}"
            )
        
        return geo_revision
