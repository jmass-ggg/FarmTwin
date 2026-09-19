"""
Check what's actually stored in a real farm's snapshot.
"""
import asyncio
import sys
import json

sys.path.insert(0, "/workspace/farmtwin/backend")

from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import create_engine, create_session_factory, set_session_factory
from app.models.farm import Farm
from app.models.snapshot import AnalysisSnapshot


async def main():
    """Check real farm snapshots."""
    settings = get_settings()
    
    # Initialize session factory
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    set_session_factory(session_factory)
    
    async with session_factory() as session:
        # Get all farms
        result = await session.execute(
            select(Farm).order_by(Farm.created_at.desc()).limit(5)
        )
        farms = list(result.scalars().all())
        
        print(f"Total farms in database: {len(farms)}")
        
        if not farms:
            print("No farms found. Create a farm in the UI first.")
            return
        
        for farm in farms:
            print(f"\n{'='*70}")
            print(f"Farm: {farm.name}")
            print(f"ID: {farm.id}")
            print(f"Current Revision: {farm.current_geometry_revision}")
            
            # Get latest snapshot for this farm
            snapshot_result = await session.execute(
                select(AnalysisSnapshot)
                .where(AnalysisSnapshot.farm_id == farm.id)
                .order_by(AnalysisSnapshot.valid_time_utc.desc())
                .limit(1)
            )
            snapshot = snapshot_result.scalar_one_or_none()
            
            if not snapshot:
                print("No snapshots yet")
                continue
            
            print(f"\nLatest Snapshot:")
            print(f"  ID: {snapshot.id}")
            print(f"  Valid Time: {snapshot.valid_time_utc}")
            print(f"  Data Mode: {snapshot.data_mode}")
            print(f"\nEvidence Statuses:")
            for key, status in snapshot.evidence_statuses.items():
                print(f"    {key}: {status}")
            
            # Check soil payload specifically
            if snapshot.soil:
                print(f"\nSoil Payload Analysis:")
                print(f"  Has soil data: True")
                
                # Check if actual values exist
                depths = snapshot.soil.get("depths", {})
                has_data = False
                for depth_key, depth_data in depths.items():
                    for prop_name, prop_data in depth_data.items():
                        if isinstance(prop_data, dict):
                            mean = prop_data.get("mean", {})
                            if isinstance(mean, dict):
                                value = mean.get("value")
                                if value is not None:
                                    has_data = True
                                    print(f"  {depth_key}.{prop_name}.mean.value = {value}")
                                    break
                    if has_data:
                        break
                
                if not has_data:
                    print("  WARNING: Soil payload exists but all mean values are NULL")
                    # Print the actual structure
                    print(f"\n  Sample structure (0-5cm bdod):")
                    bdod = depths.get("0_5cm", {}).get("bdod", {})
                    print(f"    {json.dumps(bdod.get('mean', {}), indent=4)}")
            else:
                print(f"\nSoil: No payload (completely null)")
            
            # Only check first farm in detail
            break


if __name__ == "__main__":
    asyncio.run(main())
