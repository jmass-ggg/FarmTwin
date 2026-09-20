# FarmTwin

FarmTwin helps farmers understand their land using real environmental data and provides evidence-based crop, climate, water, and risk recommendations.

## The Problem

Farmers need to make critical decisions about what crops to plant, when to plant them, water requirements, and climate risks. However, useful environmental information is scattered across different systems and providers. FarmTwin brings that data together into one digital profile specific to each farm.

## What FarmTwin Does

Select your farm on a map and FarmTwin gathers environmental data from multiple sources:

- **Weather**: Current conditions and 7-day forecasts
- **Satellite**: Vegetation health (NDVI) and moisture proxy (NDMI) from Sentinel-2
- **Soil**: pH, texture, organic carbon, and other properties
- **Terrain**: Elevation, slope, and topography
- **Climate**: Long-term patterns, seasonal trends, and anomalies

This data is combined into a **Farm Digital Twin** - a complete environmental profile of your specific farm.

FarmTwin then provides:

- **Crop suitability scores** - Which crops match your farm conditions
- **Best crop recommendations** - Data-driven planting suggestions
- **Annual crop planning** - 12-month planting calendar with rotation
- **Water requirements** - Rainfall needs and irrigation guidance
- **Risk alerts** - Drought, flood, heat, and other hazard assessments

## How FarmTwin Works

![FarmTwin System Flow](photos/workflow.png)

The FarmTwin process follows these steps:

```
1. Select Farm (draw boundary on map)
          ↓
2. Collect Environmental Data (from 6 data sources)
          ↓
3. Build Farm Digital Twin (unified environmental profile)
          ↓
4. Analyze Farm (crop engine + risk engine + planner)
          ↓
5. Recommendations (suitability scores, risks, and annual plan)
```

## Data Sources

FarmTwin integrates data from multiple environmental providers:

| Data | Source | Purpose |
|------|--------|---------|
| **Weather** | Open-Meteo | Current conditions and 7-day forecast |
| **Satellite** | Copernicus Sentinel-2 (L2A) | NDVI vegetation health and NDMI moisture proxy |
| **Soil** | SoilGrids v2.0 (ISRIC) | pH, texture, bulk density, organic carbon |
| **Terrain** | Copernicus DEM GLO-30 | Elevation, slope, and topography |
| **Climate** | Open-Meteo ERA5-Land | 30-year baselines and anomalies |
| **Station** | Conduit IoT sensors | High-resolution local weather (when configured) |

All data includes complete provenance: source, timestamp, quality rating, and spatial resolution.

## Farm Digital Twin

FarmTwin creates a digital environmental profile by combining all data sources:

```
Weather + Satellite + Soil + Terrain + Climate + Station
                      ↓
           Farm Digital Twin
```

This creates one unified environmental snapshot for your farm. Every data point includes its source, acquisition time, and quality rating. Missing or low-quality data is never fabricated - it stays explicitly unavailable.

## Core Engines

### Crop Engine

Scores crop suitability based on your farm's actual conditions against each crop's requirements. The scoring logic is completely transparent - you can see exactly why each crop received its rating.

**Key features:**
- Rainfall matching (seasonal patterns)
- Temperature requirements (min/max/optimal)
- Soil compatibility (pH, texture, drainage)
- Terrain suitability (elevation, slope)
- Transparent scoring - no "black box" algorithms

### Risk Engine

Analyzes climate and weather hazards affecting your farm:

- **Drought exposure** - rainfall deficits and water stress
- **Heat stress** - extreme temperature events
- **Heavy rainfall** - flooding and waterlogging risks
- **Wind damage** - high wind exposure
- **Seasonal patterns** - climate trend analysis

Each risk assessment shows the data and logic behind the calculation.

### Annual Planner

Creates a practical 12-month crop calendar based on:

- Crop suitability scores from the Crop Engine
- Rainfall seasons and planting windows
- Crop rotation compatibility
- Growing period requirements

The planner generates month-by-month recommendations with specific crops and activities.

### AI Explanations

The system uses AI to generate natural language explanations of calculated results. AI does **not** calculate crop scores or risk assessments - those come from deterministic rule-based engines. AI only helps communicate the results in plain language.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (Vinext beta)
- **Language**: TypeScript + React 19
- **Styling**: Tailwind CSS
- **Maps**: MapLibre GL JS
- **UI**: Radix UI components

### Backend
- **API**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 16 + PostGIS 3.4
- **Queue**: Redis 7
- **Worker**: Background job processor
- **Validation**: Pydantic v2

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Spatial**: PostGIS for geometry operations
- **Testing**: Pytest + Hypothesis (property-based testing)

### Data Providers
- **Weather**: Open-Meteo API
- **Climate**: ERA5-Land reanalysis via Open-Meteo
- **Satellite**: Sentinel-2 via Copernicus Data Space Ecosystem
- **Soil**: SoilGrids250m (ISRIC)
- **Terrain**: Copernicus DEM GLO-30 (AWS Open Data)
- **Station**: Conduit IoT sensors (optional)

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- 8GB RAM minimum
- Internet connection for data sources

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd farmtwin
   ```

2. **Configure environment** (optional)
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env if you want to add Copernicus credentials for satellite data
   ```

3. **Build and start services**
   ```bash
   docker compose build
   docker compose up -d
   ```

4. **Wait for startup** (30-60 seconds)
   ```bash
   docker compose ps
   ```

5. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Docs**: http://localhost:8000/docs

### Stopping Services

```bash
docker compose down
```

To remove all data:
```bash
docker compose down -v
```

## Project Status

FarmTwin is under active development for agricultural decision support in Kenya.

**Completed:**
- Farm creation and boundary management
- Farm Digital Twin with 6 data sources
- Crop Simulator (20+ supported crops)
- Annual Crop Planner with rotation
- Risk/Disaster Center
- Climate Overview dashboard

**In Progress:**
- Enhanced forecast visualization
- Growing period recommendations
- Offline capability

## Data Accuracy

FarmTwin provides decision support based on available environmental data. Important notes:

- **Data resolution**: Each provider has different spatial resolution (250m for soil, 30m for terrain, etc.)
- **Modeled estimates**: Soil properties are modeled, not direct measurements
- **Crop scores**: Calculated using rule-based logic comparing farm conditions to crop requirements
- **Risk assessments**: Based on climate and weather data analysis
- **Recommendations, not guarantees**: Results are decision support tools to inform planning

External data providers (Open-Meteo, SoilGrids, Copernicus) have their own accuracy specifications and limitations. FarmTwin transparently reports data quality and uncertainty.

## Documentation

- **Backend Setup**: `backend/README.md`
- **Frontend Setup**: `frontend/README.md`
- **API Contract**: `docs/api-contract.md`
- **Data Sources**: `docs/data-sources.md`
- **Architecture**: `docs/architecture-decisions.md`

## License

Proprietary - All rights reserved

---

**FarmTwin** • Understand your farm before you plant.

*Better decisions. Healthier farms. Greener Kenya.*
