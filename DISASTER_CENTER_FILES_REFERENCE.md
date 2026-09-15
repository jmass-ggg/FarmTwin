# Disaster Center - Essential Files Reference

This document lists the exact files you need to read to understand or modify the Disaster Center (Risk Center). Read ONLY these files to save tokens.

---

## Backend Files (Priority Order)

### 1. Risk Calculations (CORE)
**File**: `backend/app/domain/risk_engine.py` (688 lines)
**What it does**: Calculates all 5 hazard assessments (Drought, Heat, Heavy Rainfall, Flood, Wind)
**Key functions**:
- `assess_all()` - Main entry point (line 688)
- `_assess_drought()` - Drought calculation (line 167)
- `_assess_heat()` - Heat stress calculation (line 264)
- `_assess_heavy_rainfall()` - Heavy rain calculation (line 346)
- `_assess_flood()` - Flood exposure calculation (line 401)
- `_assess_wind()` - Wind hazard calculation (line 506)
- `_resolve_actions()` - Action recommendation logic (line 590)

**Constants** (top of file):
- `DROUGHT_HIGH_RATIO = 0.60` - Drought thresholds
- `HEAT_HIGH_TEMP = 33.0` - Heat thresholds
- `HEAVY_RAIN_HIGH_MM = 120.0` - Rain thresholds
- `WIND_HIGH_MS = 15.0` - Wind thresholds

### 2. API Route Handler
**File**: `backend/app/api/v1/risks.py` (216 lines)
**What it does**: HTTP endpoint handlers for `/farms/{farm_id}/risks` and `/farms/{farm_id}/actions/{action_id}`
**Key functions**:
- `get_farm_risks()` - GET /risks endpoint (line 142)
- `complete_farm_action()` - PATCH /actions endpoint (line 186)
- Converter functions that transform domain objects to API responses

### 3. Business Logic Service
**File**: `backend/app/services/risk_service.py` (193 lines)
**What it does**: Orchestrates farm ownership checks, snapshot loading, and risk engine calls
**Key functions**:
- `get_risks()` - Main service function (line 67)
- `complete_action()` - Action completion service (line 123)
- `_load_latest_snapshot()` - Fetch snapshot from DB (line 34)

### 4. Data Context Builder
**File**: `backend/app/domain/snapshot_context.py` (235 lines)
**What it does**: Converts snapshot data into the format the risk engine needs
**Key functions**:
- `context_for_risks()` - Builds context from snapshot (line 217)
- `context_from_snapshot()` - General context builder (line 150)
- `context_from_demonstration()` - Demo fallback (line 126)

**Important**: Line 232 shows how climate baseline is calculated for drought

### 5. API Response Schemas
**File**: `backend/app/api/v1/risk_schemas.py` (~100 lines)
**What it does**: Pydantic models defining the API response structure
**Key classes**:
- `RiskResponse` - Top-level response
- `HazardAssessmentResponse` - Single hazard
- `ActionRuleResponse` - Action recommendation
- `ActionCompletionResponse` - Action completion result

### 6. Action Rules (Optional)
**File**: `backend/app/domain/risk_rules.py`
**What it does**: Defines all action recommendations and conflict resolution
**When to read**: Only if modifying action recommendations

---

## Frontend Files (Priority Order)

### 1. Main Page Component (CORE)
**File**: `frontend/app/app/farms/[farmId]/risks/page.tsx` (480 lines)
**What it does**: The entire Disaster Center page
**Key components** (all inline):
- `RiskCenterPage` - Main page component (line 288)
- `HazardCard` - Individual hazard card (line 261)
- `HazardDetailPanel` - Sidebar detail view (line 150)
- `ActionRow` - Action checkbox item (line 75)
- `ProposalDialog` - Change proposals (if needed)

**Key state**:
- `risks` - All hazard data from API
- `selectedHazard` - Currently selected hazard
- `loading` / `error` - UI state

### 2. API Client
**File**: `frontend/lib/api/risks.ts` (100 lines)
**What it does**: Fetches data from backend API
**Key functions**:
- `getFarmRisks()` - GET /risks
- `completeAction()` - PATCH /actions/{id}

**Key types**:
- `RiskResponse` - API response shape
- `HazardAssessment` - Single hazard shape
- `ActionRule` - Action item shape

---

## Quick File Summary by Purpose

### To Understand Risk Calculations:
1. `backend/app/domain/risk_engine.py` (MUST READ)
2. `backend/app/domain/snapshot_context.py` (lines 217-234 only)

### To Understand API Flow:
1. `backend/app/api/v1/risks.py` (route handler)
2. `backend/app/services/risk_service.py` (business logic)

### To Understand Frontend:
1. `frontend/app/app/farms/[farmId]/risks/page.tsx` (entire UI)
2. `frontend/lib/api/risks.ts` (API client)

### To Modify Thresholds:
- Edit constants at top of `backend/app/domain/risk_engine.py` (lines 20-44)

### To Modify UI Labels/Text:
- Edit helper functions in `frontend/app/app/farms/[farmId]/risks/page.tsx`:
  - `hazardLabel()` - line 22
  - `horizonLabel()` - line 33
  - `dateModeLabel()` - line 41

### To Add New Hazard Type:
1. Add assessor function in `backend/app/domain/risk_engine.py`
2. Call it in `assess_all()` function
3. Frontend will automatically display it (no changes needed)

---

## Data Flow (Quick Reference)

```
1. HTTP Request → backend/app/api/v1/risks.py::get_farm_risks()
                     ↓
2. Service Call → backend/app/services/risk_service.py::get_risks()
                     ↓
3. Load Snapshot → Query database for latest AnalysisSnapshot
                     ↓
4. Build Context → backend/app/domain/snapshot_context.py::context_for_risks()
                     ↓
5. Calculate Risks → backend/app/domain/risk_engine.py::assess_all()
                     ↓
6. Return Response → Convert domain objects to API schemas
                     ↓
7. Frontend Receives → frontend/lib/api/risks.ts::getFarmRisks()
                     ↓
8. Display UI → frontend/app/app/farms/[farmId]/risks/page.tsx
```

---

## Current Known Issues (as of inspection)

### Bug 1: Drought Index Calculation
- **File**: `backend/app/domain/risk_engine.py`
- **Line**: 199
- **Problem**: `(1.0 - ratio) * 100` produces negative values when ratio > 1.0, clamped to 0
- **Fix**: Need different formula that handles ratio > 1.0 correctly

### Bug 2: Heat Index Calculation
- **File**: `backend/app/domain/risk_engine.py`
- **Line**: 298
- **Problem**: `(temp - 20.0) / 15.0 * 100` produces negative values when temp < 20°C, clamped to 0
- **Fix**: Need different formula or explicitly handle cold temperatures

### Bug 3: Grammar Error
- **File**: `backend/app/domain/risk_engine.py`
- **Line**: 213
- **Problem**: "an baseline" should be "a baseline"
- **Fix**: Change "an" to "a"

---

## Testing Files (Optional)

**File**: `backend/tests/test_risks_integration.py`
- Integration tests for the entire risk flow
- Useful for understanding expected behavior

**File**: `backend/tests/test_risk_engine_properties.py`
- Property-based tests for risk calculations
- Useful for understanding edge cases

---

## DON'T Read These (Waste of Tokens)

❌ `backend/app/models/` - Database models (not needed for logic)
❌ `backend/app/repositories/` - Database queries (handled by service)
❌ `backend/app/core/` - Infrastructure (auth, config, etc.)
❌ `frontend/components/ui/` - Generic UI components
❌ `frontend/app/globals.css` - Styling only
❌ Any files related to crops, planner, or twin (different features)

---

## Minimal Reading Path

If you have very limited tokens, read ONLY these 3 files:

1. **`backend/app/domain/risk_engine.py`** - All calculation logic (688 lines)
2. **`frontend/app/app/farms/[farmId]/risks/page.tsx`** - All UI logic (480 lines)  
3. **`frontend/lib/api/risks.ts`** - API types and client (100 lines)

Total: ~1,268 lines instead of reading thousands of lines across the entire codebase.

---

## Line Number Quick Reference

### Backend Risk Engine (`risk_engine.py`)
- Constants/Thresholds: Lines 1-44
- Drought: Lines 167-241
- Heat: Lines 264-344
- Heavy Rainfall: Lines 346-399
- Flood: Lines 401-504
- Wind: Lines 506-588
- Action Resolution: Lines 590-686
- Main Entry: Lines 688-742

### Frontend Risk Page (`risks/page.tsx`)
- Helper Functions: Lines 22-50
- ActionRow Component: Lines 75-140
- HazardDetailPanel: Lines 150-258
- HazardCard: Lines 261-285
- Main Page: Lines 288-480

### API Types (`risks.ts`)
- Types: Lines 1-50
- Error Classes: Lines 52-65
- API Functions: Lines 67-100
