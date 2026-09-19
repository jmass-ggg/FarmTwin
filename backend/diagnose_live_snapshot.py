"""
Live snapshot diagnostic tool.

Traces exactly why soil and conduit return "unavailable" in live snapshots.
"""
import asyncio
import sys
import time
from datetime import datetime, timezone

import httpx
from shapely.geometry import Point
from sqlalchemy import select

# Add app to path
sys.path.insert(0, "/workspace/farmtwin/backend")

from app.core.config import get_settings
from app.core.database import get_session_factory
from app.data.providers import soil, conduit_eligibility
from app.models.conduit import Station, HourlyAggregate


async def diagnose_soil(lat: float, lon: float):
    """Diagnose soil provider with specific coordinates."""
    print("\n" + "=" * 70)
    print("SOIL LIVE DIAGNOSIS")
    print("=" * 70)
    print(f"Coordinates: lat={lat}, lon={lon}")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    
    # Test 1: Direct SoilGrids HTTP request
    print("\n--- Test 1: Direct SoilGrids HTTP Request ---")
    params = {
        "lon": lon,
        "lat": lat,
        "property": ["bdod", "clay", "sand", "silt", "phh2o", "soc"],
        "depth": ["0-5cm", "5-15cm"],
        "value": ["mean", "Q0.05", "Q0.95"],
    }
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    
    print(f"URL: {url}")
    print(f"Params: {params}")
    
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url, params=params)
            elapsed = time.time() - start
            print(f"HTTP Status: {response.status_code}")
            print(f"Latency: {elapsed * 1000:.0f}ms")
            if response.status_code == 200:
                data = response.json()
                print(f"Response contains layers: {len(data.get('properties', {}).get('layers', []))}")
                print("Direct SoilGrids: SUCCESS")
            else:
                print(f"Response body (first 200 chars): {response.text[:200]}")
                print("Direct SoilGrids: FAILED")
    except httpx.TimeoutException as exc:
        elapsed = time.time() - start
        print(f"Timeout after: {elapsed * 1000:.0f}ms")
        print(f"Error: {exc}")
        print("Direct SoilGrids: TIMEOUT")
    except Exception as exc:
        elapsed = time.time() - start
        print(f"Error after: {elapsed * 1000:.0f}ms")
        print(f"Error: {exc}")
        print("Direct SoilGrids: ERROR")
    
    # Test 2: FarmTwin soil.fetch()
    print("\n--- Test 2: FarmTwin soil.fetch() ---")
    start = time.time()
    result = await soil.fetch(
        centroid_lat=lat,
        centroid_lon=lon,
        farm_area_ha=10.0,
        data_mode="live",
    )
    elapsed = time.time() - start
    
    print(f"Evidence Status: {result.evidence_status}")
    print(f"Error Message: {result.error_message}")
    print(f"Has Payload: {result.payload is not None}")
    print(f"Total Latency: {elapsed * 1000:.0f}ms")
    
    if result.payload:
        # Check if any mean values exist
        has_data = False
        for depth_key, depth_data in result.payload.get("depths", {}).items():
            for prop_name, prop_data in depth_data.items():
                if isinstance(prop_data, dict):
                    mean = prop_data.get("mean", {})
                    if isinstance(mean, dict) and mean.get("value") is not None:
                        has_data = True
                        break
            if has_data:
                break
        print(f"Payload contains data: {has_data}")
    
    print("\n--- Soil Root Cause ---")
    if result.evidence_status == "unavailable":
        if result.error_message:
            if "503" in result.error_message:
                print("ROOT CAUSE: UPSTREAM_PROVIDER_UNAVAILABLE (HTTP 503)")
            elif "timed out" in result.error_message.lower():
                print("ROOT CAUSE: UPSTREAM_PROVIDER_TIMEOUT")
            elif "HTTP" in result.error_message:
                print(f"ROOT CAUSE: UPSTREAM_PROVIDER_ERROR ({result.error_message})")
            else:
                print(f"ROOT CAUSE: {result.error_message}")
        else:
            print("ROOT CAUSE: Unknown - no error message")
    else:
        print(f"STATUS: {result.evidence_status}")


async def diagnose_conduit(farm_lat: float, farm_lon: float):
    """Diagnose conduit provider with specific coordinates."""
    print("\n" + "=" * 70)
    print("CONDUIT LIVE DIAGNOSIS")
    print("=" * 70)
    print(f"Farm Coordinates: lat={farm_lat}, lon={farm_lon}")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    
    settings = get_settings()
    
    # Initialize session factory
    from app.core.database import create_engine, create_session_factory, set_session_factory
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    set_session_factory(session_factory)
    
    # Test 1: Check database for stations
    print("\n--- Test 1: Database Station Check ---")
    async with session_factory() as session:
        result = await session.execute(select(Station))
        stations = list(result.scalars().all())
        
        print(f"Total stations in database: {len(stations)}")
        
        if stations:
            for station in stations:
                print(f"\nStation ID: {station.id}")
                print(f"  Name: {station.name}")
                print(f"  Location: lat={station.latitude}, lon={station.longitude}")
                print(f"  Elevation: {station.elevation_m}m")
                
                # Calculate distance
                from pyproj import Geod
                if station.latitude and station.longitude:
                    geod = Geod(ellps="WGS84")
                    _, _, distance_m = geod.inv(
                        farm_lon, farm_lat,
                        station.longitude, station.latitude
                    )
                    distance_km = distance_m / 1000.0
                    print(f"  Distance from farm: {distance_km:.1f}km")
                    print(f"  Within 50km threshold: {distance_km <= 50.0}")
        
        # Test 2: Check for observations
        print("\n--- Test 2: Database Observations Check ---")
        obs_result = await session.execute(
            select(HourlyAggregate).order_by(HourlyAggregate.window_start_utc.desc()).limit(5)
        )
        aggregates = list(obs_result.scalars().all())
        
        print(f"Total hourly aggregates: {len(aggregates)}")
        if aggregates:
            latest = aggregates[0]
            print(f"\nLatest aggregate:")
            print(f"  Station ID: {latest.station_id}")
            print(f"  Window Start: {latest.window_start_utc.isoformat()}")
            print(f"  Observation Count: {latest.observation_count}")
            print(f"  Accepted Count: {latest.accepted_count}")
            print(f"  Temp Mean: {latest.temp_mean_celsius}°C")
            
            # Check age
            now = datetime.now(timezone.utc)
            age_hours = (now - latest.window_start_utc).total_seconds() / 3600
            print(f"  Age: {age_hours:.1f} hours")
            print(f"  Within 24h window: {age_hours <= 24}")
    
    # Test 3: Call conduit_eligibility.fetch()
    print("\n--- Test 3: FarmTwin conduit_eligibility.fetch() ---")
    async with session_factory() as session:
        farm_centroid = Point(farm_lon, farm_lat)
        
        result = await conduit_eligibility.fetch(
            farm_centroid=farm_centroid,
            session=session,
            terrain_payload=None,
            data_mode="live",
        )
        
        print(f"Evidence Status: {result.evidence_status}")
        print(f"Error Message: {result.error_message}")
        print(f"Has Payload: {result.payload is not None}")
        
        if result.payload:
            print(f"Payload keys: {list(result.payload.keys())}")
            if "station_name" in result.payload:
                print(f"Station Name: {result.payload.get('station_name')}")
            if "distance_km" in result.payload:
                print(f"Distance: {result.payload.get('distance_km')}km")
            if "eligibility_reason" in result.payload:
                print(f"Eligibility: {result.payload.get('eligibility_reason')}")
    
    print("\n--- Conduit Root Cause ---")
    if result.evidence_status == "unavailable":
        if not stations:
            print("ROOT CAUSE: NO_STATION_CONFIGURED")
        elif not aggregates:
            print("ROOT CAUSE: NO_OBSERVATIONS_IN_DATABASE")
        elif age_hours > 24:
            print("ROOT CAUSE: OBSERVATIONS_TOO_OLD (>24h)")
        elif result.error_message:
            print(f"ROOT CAUSE: {result.error_message}")
        else:
            print("ROOT CAUSE: Unknown")
    elif result.evidence_status == "ineligible":
        print(f"ROOT CAUSE: FARM_NOT_ELIGIBLE - {result.error_message}")
    elif result.evidence_status == "error":
        print(f"ROOT CAUSE: DATABASE_ERROR - {result.error_message}")
    else:
        print(f"STATUS: {result.evidence_status}")


async def main():
    """Run diagnostics."""
    # Test with USA Iowa coordinates (from previous tests)
    farm_lat = 41.8780
    farm_lon = -93.0977
    
    print("=" * 70)
    print("FARMTWIN LIVE SNAPSHOT DIAGNOSTIC")
    print("=" * 70)
    print("This tool diagnoses why soil and conduit return 'unavailable'")
    print("in live snapshot generation.")
    
    # Diagnose Soil
    await diagnose_soil(farm_lat, farm_lon)
    
    # Diagnose Conduit
    await diagnose_conduit(farm_lat, farm_lon)
    
    print("\n" + "=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
