# FarmTwin API Complete Testing Guide

Complete reference for testing all FarmTwin API endpoints with curl examples, use cases, and expected responses.

## Table of Contents

1. [Health & Status Endpoints](#health--status-endpoints)
2. [User Profile Endpoints](#user-profile-endpoints)
3. [Farm Management Endpoints](#farm-management-endpoints)
4. [Digital Twin Endpoints](#digital-twin-endpoints)
5. [Crop Simulator Endpoints](#crop-simulator-endpoints)
6. [Risk & Hazard Endpoints](#risk--hazard-endpoints)
7. [Annual Planner Endpoints](#annual-planner-endpoints)
8. [Climate Scenario Endpoints](#climate-scenario-endpoints)
9. [Conduit Data Endpoints](#conduit-data-endpoints)
10. [Data Sources Endpoints](#data-sources-endpoints)
11. [Complete Use Case Workflows](#complete-use-case-workflows)

---

## Setup

### Base URL
```bash
API_BASE="http://localhost:8000"
```

### Authentication
For local demo mode (no authentication required):
```bash
# No headers needed
```

For OIDC mode (production):
```bash
TOKEN="your-jwt-token-here"
AUTH_HEADER="Authorization: Bearer $TOKEN"
```

---

## 1. Health & Status Endpoints

### GET /health
**Purpose:** Check if API process is running

```bash
curl -X GET "$API_BASE/health"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-19T10:30:00Z",
  "non_live": false
}
```

**Use Cases:**
- Load balancer health checks
- Monitoring systems
- Quick API availability check

---

### GET /ready
**Purpose:** Check if all dependencies are ready

```bash
curl -X GET "$API_BASE/ready"
```

**Expected Response:**
```json
{
  "status": "ready",
  "timestamp": "2026-09-19T10:30:00Z",
  "checks": {
    "database": "ok",
    "postgis": "ok",
    "migrations": "ok",
    "installation": "ok"
  }
}
```

**Use Cases:**
- Kubernetes readiness probes
- Deployment verification
- Database migration checks

---

## 2. User Profile Endpoints

### GET /api/v1/me
**Purpose:** Get current user profile

```bash
curl -X GET "$API_BASE/api/v1/me"
```

**Expected Response:**
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "email": "demo@farmtwin.local",
  "display_name": "Demo User",
  "preferences": {},
  "created_at": "2026-09-01T00:00:00Z"
}
```

**Use Cases:**
- Get current user information
- Display user profile in UI
- Check authentication status

---

### PATCH /api/v1/me
**Purpose:** Update user display name

```bash
curl -X PATCH "$API_BASE/api/v1/me" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "John Farmer"
  }'
```

**Expected Response:**
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "email": "demo@farmtwin.local",
  "display_name": "John Farmer",
  "preferences": {},
  "created_at": "2026-09-01T00:00:00Z"
}
```

**Use Cases:**
- Update user profile
- Personalize user experience

---

## 3. Farm Management Endpoints

### GET /api/v1/farms
**Purpose:** List all farms for current user

```bash
# List all farms
curl -X GET "$API_BASE/api/v1/farms"

# With pagination
curl -X GET "$API_BASE/api/v1/farms?limit=10&offset=0"
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Kiambu Farm",
      "area_hectares": 5.2,
      "current_geometry_revision": 1,
      "created_at": "2026-09-01T08:30:00Z",
      "updated_at": "2026-09-01T08:30:00Z"
    }
  ],
  "limit": 50,
  "offset": 0,
  "total": 1
}
```

**Query Parameters:**
- `limit` (optional): Items per page (1-100, default 50)
- `offset` (optional): Zero-based offset (default 0)

**Use Cases:**
- Display farm list in UI
- Farm selection dropdown
- Dashboard farm overview

---

### GET /api/v1/farms/{farm_id}
**Purpose:** Get specific farm details with geometry

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID"
```

**Expected Response:**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Kiambu Farm",
  "area_hectares": 5.2,
  "current_geometry_revision": 1,
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [36.8, -1.2],
        [36.9, -1.2],
        [36.9, -1.3],
        [36.8, -1.3],
        [36.8, -1.2]
      ]
    ]
  },
  "centroid": {
    "type": "Point",
    "coordinates": [36.85, -1.25]
  },
  "created_at": "2026-09-01T08:30:00Z",
  "updated_at": "2026-09-01T08:30:00Z"
}
```

**Use Cases:**
- Display farm on map
- Show farm details page
- Edit farm form pre-fill

---

### POST /api/v1/farms
**Purpose:** Create a new farm

```bash
curl -X POST "$API_BASE/api/v1/farms" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Test Farm",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [36.8, -1.2],
        [36.81, -1.2],
        [36.81, -1.21],
        [36.8, -1.21],
        [36.8, -1.2]
      ]]
    }
  }'
```

**Expected Response:** `201 Created`
```json
{
  "id": "new-farm-uuid",
  "name": "New Test Farm",
  "area_hectares": 1.234,
  "current_geometry_revision": 1,
  "geometry": {...},
  "centroid": {...},
  "created_at": "2026-09-19T10:30:00Z",
  "updated_at": "2026-09-19T10:30:00Z"
}
```

**Validation Rules:**
- Minimum 3 vertices
- Valid WGS84 coordinates (longitude, latitude)
- Closed ring (first point equals last point)
- No self-intersections
- Valid topology

**Use Cases:**
- Create new farm from map drawing
- Import farm boundary from file
- Add farm to account

---

### PATCH /api/v1/farms/{farm_id}
**Purpose:** Update farm name or geometry

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"

# Update name only
curl -X PATCH "$API_BASE/api/v1/farms/$FARM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Farm Name"
  }'

# Update geometry
curl -X PATCH "$API_BASE/api/v1/farms/$FARM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [36.8, -1.2],
        [36.82, -1.2],
        [36.82, -1.22],
        [36.8, -1.22],
        [36.8, -1.2]
      ]]
    }
  }'
```

**Expected Response:** `200 OK` with updated farm

**Use Cases:**
- Rename farm
- Update farm boundary
- Correct farm outline

---

### DELETE /api/v1/farms/{farm_id}
**Purpose:** Delete a farm

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
curl -X DELETE "$API_BASE/api/v1/farms/$FARM_ID"
```

**Expected Response:** `204 No Content`

**Use Cases:**
- Remove farm from account
- Clean up test farms
- Account cleanup

---

## 4. Digital Twin Endpoints

### GET /api/v1/farms/{farm_id}/twin
**Purpose:** Get farm's environmental digital twin snapshot

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/twin"
```

**Expected Response:**
```json
{
  "snapshot_id": "snapshot-uuid",
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "created_at": "2026-09-19T10:00:00Z",
  "weather": {
    "temperature_celsius": 25.5,
    "rainfall_mm": 45.2,
    "humidity_percent": 65,
    "wind_speed_kmh": 12.3,
    "source": "open-meteo",
    "timestamp": "2026-09-19T09:00:00Z"
  },
  "soil": {
    "ph": 6.5,
    "organic_carbon_percent": 2.1,
    "texture": "clay-loam",
    "source": "soilgrids",
    "resolution_meters": 250
  },
  "satellite": {
    "ndvi": 0.72,
    "cloud_cover_percent": 15,
    "source": "sentinel-2",
    "capture_date": "2026-09-15"
  },
  "terrain": {
    "elevation_meters": 1650,
    "slope_degrees": 3.5,
    "aspect_degrees": 180,
    "source": "copernicus-dem",
    "resolution_meters": 30
  },
  "conduit": {
    "eligible": true,
    "distance_km": 12.5,
    "elevation_difference_m": 150,
    "latest_observation": {
      "temperature_celsius": 24.8,
      "humidity_percent": 68,
      "timestamp": "2026-09-19T09:30:00Z"
    }
  }
}
```

**Use Cases:**
- Display environmental overview
- Show farm conditions dashboard
- Get data for crop analysis

---

## 5. Crop Simulator Endpoints

### GET /api/v1/farms/{farm_id}/crops
**Purpose:** Get crop suitability rankings for farm

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/crops"
```

**Expected Response:**
```json
{
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "snapshot_id": "snapshot-uuid",
  "generated_at": "2026-09-19T10:00:00Z",
  "crops": [
    {
      "crop_id": "maize",
      "crop_name": "Maize",
      "suitability_score": 85,
      "suitability_class": "highly_suitable",
      "hard_exclusion": false,
      "component_scores": {
        "temperature": 90,
        "water": 80,
        "soil": 85,
        "wind": 95
      }
    },
    {
      "crop_id": "beans",
      "crop_name": "Beans",
      "suitability_score": 78,
      "suitability_class": "suitable",
      "hard_exclusion": false,
      "component_scores": {
        "temperature": 85,
        "water": 75,
        "soil": 80,
        "wind": 90
      }
    }
  ]
}
```

**Use Cases:**
- Display recommended crops
- Compare crop suitability
- Plan crop selection

---

### GET /api/v1/farms/{farm_id}/crops/{crop_id}
**Purpose:** Get detailed suitability analysis for specific crop

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
CROP_ID="maize"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/crops/$CROP_ID"
```

**Expected Response:**
```json
{
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "crop_id": "maize",
  "crop_name": "Maize",
  "snapshot_id": "snapshot-uuid",
  "suitability_score": 85,
  "suitability_class": "highly_suitable",
  "hard_exclusion": false,
  "component_scores": {
    "temperature": 90,
    "water": 80,
    "soil": 85,
    "wind": 95
  },
  "limiting_factors": [
    {
      "factor": "rainfall",
      "severity": "moderate",
      "message": "Rainfall slightly below optimal range"
    }
  ],
  "requirements": {
    "temperature_min_celsius": 15,
    "temperature_max_celsius": 35,
    "rainfall_min_mm": 400,
    "rainfall_max_mm": 1000,
    "soil_ph_min": 5.5,
    "soil_ph_max": 7.5
  },
  "generated_at": "2026-09-19T10:00:00Z"
}
```

**Use Cases:**
- Show detailed crop analysis
- Explain suitability factors
- Display crop requirements

---

## 6. Risk & Hazard Endpoints

### GET /api/v1/farms/{farm_id}/risks
**Purpose:** Get all hazard assessments for farm

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/risks"
```

**Expected Response:**
```json
{
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "snapshot_id": "snapshot-uuid",
  "generated_at": "2026-09-19T10:00:00Z",
  "hazards": [
    {
      "hazard_type": "drought",
      "level": "moderate",
      "probability": 0.45,
      "driver": "Below average rainfall forecast",
      "actions_available": 3
    },
    {
      "hazard_type": "heat",
      "level": "low",
      "probability": 0.15,
      "driver": "Temperature within normal range",
      "actions_available": 2
    },
    {
      "hazard_type": "heavy_rainfall",
      "level": "low",
      "probability": 0.10,
      "driver": "Normal precipitation patterns",
      "actions_available": 2
    },
    {
      "hazard_type": "wind",
      "level": "low",
      "probability": 0.08,
      "driver": "Low wind speeds expected",
      "actions_available": 1
    }
  ]
}
```

**Use Cases:**
- Display risk dashboard
- Show hazard warnings
- Prioritize farm actions

---

### GET /api/v1/farms/{farm_id}/risks/{hazard}
**Purpose:** Get detailed hazard assessment with recommended actions

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
HAZARD="drought"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/risks/$HAZARD"
```

**Expected Response:**
```json
{
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "hazard_type": "drought",
  "level": "moderate",
  "probability": 0.45,
  "driver": "Below average rainfall forecast",
  "snapshot_id": "snapshot-uuid",
  "environmental_factors": {
    "rainfall_mm": 350,
    "rainfall_trend": "decreasing",
    "soil_moisture_percent": 28
  },
  "actions": [
    {
      "action_id": "drought_001",
      "title": "Implement water conservation",
      "description": "Mulch crops to retain soil moisture",
      "priority": "high",
      "estimated_effort": "medium",
      "completed": false
    },
    {
      "action_id": "drought_002",
      "title": "Plant drought-resistant crops",
      "description": "Consider sorghum or millet for next season",
      "priority": "medium",
      "estimated_effort": "low",
      "completed": false
    }
  ],
  "generated_at": "2026-09-19T10:00:00Z"
}
```

**Use Cases:**
- Show hazard details
- Display recommended actions
- Track action completion

---

### POST /api/v1/farms/{farm_id}/actions/{action_id}/complete
**Purpose:** Mark an action as completed

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
ACTION_ID="drought_001"
curl -X POST "$API_BASE/api/v1/farms/$FARM_ID/actions/$ACTION_ID/complete"
```

**Expected Response:** `200 OK`
```json
{
  "action_id": "drought_001",
  "completed": true,
  "completed_at": "2026-09-19T10:30:00Z"
}
```

**Use Cases:**
- Track completed actions
- Update action status
- Show progress on recommendations

---

## 7. Annual Planner Endpoints

### GET /api/v1/farms/{farm_id}/plan
**Purpose:** Get annual crop planting plan

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"

# Current year
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/plan"

# Specific year
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/plan?year=2027"
```

**Expected Response:**
```json
{
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "year": 2026,
  "slots": [
    {
      "slot_id": "slot-uuid-1",
      "crop_id": "maize",
      "crop_name": "Maize",
      "month": 10,
      "month_name": "October",
      "suitability_score": 85,
      "notes": "Main season planting"
    },
    {
      "slot_id": "slot-uuid-2",
      "crop_id": "beans",
      "crop_name": "Beans",
      "month": 3,
      "month_name": "March",
      "suitability_score": 78,
      "notes": "Short rains season"
    }
  ],
  "proposals": [
    {
      "month": 11,
      "crop_id": "kale",
      "reason": "Excellent conditions for kale in November",
      "suitability_score": 92
    }
  ]
}
```

**Query Parameters:**
- `year` (optional): Plan year (default: current year)

**Use Cases:**
- Display annual planting calendar
- Show crop schedule
- Plan seasonal activities

---

### PATCH /api/v1/farms/{farm_id}/plan/slots
**Purpose:** Add or update planting slot

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"

curl -X PATCH "$API_BASE/api/v1/farms/$FARM_ID/plan/slots" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "month": 10,
    "crop_id": "maize",
    "notes": "Main season planting with irrigation"
  }'
```

**Expected Response:** `200 OK`
```json
{
  "slot_id": "new-slot-uuid",
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "year": 2026,
  "month": 10,
  "crop_id": "maize",
  "crop_name": "Maize",
  "suitability_score": 85,
  "notes": "Main season planting with irrigation",
  "created_at": "2026-09-19T10:30:00Z"
}
```

**Validation:**
- No overlapping crops in same month
- Valid crop ID
- Valid month (1-12)

**Use Cases:**
- Add crop to schedule
- Update planting notes
- Modify planting plan

---

### DELETE /api/v1/farms/{farm_id}/plan/slots/{slot_id}
**Purpose:** Remove a planting slot

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
SLOT_ID="slot-uuid-1"
curl -X DELETE "$API_BASE/api/v1/farms/$FARM_ID/plan/slots/$SLOT_ID"
```

**Expected Response:** `204 No Content`

**Use Cases:**
- Remove planned crop
- Adjust planting schedule
- Clear old plans

---

## 8. Climate Scenario Endpoints

### POST /api/v1/farms/{farm_id}/scenarios
**Purpose:** Run climate scenario analysis

```bash
FARM_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"

curl -X POST "$API_BASE/api/v1/farms/$FARM_ID/scenarios" \
  -H "Content-Type: application/json" \
  -d '{
    "rainfall_delta_percent": -20,
    "temperature_delta_celsius": 2.0,
    "description": "Drought scenario with warming"
  }'
```

**Expected Response:** `200 OK`
```json
{
  "scenario_id": "scenario-uuid",
  "farm_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "baseline_snapshot_id": "snapshot-uuid",
  "parameters": {
    "rainfall_delta_percent": -20,
    "temperature_delta_celsius": 2.0
  },
  "description": "Drought scenario with warming",
  "crop_impacts": [
    {
      "crop_id": "maize",
      "baseline_score": 85,
      "scenario_score": 62,
      "change": -23,
      "new_suitability_class": "marginally_suitable"
    },
    {
      "crop_id": "sorghum",
      "baseline_score": 70,
      "scenario_score": 78,
      "change": +8,
      "new_suitability_class": "suitable"
    }
  ],
  "hazard_impacts": {
    "drought": {
      "baseline_level": "moderate",
      "scenario_level": "high",
      "probability_change": +0.25
    },
    "heat": {
      "baseline_level": "low",
      "scenario_level": "moderate",
      "probability_change": +0.20
    }
  },
  "generated_at": "2026-09-19T10:30:00Z"
}
```

**Parameters:**
- `rainfall_delta_percent`: -30 to +30
- `temperature_delta_celsius`: -5 to +5
- `description` (optional): Scenario description

**Use Cases:**
- Climate change impact analysis
- What-if scenario planning
- Adaptation strategy testing

---

## 9. Conduit Data Endpoints

### GET /api/v1/conduit/current
**Purpose:** Get latest Conduit weather observation

```bash
curl -X GET "$API_BASE/api/v1/conduit/current"
```

**Expected Response:**
```json
{
  "station_id": "ICIPE_MBITA",
  "valid_time": "2026-09-19T09:30:00Z",
  "temperature_celsius": 24.8,
  "humidity_percent": 68,
  "wind_speed_kmh": 8.5,
  "wind_direction_degrees": 180,
  "pressure_hpa": 1013.2,
  "rainfall_mm": 0.0,
  "quality_flags": {
    "temperature": "good",
    "humidity": "good"
  }
}
```

**Use Cases:**
- Display current weather
- Show real-time conditions
- Weather station data

---

### GET /api/v1/conduit/features
**Purpose:** Get latest daily aggregated features

```bash
curl -X GET "$API_BASE/api/v1/conduit/features"
```

**Expected Response:**
```json
{
  "station_id": "ICIPE_MBITA",
  "date": "2026-09-19",
  "temperature_mean_celsius": 23.5,
  "temperature_min_celsius": 18.2,
  "temperature_max_celsius": 28.9,
  "humidity_mean_percent": 72,
  "rainfall_total_mm": 5.2,
  "vpd_mean_kpa": 1.2
}
```

**Use Cases:**
- Daily weather summary
- Historical weather data
- Weather trends

---

### GET /api/v1/conduit/history
**Purpose:** Get paginated observation history

```bash
# Recent history
curl -X GET "$API_BASE/api/v1/conduit/history"

# With pagination
curl -X GET "$API_BASE/api/v1/conduit/history?limit=100&offset=0"

# Specific time range
curl -X GET "$API_BASE/api/v1/conduit/history?start=2026-09-01T00:00:00Z&end=2026-09-19T23:59:59Z"
```

**Expected Response:**
```json
{
  "items": [
    {
      "station_id": "ICIPE_MBITA",
      "valid_time": "2026-09-19T09:00:00Z",
      "temperature_celsius": 24.5,
      "humidity_percent": 70
    }
  ],
  "limit": 50,
  "offset": 0,
  "total": 191
}
```

**Query Parameters:**
- `limit` (optional): Items per page (1-1000, default 50)
- `offset` (optional): Zero-based offset
- `start` (optional): Start timestamp (ISO 8601)
- `end` (optional): End timestamp (ISO 8601)

**Use Cases:**
- Historical weather analysis
- Data export
- Trend analysis

---

## 10. Data Sources Endpoints

### GET /api/v1/data-sources
**Purpose:** Get all data provider information and status

```bash
curl -X GET "$API_BASE/api/v1/data-sources"
```

**Expected Response:**
```json
{
  "providers": [
    {
      "provider_id": "open-meteo",
      "name": "Open-Meteo",
      "description": "Global weather forecast and historical data",
      "data_types": ["weather", "forecast"],
      "status": "available",
      "resolution": "1-hour",
      "coverage": "Global",
      "license": "CC BY 4.0",
      "url": "https://open-meteo.com"
    },
    {
      "provider_id": "sentinel-2",
      "name": "Sentinel-2",
      "description": "Satellite imagery from ESA Copernicus program",
      "data_types": ["satellite", "ndvi"],
      "status": "available",
      "resolution": "10-60 meters",
      "coverage": "Global, 5-day revisit",
      "license": "Free and open",
      "url": "https://sentinel.esa.int"
    },
    {
      "provider_id": "soilgrids",
      "name": "SoilGrids",
      "description": "Global soil information from ISRIC",
      "data_types": ["soil", "texture", "nutrients"],
      "status": "available",
      "resolution": "250 meters",
      "coverage": "Global",
      "license": "CC BY 4.0",
      "url": "https://soilgrids.org"
    },
    {
      "provider_id": "copernicus-dem",
      "name": "Copernicus DEM",
      "description": "Digital elevation model from ESA",
      "data_types": ["terrain", "elevation"],
      "status": "available",
      "resolution": "30 meters",
      "coverage": "Global",
      "license": "Free and open",
      "url": "https://spacedata.copernicus.eu"
    },
    {
      "provider_id": "era5-land",
      "name": "ERA5-Land",
      "description": "Climate reanalysis from ECMWF",
      "data_types": ["climate", "historical"],
      "status": "available",
      "resolution": "9 km",
      "coverage": "Global, 1950-present",
      "license": "Free and open",
      "url": "https://cds.climate.copernicus.eu"
    },
    {
      "provider_id": "conduit",
      "name": "Conduit Weather Stations",
      "description": "Local weather station network",
      "data_types": ["weather", "real-time"],
      "status": "demonstration",
      "resolution": "5-minute intervals",
      "coverage": "Kenya (selected stations)",
      "license": "Internal",
      "url": null
    }
  ]
}
```

**Use Cases:**
- Display data sources page
- Show provider status
- Data transparency
- Attribution requirements

---

## 11. Complete Use Case Workflows

### Use Case 1: Create Farm and Get Analysis

**Step 1: Create a new farm**
```bash
curl -X POST "$API_BASE/api/v1/farms" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farm",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [36.8, -1.2],
        [36.82, -1.2],
        [36.82, -1.22],
        [36.8, -1.22],
        [36.8, -1.2]
      ]]
    }
  }' | jq -r '.id'
```
Save the returned `farm_id`.

**Step 2: Get digital twin**
```bash
FARM_ID="<id-from-step-1>"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/twin" | jq
```

**Step 3: Get crop recommendations**
```bash
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/crops" | jq
```

**Step 4: Get risk assessment**
```bash
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/risks" | jq
```

---

### Use Case 2: Complete Planting Plan

**Step 1: Get current plan**
```bash
FARM_ID="<your-farm-id>"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/plan?year=2027" | jq
```

**Step 2: Add October maize planting**
```bash
curl -X PATCH "$API_BASE/api/v1/farms/$FARM_ID/plan/slots" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2027,
    "month": 10,
    "crop_id": "maize",
    "notes": "Main season planting"
  }' | jq
```

**Step 3: Add March beans planting**
```bash
curl -X PATCH "$API_BASE/api/v1/farms/$FARM_ID/plan/slots" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2027,
    "month": 3,
    "crop_id": "beans",
    "notes": "Short rains season"
  }' | jq
```

**Step 4: View complete plan**
```bash
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/plan?year=2027" | jq
```

---

### Use Case 3: Climate Scenario Analysis

**Step 1: Run baseline scenario (no change)**
```bash
FARM_ID="<your-farm-id>"
curl -X POST "$API_BASE/api/v1/farms/$FARM_ID/scenarios" \
  -H "Content-Type: application/json" \
  -d '{
    "rainfall_delta_percent": 0,
    "temperature_delta_celsius": 0,
    "description": "Baseline (current conditions)"
  }' | jq
```

**Step 2: Run drought scenario**
```bash
curl -X POST "$API_BASE/api/v1/farms/$FARM_ID/scenarios" \
  -H "Content-Type: application/json" \
  -d '{
    "rainfall_delta_percent": -30,
    "temperature_delta_celsius": 2.0,
    "description": "Severe drought with warming"
  }' | jq > drought_scenario.json
```

**Step 3: Run wet scenario**
```bash
curl -X POST "$API_BASE/api/v1/farms/$FARM_ID/scenarios" \
  -H "Content-Type: application/json" \
  -d '{
    "rainfall_delta_percent": 30,
    "temperature_delta_celsius": 0,
    "description": "Increased rainfall"
  }' | jq > wet_scenario.json
```

**Step 4: Compare results**
```bash
# Compare crop impacts
jq '.crop_impacts[] | select(.crop_id == "maize")' drought_scenario.json wet_scenario.json
```

---

### Use Case 4: Risk Management Workflow

**Step 1: Check all hazards**
```bash
FARM_ID="<your-farm-id>"
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/risks" | jq
```

**Step 2: Get details for highest risk hazard**
```bash
# If drought is highest risk
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/risks/drought" | jq > drought_details.json
```

**Step 3: View recommended actions**
```bash
jq '.actions[]' drought_details.json
```

**Step 4: Complete high-priority action**
```bash
ACTION_ID=$(jq -r '.actions[] | select(.priority == "high") | .action_id' drought_details.json | head -1)
curl -X POST "$API_BASE/api/v1/farms/$FARM_ID/actions/$ACTION_ID/complete" | jq
```

**Step 5: Verify completion**
```bash
curl -X GET "$API_BASE/api/v1/farms/$FARM_ID/risks/drought" | jq '.actions[] | select(.completed == true)'
```

---

## Testing Script

Create a test script `test_all_apis.sh`:

```bash
#!/bin/bash

API_BASE="http://localhost:8000"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Testing FarmTwin API Endpoints"
echo "==============================="

# Test health
echo -n "Testing /health... "
if curl -sf "$API_BASE/health" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test ready
echo -n "Testing /ready... "
if curl -sf "$API_BASE/ready" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test /api/v1/me
echo -n "Testing /api/v1/me... "
if curl -sf "$API_BASE/api/v1/me" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test /api/v1/farms
echo -n "Testing /api/v1/farms... "
if curl -sf "$API_BASE/api/v1/farms" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test /api/v1/data-sources
echo -n "Testing /api/v1/data-sources... "
if curl -sf "$API_BASE/api/v1/data-sources" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test /api/v1/conduit/current
echo -n "Testing /api/v1/conduit/current... "
if curl -sf "$API_BASE/api/v1/conduit/current" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo ""
echo "Testing complete!"
```

Run with:
```bash
chmod +x test_all_apis.sh
./test_all_apis.sh
```

---

## Additional Resources

- **Interactive API Documentation:** http://localhost:8000/docs
- **OpenAPI Specification:** http://localhost:8000/openapi.json
- **Backend README:** `backend/README.md`
- **API Contract:** `docs/api-contract.md`
