# Data Module Improvement Guide - File Structure

## Purpose
This guide shows ONLY the files needed to add caching, retry logic, and monitoring to Soil and Conduit modules based on test results.

---

## Current Module Structure

### Soil Module (SoilGrids)

```
farmtwin/backend/
├── app/data/providers/
│   ├── base.py                          # ProviderResult, envelope helpers
│   └── soil.py                          # ← MAIN: SoilGrids adapter
├── app/services/
│   └── snapshot_service.py              # ← Calls soil.fetch()
├── app/core/
│   └── config.py                        # Configuration (read-only)
└── tests/
    └── test_soil_terrain_adapters.py    # Unit tests
```

### Conduit Module

```
farmtwin/backend/
├── app/data/
│   ├── conduit/
│   │   ├── parser.py                    # Parse fixture JSON
│   │   ├── quality.py                   # Quality flagging
│   │   └── rollup.py                    # Hourly/daily aggregates
│   └── providers/
│       └── conduit_eligibility.py       # ← Geographic eligibility check
├── app/services/
│   ├── conduit_service.py               # Ingestion logic
│   └── snapshot_service.py              # ← Calls conduit eligibility
├── app/models/
│   ├── conduit_station.py               # Station table
│   ├── normalized_observation.py        # Observations table
│   ├── hourly_aggregate.py              # Hourly rollup
│   └── daily_aggregate.py               # Daily rollup
└── app/api/v1/
    └── conduit.py                       # REST endpoints
```

---

## Files to Modify for Improvements

### 1. Add Caching to Soil Module

#### **NEW: `farmtwin/backend/app/services/cache_service.py`**
**Purpose:** Centralized caching for external API responses

```python
"""
Cache service for expensive external API calls.

Uses Redis (if available) with PostgreSQL fallback.
"""
from typing import Any, Optional
import json
import hashlib
from datetime import datetime, timedelta

from redis import Redis
from sqlalchemy.ext.asyncio import AsyncSession

class CacheService:
    """Manages caching for external API responses."""
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis = redis_client
    
    def _make_key(self, provider: str, **params) -> str:
        """Generate cache key from provider + params."""
        # Example: "soil:lat=0.5143:lon=35.2698"
        param_str = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
        return f"{provider}:{param_str}"
    
    async def get(self, provider: str, **params) -> Optional[dict]:
        """Retrieve cached response."""
        key = self._make_key(provider, **params)
        
        if self.redis:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
        
        # TODO: PostgreSQL fallback
        return None
    
    async def set(self, provider: str, data: dict, ttl_days: int = 30, **params):
        """Store response in cache."""
        key = self._make_key(provider, **params)
        
        if self.redis:
            self.redis.setex(
                key,
                timedelta(days=ttl_days),
                json.dumps(data)
            )
        
        # TODO: PostgreSQL fallback
```

**Dependencies:**
```python
# requirements.txt
redis>=5.0.0  # ADD THIS if not present
```

---

#### **MODIFY: `farmtwin/backend/app/data/providers/soil.py`**
**Purpose:** Add caching and retry logic to SoilGrids requests
**Lines to change:** ~315-375 (fetch function)

**Current code (line ~315):**
```python
async def fetch(
    centroid_lat: float,
    centroid_lon: float,
    farm_area_ha: float | None = None,
    data_mode: str = "live",
) -> ProviderResult:
    """Fetch soil properties from SoilGrids for the given centroid."""
    retrieved_at = _iso_now()

    params = {
        "lon": centroid_lon,
        "lat": centroid_lat,
        "property": list(_PROPERTIES.keys()),
        "depth": DEPTHS,
        "value": _STAT_KEYS,
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(SOILGRIDS_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as exc:
        # ... error handling
```

**New code with caching + retry:**
```python
async def fetch(
    centroid_lat: float,
    centroid_lon: float,
    farm_area_ha: float | None = None,
    data_mode: str = "live",
    cache_service: Optional[CacheService] = None,  # ADD THIS
) -> ProviderResult:
    """Fetch soil properties from SoilGrids for the given centroid.
    
    Args:
        centroid_lat: Farm centroid latitude in decimal degrees.
        centroid_lon: Farm centroid longitude in decimal degrees.
        farm_area_ha: Farm area in hectares (used to flag sub-cell farms).
        data_mode: Data mode label for provenance (default "live").
        cache_service: Optional cache service for API response caching.
    
    Implements:
        - Response caching (30-day TTL)
        - Exponential backoff retry (3 attempts)
        - Graceful degradation on failure
    """
    retrieved_at = _iso_now()

    # Check cache first
    if cache_service:
        cache_key = {"lat": centroid_lat, "lon": centroid_lon}
        cached = await cache_service.get("soilgrids", **cache_key)
        if cached:
            logger.info(f"SoilGrids cache hit for {centroid_lat}, {centroid_lon}")
            # Build payload from cached data
            payload = _build_soil_payload(cached, retrieved_at, data_mode, farm_area_ha)
            return ProviderResult(
                payload=payload,
                evidence_status=EVIDENCE_ACCEPTED,
                error_message=None,
            )

    params = {
        "lon": centroid_lon,
        "lat": centroid_lat,
        "property": list(_PROPERTIES.keys()),
        "depth": DEPTHS,
        "value": _STAT_KEYS,
    }

    # Retry logic with exponential backoff
    max_retries = 3
    backoff_seconds = 5
    last_error = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.get(SOILGRIDS_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                # Cache successful response
                if cache_service:
                    await cache_service.set("soilgrids", data, ttl_days=30, **cache_key)
                
                # Build and return payload
                payload = _build_soil_payload(data, retrieved_at, data_mode, farm_area_ha)
                return ProviderResult(
                    payload=payload,
                    evidence_status=EVIDENCE_ACCEPTED,
                    error_message=None,
                )
                
        except httpx.TimeoutException as exc:
            last_error = f"SoilGrids request timed out after {REQUEST_TIMEOUT_SECONDS}s: {exc}"
            logger.warning(f"{last_error} (attempt {attempt + 1}/{max_retries})")
            
        except httpx.HTTPStatusError as exc:
            last_error = f"SoilGrids returned HTTP {exc.response.status_code}"
            logger.warning(f"{last_error} (attempt {attempt + 1}/{max_retries})")
            
            # Don't retry on 4xx errors (client error)
            if 400 <= exc.response.status_code < 500:
                break
            
        except Exception as exc:
            last_error = f"SoilGrids request failed: {exc}"
            logger.warning(f"{last_error} (attempt {attempt + 1}/{max_retries})")
        
        # Wait before retry (exponential backoff)
        if attempt < max_retries - 1:
            wait_time = backoff_seconds * (2 ** attempt)
            logger.info(f"Retrying in {wait_time}s...")
            await asyncio.sleep(wait_time)
    
    # All retries failed
    return ProviderResult(
        payload=_build_unavailable_payload(retrieved_at, data_mode),
        evidence_status=EVIDENCE_UNAVAILABLE,
        error_message=last_error,
    )
```

**Add import at top of file:**
```python
import asyncio  # ADD THIS
from typing import Optional  # ADD THIS
from app.services.cache_service import CacheService  # ADD THIS
```

---

#### **MODIFY: `farmtwin/backend/app/services/snapshot_service.py`**
**Purpose:** Pass cache service to soil.fetch()
**Lines to change:** Find where `soil.fetch()` is called (around line 425)

**Current code:**
```python
adapter_results["soil"] = await soil.fetch(
    centroid_lat=centroid_lat,
    centroid_lon=centroid_lon,
    farm_area_ha=farm.hectares,
    data_mode=data_mode,
)
```

**New code:**
```python
# Initialize cache service (at top of function)
cache_service = CacheService(redis_client=get_redis_client())  # helper function needed

adapter_results["soil"] = await soil.fetch(
    centroid_lat=centroid_lat,
    centroid_lon=centroid_lon,
    farm_area_ha=farm.hectares,
    data_mode=data_mode,
    cache_service=cache_service,  # ADD THIS
)
```

---

### 2. Add Monitoring Dashboard

#### **NEW: `farmtwin/backend/app/services/provider_monitor.py`**
**Purpose:** Track provider availability and performance

```python
"""
Provider monitoring service.

Tracks API availability, latency, error rates.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List
import asyncio

@dataclass
class ProviderMetrics:
    """Metrics for a single provider."""
    provider_name: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    last_success: datetime | None
    last_failure: datetime | None
    current_status: str  # "healthy" | "degraded" | "down"

class ProviderMonitor:
    """Monitors external provider health."""
    
    def __init__(self):
        self._metrics: Dict[str, List[dict]] = {}
    
    def record_request(
        self,
        provider: str,
        success: bool,
        latency_ms: float,
        error: str | None = None
    ):
        """Record a provider API request."""
        if provider not in self._metrics:
            self._metrics[provider] = []
        
        self._metrics[provider].append({
            "timestamp": datetime.utcnow(),
            "success": success,
            "latency_ms": latency_ms,
            "error": error,
        })
        
        # Keep only last 100 requests per provider
        if len(self._metrics[provider]) > 100:
            self._metrics[provider].pop(0)
    
    def get_metrics(self, provider: str) -> ProviderMetrics:
        """Get current metrics for a provider."""
        records = self._metrics.get(provider, [])
        
        if not records:
            return ProviderMetrics(
                provider_name=provider,
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                avg_latency_ms=0,
                last_success=None,
                last_failure=None,
                current_status="unknown",
            )
        
        successful = [r for r in records if r["success"]]
        failed = [r for r in records if not r["success"]]
        
        # Calculate status based on recent requests (last 10)
        recent = records[-10:]
        recent_success_rate = sum(1 for r in recent if r["success"]) / len(recent)
        
        if recent_success_rate >= 0.9:
            status = "healthy"
        elif recent_success_rate >= 0.5:
            status = "degraded"
        else:
            status = "down"
        
        return ProviderMetrics(
            provider_name=provider,
            total_requests=len(records),
            successful_requests=len(successful),
            failed_requests=len(failed),
            avg_latency_ms=sum(r["latency_ms"] for r in successful) / len(successful) if successful else 0,
            last_success=successful[-1]["timestamp"] if successful else None,
            last_failure=failed[-1]["timestamp"] if failed else None,
            current_status=status,
        )

# Global instance
monitor = ProviderMonitor()
```

---

#### **MODIFY: `farmtwin/backend/app/data/providers/soil.py`**
**Purpose:** Add monitoring to requests
**Add at start and end of fetch():**

```python
from app.services.provider_monitor import monitor  # ADD IMPORT

async def fetch(...) -> ProviderResult:
    """Fetch soil properties from SoilGrids."""
    retrieved_at = _iso_now()
    start_time = time.time()  # ADD THIS
    
    # ... existing code ...
    
    try:
        # ... request code ...
        
        # Record success
        elapsed_ms = (time.time() - start_time) * 1000
        monitor.record_request("soilgrids", success=True, latency_ms=elapsed_ms)
        
        return ProviderResult(...)
        
    except Exception as exc:
        # Record failure
        elapsed_ms = (time.time() - start_time) * 1000
        monitor.record_request("soilgrids", success=False, latency_ms=elapsed_ms, error=str(exc))
        
        return ProviderResult(...)
```

---

#### **NEW: `farmtwin/backend/app/api/v1/admin.py`**
**Purpose:** Admin endpoint to view provider status

```python
"""
Admin API endpoints.

GET /api/v1/admin/provider-status → Provider health dashboard
"""
from fastapi import APIRouter, Depends
from app.services.provider_monitor import monitor
from app.api.dependencies import get_current_principal
from app.core.security import Principal

router = APIRouter(tags=["Admin"], prefix="/admin")

@router.get("/provider-status")
async def get_provider_status(
    principal: Principal = Depends(get_current_principal),
):
    """Get health status of all external providers."""
    
    providers = ["soilgrids", "weather", "satellite", "terrain", "climate"]
    
    return {
        "providers": [
            {
                "name": provider,
                **monitor.get_metrics(provider).__dict__,
            }
            for provider in providers
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }
```

**Register in `app/main.py`:**
```python
from app.api.v1 import admin  # ADD IMPORT

app.include_router(admin.router, prefix="/api/v1")  # ADD THIS
```

---

### 3. Fix Conduit Eligibility Test

#### **INSPECT: `farmtwin/backend/app/data/providers/conduit_eligibility.py`**
**Purpose:** Find actual function name

The test assumed `assess()` but the actual function might be:
- `check_eligibility()`
- `is_eligible()`
- `fetch()`
- Something else

**Check the file:**
```bash
grep "^async def\|^def" farmtwin/backend/app/data/providers/conduit_eligibility.py
```

**Then update test script** at line ~196:
```python
# OLD (line 196):
provider_result = await conduit_eligibility.assess(...)

# NEW (use actual function name):
provider_result = await conduit_eligibility.ACTUAL_FUNCTION_NAME(...)
```

---

## File Summary Table

| File | Action | Purpose |
|------|--------|---------|
| **Caching** | | |
| `app/services/cache_service.py` | **CREATE** | Centralized caching service |
| `app/data/providers/soil.py` | **MODIFY** (line ~315-375) | Add caching + retry to fetch() |
| `app/services/snapshot_service.py` | **MODIFY** (find soil.fetch call) | Pass cache service |
| `requirements.txt` | **MODIFY** | Add `redis>=5.0.0` |
| **Monitoring** | | |
| `app/services/provider_monitor.py` | **CREATE** | Track provider health |
| `app/data/providers/soil.py` | **MODIFY** (add monitoring) | Record request metrics |
| `app/api/v1/admin.py` | **CREATE** | Admin dashboard endpoint |
| `app/main.py` | **MODIFY** | Register admin router |
| **Testing** | | |
| `app/data/providers/conduit_eligibility.py` | **INSPECT** | Find correct function name |
| `test_soil_conduit_modules.py` | **MODIFY** (line ~196) | Fix function call |

---

## Implementation Order

1. **Create cache service** (`cache_service.py`)
2. **Add redis dependency** (`requirements.txt`)
3. **Modify soil.fetch()** with caching + retry
4. **Update snapshot_service** to pass cache
5. **Create provider monitor** (`provider_monitor.py`)
6. **Add monitoring to soil.py**
7. **Create admin endpoint** (`admin.py`)
8. **Register admin router** in main.py
9. **Fix Conduit test** (inspect actual function name)

---

## Testing Checklist

After implementing:

- [ ] Test cache hit/miss (call same location twice)
- [ ] Test retry logic (mock timeouts)
- [ ] Test monitoring metrics (check admin endpoint)
- [ ] Re-run full location test suite
- [ ] Verify no performance regression
- [ ] Check Redis connection handling
- [ ] Test cache expiration (30-day TTL)
- [ ] Verify PostgreSQL fallback (if implemented)

---

## Configuration Changes

### Add to `.env`:
```bash
# Cache configuration
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
CACHE_TTL_DAYS=30

# Retry configuration
SOILGRIDS_MAX_RETRIES=3
SOILGRIDS_BACKOFF_SECONDS=5
```

### Add to `app/core/config.py`:
```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    cache_enabled: bool = True
    cache_ttl_days: int = 30
    soilgrids_max_retries: int = 3
    soilgrids_backoff_seconds: int = 5
```

---

## Related Files (Reference Only - Don't Modify)

- `app/data/providers/base.py` - ProviderResult definition (read-only)
- `app/data/providers/weather.py` - Similar pattern for reference
- `app/data/providers/satellite.py` - Similar pattern for reference
- `tests/test_soil_terrain_adapters.py` - Existing unit tests
- `data/samples/weather.json` - Conduit fixture data

---

## Performance Impact

**Before improvements:**
- API call: 685ms - 60,000ms (timeout)
- Retry: None (single attempt)
- Cache: None (every request hits API)

**After improvements:**
- API call (cached): <10ms
- API call (miss): 685ms - 10,000ms with retries
- Retry: Up to 3 attempts with exponential backoff
- Cache hit rate: ~95% (after initial requests)

**Expected improvement:** 95% reduction in API calls, 99% reduction in latency for cached requests.
