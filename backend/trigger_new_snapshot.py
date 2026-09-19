"""
Manually trigger a new snapshot for a farm to get fresh data.
"""
import asyncio
import sys

sys.path.insert(0, "/workspace/farmtwin/backend")

from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import create_engine, create_session_factory, set_session_factory
from app.models.farm import Farm
from app.services.snapshot_service import run_analysis_job, enqueue_analysis_job


async def main():
    """Trigger new snapshot."""
    settings = get_settings()
    
    # Initialize session factory
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    set_session_factory(session_factory)
    
    async with session_factory() as session:
        async with session.begin():
            # Get the farm
            result = await session.execute(
                select(Farm).order_by(Farm.created_at.desc()).limit(1)
            )
            farm = result.scalar_one_or_none()
            
            if not farm:
                print("No farm found")
                return
            
            print(f"Enqueueing snapshot for farm: {farm.name}")
            print(f"Farm ID: {farm.id}")
            print(f"Geometry Revision: {farm.current_geometry_revision}")
            
            # Enqueue analysis job
            job = await enqueue_analysis_job(
                farm_id=farm.id,
                geometry_revision=farm.current_geometry_revision,
                session=session,
                settings=settings,
            )
            
            print(f"Job created: {job.id}")
            print(f"Job status: {job.status}")
    
    # Now run the job
    print(f"\nRunning analysis job...")
    snapshot = await run_analysis_job(
        job_id=job.id,
        settings=settings,
        session_factory=session_factory,
    )
    
    if snapshot:
        print(f"\n{'='*70}")
        print(f"SUCCESS - New Snapshot Created")
        print(f"{'='*70}")
        print(f"Snapshot ID: {snapshot.id}")
        print(f"Valid Time: {snapshot.valid_time_utc}")
        print(f"Data Mode: {snapshot.data_mode}")
        print(f"\nEvidence Statuses:")
        for key, status in snapshot.evidence_statuses.items():
            print(f"  {key}: {status}")
        
        # Check soil specifically
        if snapshot.soil and snapshot.soil.get("depths"):
            print(f"\nSoil Data Sample:")
            depths = snapshot.soil.get("depths", {})
            for depth_key in list(depths.keys())[:1]:  # Just first depth
                depth_data = depths[depth_key]
                for prop_name in ["phh2o", "clay", "sand"]:
                    if prop_name in depth_data:
                        prop_data = depth_data[prop_name]
                        if isinstance(prop_data, dict):
                            mean = prop_data.get("mean", {})
                            if isinstance(mean, dict):
                                value = mean.get("value")
                                quality = mean.get("quality")
                                print(f"  {depth_key}.{prop_name} = {value} (quality: {quality})")
    else:
        print("\nFAILED - Snapshot creation failed")


if __name__ == "__main__":
    asyncio.run(main())
