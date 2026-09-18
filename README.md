# FarmTwin

**Climate-Smart Farm Planning & Decision Support Platform**

FarmTwin is an agricultural decision support system that helps farmers and agricultural advisors make informed crop planning decisions based on real environmental evidence. By creating a "digital twin" of a farm that combines terrain, soil, climate, weather, and satellite data, FarmTwin provides evidence-based recommendations while maintaining complete transparency about data sources, quality, and uncertainty.

## What FarmTwin Does

FarmTwin helps farmers answer critical questions:
- **What crops are suitable** for my specific farm location and soil conditions?
- **When should I plant** based on rainfall patterns and climate forecasts?
- **What risks** does my farm face from drought, floods, or extreme weather?
- **How will climate change** affect my planting windows and crop choices?

### Core Capabilities

#### 🗺️ Farm Digital Twin
Create a comprehensive environmental profile of your farm by connecting multiple data sources:
- **Terrain**: Elevation, slope, and topography from digital elevation models
- **Soil**: Composition, pH, organic carbon from global soil databases
- **Weather**: Real-time conditions and 7-day forecasts from Open-Meteo
- **Climate**: Long-term patterns, anomalies, and seasonal trends
- **Satellite**: NDVI vegetation index and land cover analysis
- **Local Stations**: High-resolution weather data from nearby ground stations (Conduit)

Every data point includes full provenance: source, timestamp, quality rating, and geographic relevance.

#### 🌱 Crop Simulator
Compare crop suitability using transparent, rule-based logic:
- Evaluate crops against rainfall, temperature, soil, and terrain requirements
- See exactly why each crop is rated suitable, marginal, or unsuitable
- Understand which environmental factors drive each recommendation
- No "black box" algorithms—every decision is explained

#### 📅 Annual Crop Plan
Transform crop recommendations into a practical 12-month planting calendar:
- Visualize planting windows aligned with rainfall seasons
- Plan crop rotations and sequential plantings
- Adjust plans based on changing conditions
- Track implementation progress throughout the year

#### ⚠️ Disaster Center
Understand and prepare for agricultural hazards:
- Drought, flood, heat stress, and heavy rainfall risks
- Explained risk drivers based on climate and weather data
- Practical mitigation actions specific to each hazard
- Unknown risks stay unknown—no false confidence from missing data

#### 🌦️ Climate Overview
Access comprehensive climate intelligence in one dashboard:
- Current weather conditions with live updates
- 7-day weather forecasts for planning field activities
- Monthly and seasonal climate patterns
- Annual climate trends and growing period recommendations

## How It Works

### 1. Define Your Farm
Draw your farm boundary on an interactive map. FarmTwin validates the geometry and calculates the area.

### 2. Gather Evidence
FarmTwin automatically fetches environmental data from multiple sources:
- Global terrain models (SRTM, ASTER)
- Soil databases (SoilGrids, iSDA Africa)
- Weather APIs (Open-Meteo)
- Satellite imagery (Sentinel-2 via Microsoft Planetary Computer)
- Climate baselines (CHIRPS, ERA5)

### 3. Build the Digital Twin
All evidence is combined into a versioned "snapshot"—a point-in-time environmental profile of your farm with complete metadata about data quality, source, and acquisition time.

### 4. Make Decisions
Use the twin to:
- Simulate crop suitability
- Plan planting calendars
- Assess climate risks
- Explore "what-if" scenarios

## Key Principles

### 🔍 Transparency First
- Every result shows its data source and quality
- Unknown data stays unknown—no synthetic values
- Data modes clearly separated: Live, Historical Replay, or Demonstration

### 📊 Evidence-Based
- Decisions grounded in real environmental data
- Explicit uncertainty when data is missing or low-quality
- Full provenance chain from satellite/sensor to recommendation

### 🌍 Climate-Aware
- Climate change impacts built into crop requirements
- Seasonal forecasts inform planting windows
- Historical climate baselines show long-term trends

### 🚫 No Black Boxes
- Crop suitability rules are transparent and explainable
- Risk assessments show their logic
- Users understand *why* recommendations are made

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (React, TypeScript)
- **Styling**: Tailwind CSS
- **Maps**: MapLibre GL JS + Mapbox
- **UI Components**: Radix UI, Lucide icons

### Backend
- **API**: Python 3.12 + FastAPI
- **Database**: PostgreSQL 16 + PostGIS 3.4
- **Validation**: Pydantic v2
- **Testing**: Pytest

### Data Sources
- **Weather**: Open-Meteo API
- **Soil**: SoilGrids250m, iSDA Africa
- **Terrain**: SRTM, ASTER GDEM
- **Satellite**: Sentinel-2 (Microsoft Planetary Computer)
- **Climate**: CHIRPS rainfall, ERA5 reanalysis

## Project Status

FarmTwin is under active development. Current implementation includes:

✅ **Completed**:
- Farm creation and boundary management
- Environmental data integration (weather, soil, terrain, satellite)
- Farm Digital Twin with evidence provenance
- Crop Simulator with 20+ supported crops
- Annual Crop Planner
- Climate Overview dashboard
- Disaster Center with risk assessment

🚧 **In Progress**:
- Climate UI redesign
- Enhanced forecast visualization
- Growing period recommendations
- Offline capability

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ and npm (for frontend development)
- Python 3.12+ (for backend development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd farmtwin
   ```

2. **Start the services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - API docs: http://localhost:8000/docs

### Development Setup

See detailed setup instructions in:
- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)

## Documentation

- **[API Contract](./docs/api-contract.md)**: Complete API specification
- **[Data Sources](./docs/data-sources.md)**: Environmental data providers
- **[Architecture](./docs/architecture-decisions.md)**: Design decisions
- **[Deployment](./docs/deployment.md)**: Security and infrastructure

## Contributing

This is currently a private development project. For questions or collaboration opportunities, please contact the project maintainer.

## License

Proprietary - All rights reserved

---

**FarmTwin** • Understand your farm before you plant.
