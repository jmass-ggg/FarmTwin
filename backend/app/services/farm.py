"""
Farm service with transaction boundaries.

Requirements: 5.4, 6.8, 10.8
"""

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import FarmRepository, NotFoundError
from app.services.base import BaseService


class FarmService(BaseService):
    """
    Farm service coordinating repository operations within transactions.
    
    Requirements: 5.4, 6.8, 10.8
    
    Services own transaction boundaries and coordinate repository operations.
    Repositories flush to detect constraint violations but never commit independently.
    Response data is materialized before commit, and success is returned only after commit.
    
    Phase 1 keeps farm mutations internal to service/repository verification fixtures.
    Public create/edit/delete routes are not exposed until Phase 4.
    """
    
    def __init__(self, session: AsyncSession, owner_id: uuid.UUID):
        """
        Initialize farm service for a specific owner.
        
        Args:
            session: Active database session
            owner_id: Internal UUID of the verified principal
        """
        super().__init__(session)
        self.owner_id = owner_id
        self.repository = FarmRepository(session, owner_id)
    
    async def get_farm(self, farm_id: uuid.UUID):
        """
        Get a farm by ID.
        
        Requirements: 5.4
        
        Read operation - no explicit transaction needed as session handles it.
        Farm is materialized with current geometry before returning.
        
        Args:
            farm_id: UUID of the farm
            
        Returns:
            Farm entity with current geometry
            
        Raises:
            NotFoundError: If farm doesn't exist or belongs to another user
        """
        farm = await self.repository.get_by_id(farm_id)
        # Read operations automatically materialize relationships via selectinload
        return farm
    
    async def list_farms(
        self,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = "created_at"
    ):
        """
        List farms with pagination.
        
        Requirements: 5.4
        
        Read operation with ownership-scoped pagination.
        Returns materialized farms with current geometry.
        
        Args:
            limit: Maximum number of farms to return (1-100)
            offset: Number of farms to skip
            sort_by: Column name to sort by
            
        Returns:
            Tuple of (farms list, total count)
        """
        farms = await self.repository.list_page(limit, offset, sort_by)
        total = await self.repository.count()
        return farms, total
    
    async def create_farm(
        self,
        name: str,
        geometry_wkb: bytes,
        centroid_wkb: bytes,
        label_point_wkb: bytes,
        hectares: float,
    ):
        """
        Create a new farm with first geometry revision.
        
        Requirements: 5.4, 6.8, 10.8
        
        Write operation within explicit transaction:
        1. Repository creates farm and first revision
        2. Flush to detect constraint violations
        3. Materialize response data (while session active)
        4. Commit transaction
        5. Return success only after commit
        
        Args:
            name: Non-blank farm name
            geometry_wkb: WKB-encoded polygon in SRID 4326
            centroid_wkb: WKB-encoded centroid point
            label_point_wkb: WKB-encoded interior label point
            hectares: Farm area in hectares (positive, finite)
            
        Returns:
            Created farm entity
            
        Note:
            This is for internal fixtures in Phase 1.
            Public creation endpoints belong to Phase 4.
        """
        async def _create():
            return await self.repository.create(
                name=name,
                geometry_wkb=geometry_wkb,
                centroid_wkb=centroid_wkb,
                label_point_wkb=label_point_wkb,
                hectares=hectares,
            )
        
        # Execute within transaction, materializing before commit
        return await self.execute_write_transaction(_create)
    
    async def update_farm(
        self,
        farm_id: uuid.UUID,
        name: Optional[str] = None,
    ):
        """
        Update farm metadata.
        
        Requirements: 5.4, 6.8, 10.8
        
        Write operation within explicit transaction:
        1. Repository updates farm (includes ownership check)
        2. Flush to detect constraint violations
        3. Materialize response data
        4. Commit transaction
        5. Return success only after commit
        
        Args:
            farm_id: UUID of farm to update
            name: New name if provided
            
        Returns:
            Updated farm entity
            
        Raises:
            NotFoundError: If farm doesn't exist or belongs to another user
            
        Note:
            Geometry updates create new revisions (Phase 4).
            This handles only metadata updates for Phase 1 fixtures.
        """
        async def _update():
            return await self.repository.update(farm_id, name=name)
        
        # Execute within transaction, materializing before commit
        return await self.execute_write_transaction(_update)
    
    async def delete_farm(self, farm_id: uuid.UUID) -> None:
        """
        Delete a farm.
        
        Requirements: 5.4, 6.8, 10.8
        
        Write operation within explicit transaction:
        1. Repository deletes farm (includes ownership check)
        2. Flush to detect constraint violations
        3. Commit transaction
        4. Return success only after commit
        
        Args:
            farm_id: UUID of farm to delete
            
        Raises:
            NotFoundError: If farm doesn't exist or belongs to another user
            
        Note:
            Phase 1 has no public delete endpoint.
            Phase 4 will define confirmed deletion and retention behavior.
        """
        async def _delete():
            await self.repository.delete(farm_id)
            return None
        
        # Execute within transaction
        await self.execute_write_transaction(_delete, materialize=False)
    
    async def get_geometry_revision(
        self,
        farm_id: uuid.UUID,
        revision: int
    ):
        """
        Get a specific geometry revision.
        
        Requirements: 5.4
        
        Read operation authorized through parent farm ownership.
        
        Args:
            farm_id: UUID of the farm
            revision: Revision number to fetch
            
        Returns:
            Geometry revision entity
            
        Raises:
            NotFoundError: If farm/revision doesn't exist or farm belongs to another user
        """
        return await self.repository.get_geometry_revision(farm_id, revision)
