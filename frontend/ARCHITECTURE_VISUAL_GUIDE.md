# Visual Architecture Guide - Quick Reference

Use this guide for quick visual understanding of how the three main pages work.

---

## Page Navigation Structure

```
/app/farms/[farmId]/
├── twin              → Farm Digital Twin (overview)
├── crops             → Crop Simulator (Phase 6)
├── risks             → Disaster Center (Phase 7)
└── annual-plan       → Annual Planner (Phase 8)
```

---

## 1. Crop Simulator Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CROP SIMULATOR PAGE                       │
│                 /farms/[farmId]/crops                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │      USER CONTROLS (Top Bar)         │
         ├──────────────────────────────────────┤
         │ • Planting Date (date picker)        │
         │ • Cultivation Mode (rain-fed/irrig)  │
         │ • Irrigation Amount (if irrigated)   │
         │ • Category Filter (chips)            │
         │ • Search Input                       │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │     API: simulateCrop(params)        │
         │   POST /api/v1/farms/{id}/simulate   │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │   Response: CropRankingResponse      │
         │   { ranked: SimulationResult[] }     │
         └──────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────┐  ┌──────────────────────┐
│      CROP GRID (Main View)         │  │  DETAIL PANEL (Side) │
├────────────────────────────────────┤  ├──────────────────────┤
│ [Card] Maize      82% ✓            │  │  Selected: Maize     │
│ [Card] Tomato     78% ✓            │  │  Score: 82%          │
│ [Card] Cabbage    65% ⚠            │  │                      │
│ [Card] Beans      45% ⚠            │  │  Tabs:               │
│ [Card] Wheat      32% ⚠            │  │  - Overview          │
│ [Card] Potato     15% ✗            │  │  - Requirements      │
│ ...                                │  │  - Risks             │
│                                    │  │                      │
│ Click card → loads detail →────────┼──►  [Add to Plan] Btn  │
└────────────────────────────────────┘  └──────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │    CLIMATE WHAT-IF (Bottom)          │
         ├──────────────────────────────────────┤
         │ Rainfall: [slider] ±50%              │
         │ Temperature: [slider] ±5°C           │
         │ [Apply] [Reset]                      │
         │                                      │
         │ → Shows comparison table             │
         │   (Baseline vs Scenario)             │
         └──────────────────────────────────────┘
```

---

## 2. Disaster Center Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   DISASTER CENTER PAGE                       │
│                  /farms/[farmId]/risks                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │      API: getFarmRisks(farmId)       │
         │     GET /api/v1/farms/{id}/risks     │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │      Response: RiskResponse          │
         │   { assessments: [5 hazards] }       │
         └──────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────┐  ┌──────────────────────┐
│    HAZARD GRID (5 Cards)           │  │  DETAIL PANEL (Side) │
├────────────────────────────────────┤  ├──────────────────────┤
│ [Card] Drought       🛡️ HIGH       │  │  Drought             │
│   Driver: rainfall_deficit         │  │  Level: HIGH         │
│   2/3 actions done                 │  │  Index: 85/100       │
│                                    │  │                      │
│ [Card] Heat Stress   🛡️ MEDIUM    │  │  Explanation: ...    │
│   Driver: temperature_extremes     │  │                      │
│   0/2 actions done                 │  │  At-risk crops:      │
│                                    │  │  • Maize             │
│ [Card] Heavy Rain    🛡️ LOW       │  │  • Beans             │
│   Driver: precipitation            │  │                      │
│   0/1 actions done                 │  │  Actions:            │
│                                    │  │  ☐ P1: Prepare irrig │
│ [Card] Flood         🛡️ UNKNOWN   │  │  ☑ P2: Check wells   │
│   Evidence missing                 │  │  ☐ P3: Monitor soil  │
│                                    │  │                      │
│ [Card] Wind          🛡️ MEDIUM    │  │  [Evidence Used]     │
│   Driver: wind_speed               │  │  rainfall: complete  │
│                                    │  │  soil: partial       │
│ Click card → shows detail ─────────┼──►  temp: complete     │
└────────────────────────────────────┘  └──────────────────────┘
                                                   │
                                                   ▼
                                        ┌──────────────────────┐
                                        │ Click action checkbox│
                                        │         ↓            │
                                        │ completeAction(id)   │
                                        │         ↓            │
                                        │ PATCH /actions/{id}  │
                                        │         ↓            │
                                        │ Checkbox becomes ✓   │
                                        └──────────────────────┘
```

---

## 3. Annual Planner Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  ANNUAL PLANNER PAGE                         │
│               /farms/[farmId]/annual-plan                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  API: calculateDecisionSupport()     │
         │     + getAnnualPlan(year)            │
         │  (Two parallel queries)              │
         └──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLIMATE WHAT-IF (Top)                     │
├─────────────────────────────────────────────────────────────┤
│ Rainfall: [slider] ±50%  Temperature: [slider] ±5°C         │
│ [Apply] [Reset]                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              MONTH GRID (12 Months)                          │
├─────────────────────────────────────────────────────────────┤
│ [JAN]     [FEB]     [MAR]     [APR]                         │
│ Maize 85  Tomato 92 Beans 78  Cabbage 81                    │
│ Beans 72  Maize 85  Wheat 65  Tomato 75                     │
│ ✓ Saved              ✓ Saved                                │
│                                                              │
│ [MAY]     [JUN]     [JUL]     [AUG]                         │
│ Wheat 88  Potato 79 Maize 91  Beans 83                      │
│ Potato 76 Beans 72  Tomato 80 Wheat 76                      │
│                                                              │
│ [SEP]     [OCT]     [NOV]     [DEC]                         │
│ Beans 86  Cabbage 88 Tomato 84 Maize 82                     │
│ Maize 81  Tomato 82  Wheat 78 Potato 74                     │
│           ✓ Saved                                            │
│                                                              │
│ Click month → shows detail below ──────────────────────────► │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            SELECTED MONTH DETAIL (Card)                      │
├─────────────────────────────────────────────────────────────┤
│ MARCH                                                        │
│ Expected: 22°C, 85mm rainfall                               │
│ Planting window: Early March - Late March                   │
│ Main risk: Late season drought                              │
│                                                              │
│ Top Recommendations:                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #1 GOOD MATCH - Beans (78%)                             │ │
│ │ Why: Temperature ideal, adequate rainfall expected      │ │
│ │ [Add to Plan] ← Opens form dialog                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #2 POSSIBLE MATCH - Wheat (65%)                         │ │
│ │ Why: Cooler temps benefit this crop                     │ │
│ │ [Add to Plan]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          SCENARIO COMPARISON TABLE (Bottom)                  │
├─────────────────────────────────────────────────────────────┤
│ Crop      │ Baseline │ Scenario │ Change                    │
│ ──────────┼──────────┼──────────┼────────                   │
│ Maize     │ 85       │ 78       │ -7 ▼                      │
│ Beans     │ 78       │ 82       │ +4 ▲                      │
│ Wheat     │ 65       │ 70       │ +5 ▲                      │
│ ...       │ ...      │ ...      │ ...                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              MY SCHEDULE (Saved Entries)                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Maize  📅 2026-01-15 → 2026-04-30  Rain-fed  2.5 ha    │ │
│ │ Suitability: 85                                  [🗑️]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Beans  📅 2026-03-01 → 2026-05-20  Irrigated  1.0 ha   │ │
│ │ Suitability: 78                                  [🗑️]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [🔔 2 proposals pending] ← Click to review changes          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Comparison

### Crop Simulator
```
Controls Change → simulateCrop() → Ranked List → Display Grid
                                                      │
Card Click → simulateCrop(crop_name) → Selected Crop ┘
```

### Disaster Center
```
Page Load → getFarmRisks() → 5 Hazards → Display Grid
                                             │
Card Click → Find in local state → Show Panel
                                       │
Action Click → completeAction() → Update local state
```

### Annual Planner
```
Month Selection → calculateDecisionSupport() → Month Data → Display Detail
                                                               │
Add to Plan → createPlanEntry() → Invalidate → Re-fetch ──────┘
                                                   │
                                    My Schedule updates ────────┘
```

---

## 5. State Management Patterns

### Pattern 1: Local State + Manual Fetch (Disaster Center)
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function load() {
    const result = await apiCall();
    setData(result);
  }
  load();
}, [dependency]);
```

### Pattern 2: React Query (Annual Planner)
```typescript
const query = useQuery({
  queryKey: ['key', param1, param2],
  queryFn: ({ signal }) => apiCall(param1, param2, signal)
});

// Access: query.data, query.isLoading, query.isError
```

### Pattern 3: Local State + useCallback (Crop Simulator)
```typescript
const loadData = useCallback(async (signal) => {
  setLoading(true);
  const result = await apiCall(signal);
  setData(result);
  setLoading(false);
}, [dependencies]);

useEffect(() => {
  const controller = new AbortController();
  loadData(controller.signal);
  return () => controller.abort();
}, [loadData]);
```

---

## 6. Component Architecture

### Shared Pattern: Grid + Detail Sidebar
All three pages follow this layout:

```
┌────────────────────────────────────────────────┐
│              PAGE HEADER + CONTROLS             │
├───────────────────────────┬────────────────────┤
│                           │                    │
│        GRID VIEW          │   DETAIL PANEL     │
│    (Cards/Items)          │   (Sidebar)        │
│                           │                    │
│  - Crop cards             │   Selected item    │
│  - Hazard cards           │   details          │
│  - Month cards            │                    │
│                           │                    │
│  Click item → ────────────┼─► Shows here       │
│                           │                    │
└───────────────────────────┴────────────────────┘
│              BOTTOM SECTION                     │
│   - Scenario comparison                         │
│   - Saved schedule                              │
│   - Additional info                             │
└────────────────────────────────────────────────┘
```

---

## Quick Tips

1. **Finding the right file**: Use the page path to locate the file
   - `/crops` → `frontend/app/app/farms/[farmId]/crops/page.tsx`
   - `/risks` → `frontend/app/app/farms/[farmId]/risks/page.tsx`
   - `/annual-plan` → `frontend/app/app/farms/[farmId]/annual-plan/page.tsx`

2. **API client location**: All in `frontend/lib/api/`
   - Crops: `crops.ts`
   - Risks: `risks.ts`
   - Planner: `planner.ts`
   - Scenarios: `scenarios.ts`

3. **Shared components**: Check `frontend/features/` and `frontend/components/`
   - CropCard, CropDetailPanel: `features/crops/`
   - ScenarioControls: `features/decision/`
   - Button, Dialog, Skeleton: `components/ui/`

4. **Type definitions**: Look in the API client files first
   - Each API client exports its own types
   - Import from `@/lib/api/{module}`

5. **CSS classes**: Follow BEM-like naming
   - Block: `.crop-card`, `.risk-card`, `.month-grid`
   - Element: `.crop-card-header`, `.risk-detail-panel`
   - Modifier: `data-selected`, `data-level`, `data-mode`
