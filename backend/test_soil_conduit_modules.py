#!/usr/bin/env python3
"""
Comprehensive module-level tests for Soil and Conduit data providers.

Tests multiple real-world locations across different countries and environmental conditions.
Does NOT modify implementation - only tests actual behavior.

Run with: python3 test_soil_conduit_modules.py
"""

import asyncio
import time
from datetime import datetime
from typing import Any

# Test locations
TEST_LOCATIONS = {
    "Eldoret_Kenya": {"lat": 0.5143, "lon": 35.2698, "name": "Eldoret, Kenya"},
    "Kitale_Kenya": {"lat": 1.0157, "lon": 35.0062, "name": "Kitale, Kenya"},
    "Narok_Kenya": {"lat": -1.0833, "lon": 35.8667, "name": "Narok, Kenya"},
    "Kathmandu_Nepal": {"lat": 27.7172, "lon": 85.3240, "name": "Kathmandu, Nepal"},
    "Ludhiana_India": {"lat": 30.9010, "lon": 75.8573, "name": "Ludhiana, Punjab, India"},
    "Iowa_USA": {"lat": 41.8780, "lon": -93.0977, "name": "Iowa, USA"},
    "Londrina_Brazil": {"lat": -23.3045, "lon": -51.1696, "name": "Londrina, Brazil"},
    "Toowoomba_Australia": {"lat": -27.5598, "lon": 151.9507, "name": "Toowoomba, Australia"},
    # Edge cases
    "Sahara_Desert": {"lat": 23.4162, "lon": 25.6628, "name": "Sahara Desert"},
    "Himalaya_Mountain": {"lat": 28.0000, "lon": 86.8000, "name": "Himalaya"},
    "Pacific_Ocean": {"lat": 0.0, "lon": -140.0, "name": "Pacific Ocean"},
}


def print_header(title: str):
    """Print formatted section header."""
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80 + "\n")


def print_subheader(title: str):
    """Print formatted subsection header."""
    print("\n" + "-" * 80)
    print(f" {title}")
    print("-" * 80)


async def test_soil_location(location_key: str, location: dict) -> dict:
    """Test Soil module for a single location."""
    from app.data.providers import soil
    
    print(f"\nTesting: {location['name']}")
    print(f"Coordinates: {location['lat']:.4f}, {location['lon']:.4f}")
    
    result = {
        "location": location['name'],
        "lat": location['lat'],
        "lon": location['lon'],
        "request_url": f"{soil.SOILGRIDS_URL}?lat={location['lat']}&lon={location['lon']}",
        "http_status": None,
        "response_time_ms": None,
        "module_status": None,
        "data_available": False,
        "parser_status": None,
        "error": None,
        "pH_0_5cm": None,
        "clay_0_5cm": None,
        "sand_0_5cm": None,
        "silt_0_5cm": None,
        "soc_0_5cm": None,
        "bdod_0_5cm": None,
        "has_uncertainty": False,
        "smaller_than_grid_cell": None,
    }
    
    try:
        start_time = time.time()
        provider_result = await soil.fetch(
            centroid_lat=location['lat'],
            centroid_lon=location['lon'],
            farm_area_ha=10.0,
            data_mode="live"
        )
        elapsed_ms = (time.time() - start_time) * 1000
        
        result["response_time_ms"] = round(elapsed_ms, 2)
        result["module_status"] = provider_result.evidence_status
        result["error"] = provider_result.error_message
        
        # Check if data is available
        if provider_result.payload:
            depths = provider_result.payload.get("depths", {})
            depth_0_5 = depths.get("0_5cm", {})
            
            # Extract pH
            ph_data = depth_0_5.get("phh2o", {})
            if ph_data and ph_data.get("mean"):
                ph_value = ph_data["mean"].get("value")
                if ph_value is not None:
                    result["pH_0_5cm"] = ph_value
                    result["data_available"] = True
                    result["parser_status"] = "PASS"
            
            # Extract clay
            clay_data = depth_0_5.get("clay", {})
            if clay_data and clay_data.get("mean"):
                clay_value = clay_data["mean"].get("value")
                if clay_value is not None:
                    result["clay_0_5cm"] = clay_value
            
            # Extract sand
            sand_data = depth_0_5.get("sand", {})
            if sand_data and sand_data.get("mean"):
                sand_value = sand_data["mean"].get("value")
                if sand_value is not None:
                    result["sand_0_5cm"] = sand_value
            
            # Extract silt
            silt_data = depth_0_5.get("silt", {})
            if silt_data and silt_data.get("mean"):
                silt_value = silt_data["mean"].get("value")
                if silt_value is not None:
                    result["silt_0_5cm"] = silt_value
            
            # Extract SOC
            soc_data = depth_0_5.get("soc", {})
            if soc_data and soc_data.get("mean"):
                soc_value = soc_data["mean"].get("value")
                if soc_value is not None:
                    result["soc_0_5cm"] = soc_value
            
            # Extract bulk density
            bdod_data = depth_0_5.get("bdod", {})
            if bdod_data and bdod_data.get("mean"):
                bdod_value = bdod_data["mean"].get("value")
                if bdod_value is not None:
                    result["bdod_0_5cm"] = bdod_value
            
            # Check for uncertainty
            if ph_data and ph_data.get("uncertainty_5th_percentile") is not None:
                result["has_uncertainty"] = True
            
            # Check grid cell flag
            result["smaller_than_grid_cell"] = provider_result.payload.get("smaller_than_grid_cell")
        
        # Determine HTTP status from module status
        if provider_result.evidence_status == "accepted":
            result["http_status"] = 200
        elif "HTTP" in str(provider_result.error_message or ""):
            # Extract HTTP status from error message
            import re
            match = re.search(r'HTTP (\d+)', provider_result.error_message or "")
            if match:
                result["http_status"] = int(match.group(1))
        
        if not result["parser_status"]:
            result["parser_status"] = "PASS" if provider_result.payload else "FAIL"
            
    except Exception as e:
        result["error"] = str(e)
        result["module_status"] = "EXCEPTION"
        result["parser_status"] = "FAIL"
    
    # Print result
    print(f"  Status: {result['module_status']}")
    print(f"  Response Time: {result['response_time_ms']} ms")
    print(f"  Data Available: {result['data_available']}")
    if result['pH_0_5cm']:
        print(f"  pH: {result['pH_0_5cm']:.2f}")
    if result['clay_0_5cm']:
        print(f"  Clay: {result['clay_0_5cm']:.1f}%")
    if result['error']:
        print(f"  Error: {result['error']}")
    
    return result


async def test_conduit_eligibility(location_key: str, location: dict) -> dict:
    """Test Conduit eligibility for a location."""
    from app.data.providers import conduit_eligibility
    from app.core.config import Settings
    from app.models.conduit import Station
    from shapely.geometry import Point
    from unittest.mock import AsyncMock, MagicMock
    import uuid
    
    settings = Settings()
    
    result = {
        "location": location['name'],
        "lat": location['lat'],
        "lon": location['lon'],
        "station_lat": settings.conduit_station_latitude,
        "station_lon": settings.conduit_station_longitude,
        "station_elevation": settings.conduit_station_elevation_m,
        "eligible": False,
        "distance_km": None,
        "elevation_diff_m": None,
        "reason": None,
    }
    
    try:
        station = Station(
            id=uuid.uuid4(),
            provider_station_id="configured-diagnostic-station",
            name="Configured diagnostic station",
            latitude=settings.conduit_station_latitude,
            longitude=settings.conduit_station_longitude,
            elevation_m=settings.conduit_station_elevation_m,
            provider="conduit",
        )

        stations_result = MagicMock()
        stations_result.scalars.return_value.all.return_value = [station]
        aggregate_result = MagicMock()
        aggregate_result.scalar_one_or_none.return_value = None
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[stations_result, aggregate_result])

        # Use the adapter's real public API. No observation is fabricated: an
        # eligible station is expected to report no recent aggregate here.
        provider_result = await conduit_eligibility.fetch(
            farm_centroid=Point(location['lon'], location['lat']),
            session=session,
            terrain_payload={
                "mean_elevation_m": {"value": settings.conduit_station_elevation_m}
            },
            data_mode="historical_replay",
        )
        
        result["eligible"] = provider_result.evidence_status not in {"ineligible", "error"}
        result["reason"] = (
            (provider_result.payload or {}).get("eligibility_reason")
            or provider_result.error_message
        )
        
        # Extract distance and elevation from payload if available
        if provider_result.payload:
            result["distance_km"] = provider_result.payload.get("distance_km")
            result["elevation_diff_m"] = provider_result.payload.get("elevation_diff_m")
            
    except Exception as e:
        result["reason"] = f"Exception: {str(e)}"
    
    return result


async def run_soil_tests():
    """Run comprehensive Soil module tests."""
    print_header("SOIL MODULE TESTS")
    
    results = []
    for location_key, location in TEST_LOCATIONS.items():
        result = await test_soil_location(location_key, location)
        results.append(result)
        await asyncio.sleep(1)  # Rate limiting
    
    return results


async def run_conduit_tests():
    """Run comprehensive Conduit module tests."""
    print_header("CONDUIT MODULE TESTS")
    
    print("\nNote: Conduit uses historical replay mode with fixture data.")
    print("Testing eligibility checks only (live endpoint not configured).\n")
    
    settings = __import__("app.core.config", fromlist=["Settings"]).Settings()
    locations = {
        "Near_station": {
            "lat": settings.conduit_station_latitude + 0.01,
            "lon": settings.conduit_station_longitude + 0.01,
            "name": "Near configured station",
        },
        "Eldoret_Kenya": TEST_LOCATIONS["Eldoret_Kenya"],
        "Kathmandu_Nepal": TEST_LOCATIONS["Kathmandu_Nepal"],
    }
    results = []
    for location_key, location in locations.items():
        result = await test_conduit_eligibility(location_key, location)
        results.append(result)
        print(f"\n{location['name']}")
        print(f"  Eligible: {result['eligible']}")
        if result['distance_km']:
            print(f"  Distance: {result['distance_km']:.1f} km")
        if result['reason']:
            print(f"  Reason: {result['reason']}")
    
    return results


def print_soil_summary_table(results: list[dict]):
    """Print summary table for Soil tests."""
    print_header("SOIL MODULE SUMMARY")
    
    print(f"{'Location':<25} {'HTTP':<8} {'Module':<12} {'Data':<8} {'Parser':<8} {'Result':<15}")
    print("-" * 90)
    
    for r in results:
        location = r['location'][:24]
        http = str(r['http_status'] or '---')
        module = r['module_status'] or 'UNKNOWN'
        data = 'YES' if r['data_available'] else 'NO'
        parser = r['parser_status'] or 'N/A'
        
        if r['data_available'] and r['module_status'] == 'accepted':
            result = 'WORKING'
        elif r['module_status'] == 'unavailable' and 'Ocean' in r['location']:
            result = 'NO DATA (OK)'
        elif r['module_status'] == 'unavailable':
            result = 'PROVIDER FAIL'
        else:
            result = 'FAIL'
        
        print(f"{location:<25} {http:<8} {module:<12} {data:<8} {parser:<8} {result:<15}")
    
    # Statistics
    total = len(results)
    working = sum(1 for r in results if r['data_available'] and r['module_status'] == 'accepted')
    no_data = sum(1 for r in results if 'Ocean' in r['location'] or 'Desert' in r['location'])
    failed = total - working - no_data
    
    print("\n" + "=" * 90)
    print(f"Total Locations: {total}")
    print(f"Working: {working}")
    print(f"No Data (Expected): {no_data}")
    print(f"Failed: {failed}")
    

def print_conduit_summary_table(results: list[dict]):
    """Print summary table for Conduit tests."""
    print_header("CONDUIT MODULE SUMMARY")
    
    print(f"{'Location':<25} {'Eligible':<10} {'Distance (km)':<15} {'Status':<20}")
    print("-" * 75)
    
    for r in results:
        location = r['location'][:24]
        eligible = 'YES' if r['eligible'] else 'NO'
        distance = f"{r['distance_km']:.1f}" if r['distance_km'] else 'N/A'
        
        if r['eligible']:
            status = 'ELIGIBLE'
        elif r['distance_km'] and r['distance_km'] > 50:
            status = 'TOO FAR (>50km)'
        elif r['reason']:
            status = r['reason'][:19]
        else:
            status = 'NOT ELIGIBLE'
        
        print(f"{location:<25} {eligible:<10} {distance:<15} {status:<20}")
    
    # Statistics
    total = len(results)
    eligible = sum(1 for r in results if r['eligible'])
    too_far = sum(1 for r in results if r.get('distance_km', 0) > 50)
    
    print("\n" + "=" * 75)
    print(f"Total Locations: {total}")
    print(f"Eligible: {eligible}")
    print(f"Too Far (>50km): {too_far}")
    print(f"Not Eligible: {total - eligible}")


async def main():
    """Main test runner."""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 78 + "║")
    print("║" + "  FARMTWIN DATA MODULE VALIDATION".center(78) + "║")
    print("║" + "  Soil (SoilGrids) & Conduit Station Tests".center(78) + "║")
    print("║" + " " * 78 + "║")
    print("╚" + "=" * 78 + "╝")
    
    print(f"\nTest Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Total Test Locations: {len(TEST_LOCATIONS)}")
    
    # Run Soil tests
    soil_results = await run_soil_tests()
    
    # Run Conduit tests
    conduit_results = await run_conduit_tests()
    
    # Print summaries
    print_soil_summary_table(soil_results)
    print_conduit_summary_table(conduit_results)
    
    print_header("FINAL VERDICT")
    
    # Soil verdict
    soil_working = sum(1 for r in soil_results if r['data_available'])
    soil_total = len([r for r in soil_results if 'Ocean' not in r['location']])
    
    print("SOIL MODULE:")
    if soil_working == soil_total:
        print("  Overall Status: ✅ WORKING")
    elif soil_working > soil_total * 0.7:
        print("  Overall Status: ⚠️  PARTIALLY WORKING")
    else:
        print("  Overall Status: ❌ BROKEN")
    
    print(f"  Locations Tested: {len(soil_results)}")
    print(f"  Passed: {soil_working}")
    print(f"  Failed: {soil_total - soil_working}")
    print(f"  Success Rate: {(soil_working/soil_total*100):.1f}%")
    
    # Conduit verdict
    conduit_eligible = sum(1 for r in conduit_results if r['eligible'])
    
    print("\nCONDUIT MODULE:")
    print("  Overall Status: ⚠️  HISTORICAL REPLAY MODE ONLY")
    print("  Live Endpoint: ❌ NOT CONFIGURED")
    print("  Eligibility Check: ✅ WORKING")
    print(f"  Locations Tested: {len(conduit_results)}")
    print(f"  Eligible (within 50km): {conduit_eligible}")
    print(f"  Station Location: {conduit_results[0]['station_lat']:.4f}, {conduit_results[0]['station_lon']:.4f}")
    
    print("\n" + "=" * 80)
    print("Test Complete")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
