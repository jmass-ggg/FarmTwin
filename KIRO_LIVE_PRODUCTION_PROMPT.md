# FarmTwin live application repair and completion prompt for Kiro

You are the senior full-stack engineer responsible for turning the existing FarmTwin repository into a coherent, live-data application. Work directly in the existing repository. Do not create a replacement prototype beside it, do not stop after producing an audit, and do not claim completion until the complete user journey has been exercised in a browser.

## Primary objective

Build the FarmTwin experience shown in the supplied reference screens while preserving truthful environmental evidence. A user must be able to create a farm by locating and drawing their actual land, save and later edit the boundary, run environmental analysis, inspect the resulting Digital Twin, simulate crops, build an annual plan, review hazards, and inspect climate data.

The current application mixes live provider results with seeded demonstration farms, synthetic planning calculations, incomplete styling, and disconnected routes. Remove that mixed behavior. Normal application routes must operate on the signed-in user's persisted farms and real provider results. Missing provider evidence must remain visibly unavailable. Never replace missing live data with invented scores, neutral defaults, fixture values, or silent demonstration fallback.

Do not work on Docker images, Compose, deployment, hosting, infrastructure provisioning, monitoring infrastructure, or production rollout in this task. Use the existing local frontend and backend commands. Production-ready in this task means correct application behavior, clear configuration, safe database behavior, authorization boundaries, truthful live data, responsive UI, robust errors, and adequate tests.

## Mandatory preparation

1. Read `../project_build.md` completely. It is the product and architecture contract.
2. Read the repository instructions and configuration files before editing.
3. Inspect `git status` and preserve all current user changes. Never reset, discard, overwrite, or mass-format unrelated work.
4. Trace every visible frontend value back through its API schema, service, domain engine, provider payload, and persisted model.
5. Run the existing frontend tests and build before changing code. Set up the documented local Python environment and run backend tests without introducing Docker work.
6. Record the initial failures, then continue implementing. The audit is preparation, not the deliverable.

## Repository structure and ownership

Use the existing structure rather than adding another application layer.

```text
farmtwin/
├── frontend/
│   ├── app/
│   │   ├── page.tsx                         public landing page
│   │   ├── globals.css                      shared application styling
│   │   └── app/
│   │       ├── page.tsx                     farm overview/selection
│   │       ├── farms/new/page.tsx           farm creation
│   │       └── farms/[farmId]/
│   │           ├── edit/page.tsx            farm name/boundary editing
│   │           ├── twin/page.tsx            Digital Twin
│   │           ├── crops/page.tsx           Crop Simulator
│   │           ├── annual-plan/page.tsx     annual planner
│   │           └── risks/page.tsx           Disaster/Risk Center
│   ├── components/app-shell.tsx             navigation and workspace shell
│   ├── features/farm/MapEditor.tsx           drawing/import editor
│   ├── features/crops/                       crop cards and detail panel
│   ├── features/decision/                    shared scenario controls
│   ├── features/twin/ClimateOverview.tsx     existing disconnected climate UI
│   └── lib/
│       ├── map-style.ts                      basemap configuration
│       └── api/                              typed HTTP clients and contracts
├── backend/
│   └── app/
│       ├── api/v1/                           FastAPI routes and schemas
│       ├── core/                             configuration, database, security
│       ├── data/providers/                   weather/climate/soil/terrain/satellite
│       ├── db/                               migrations and demo setup
│       ├── domain/                           geometry, crop and risk engines
│       ├── models/                           persisted entities
│       ├── repositories/                     ownership-scoped persistence
│       └── services/                         farm, snapshot, crop, planner, risk,
│                                             scenario and legacy demo services
└── backend/tests/                            contract, integration and property tests
```

Keep route handlers thin. Put acquisition/orchestration in services, deterministic calculations in domain modules, storage access in repositories, and response validation in schemas. Keep frontend server/page components small enough to understand; extract map state, farm selection, evidence cards, and charts into focused features where appropriate.

## Confirmed defects that must be fixed

### 1. Demo farms are leaking into the normal application

`backend/app/db/demo_setup.py` explicitly seeds `[DEMO] Green Valley Farm` and `[DEMO] Sunrise Acres` using California rectangles. The overview correctly calls the real farms API, so these database rows appear as if they were the user's real farms. Switching `DATA_MODE` does not remove already-persisted records.

Implement all of the following:

- Stop demo farm seeding from every normal live startup path.
- Add an explicit, idempotent management command or migration-safe cleanup for only the known seeded fixture rows. Do not delete arbitrary user farms or use a broad name pattern that could remove user data.
- Run the cleanup in the authorized local development database after reviewing which exact fixture IDs/attributes will be removed.
- Keep test fixtures inside tests. If an optional demonstration journey is retained, isolate it behind an explicit action and separate data identity; it must never enter the live overview automatically.
- Remove `[DEMO]` names and all hard-coded demo locations from normal runtime output.

### 2. Seeded hectares contradict polygon area

The fixture code stores `567.8` and `1234.5` hectares while the polygons cover approximately 9,000+ hectares. The editor calculates a different number from the same geometry.

- All create and update paths must call the same backend geometry validator and geodesic area calculator in `backend/app/domain/geometry.py`.
- Never accept a client-supplied area as authoritative.
- Return the persisted authoritative hectares, centroid, label point, and revision.
- Add a regression test proving the list, detail, editor, and Digital Twin show the same area for the same boundary.

### 3. The Digital Twin map occupies only part of its panel

The Twin layout uses a growing CSS grid row, a sticky element with `min-height`, and no reliable map resize when the evidence panel changes height. The MapLibre canvas keeps its earlier dimensions, leaving a large blank area.

- Make the desktop Twin workspace use the available viewport height.
- Keep the map column fixed to that height and make the evidence panel independently scrollable.
- Add a `ResizeObserver` that calls `map.resize()` when its container changes.
- Keep a single MapLibre instance. Do not destroy and recreate it when an insight tab changes.
- Update sources, paint properties, and basemap style through controlled map operations.
- Ensure correct behavior at approximately 360, 768, 1024, 1440, and 1920 pixel widths.
- Remove the duplicate location-search `flyTo` call.

### 4. The edit map does not load or actually edit the saved polygon

`frontend/features/farm/MapEditor.tsx` hardcodes the OSM street source, does not fit the initial polygon bounds, and treats the existing polygon as a closed non-editable shape. The current Undo action only removes the closing coordinate; Draw Boundary clears the shape. The iframe fallback can fail and uses approximate fixed SVG coordinates.

Implement a real boundary editor:

- Load a reliable configured basemap with correct attribution. Centralize tile URL/key configuration; do not scatter provider URLs through components.
- Fit the map to the complete existing boundary after map load.
- Display draggable vertex handles for the current polygon.
- Allow adding, moving and deleting vertices, undo/redo, cancel, reset to saved boundary, and redraw.
- Keep saved and unsaved states visually distinct.
- Preserve the saved boundary until the user explicitly saves a valid replacement.
- Recalculate a local preview area while drawing, but treat the backend result as authoritative after save.
- Call `map.resize()` on layout changes.
- Make the fallback operational. If it cannot support accurate drawing, present a clear retry/error state instead of pretending an iframe overlay is equivalent.
- Search should support a place name and `latitude, longitude`, then place/fly to the result without modifying the farm until the user draws.
- Prefer a backend geocoding proxy with caching, request identification, throttling and error mapping over unmanaged browser calls to Nominatim.
- On create, require the confirmation: “I confirm this boundary represents land I own or manage.”
- On edit, save a new geometry revision with optimistic concurrency and trigger a new analysis for that revision.

### 5. Selected farm state disappears on Overview

`frontend/components/app-shell.tsx` derives `farmId` only from the current pathname. Returning to `/app` locks every farm module even after a farm has been selected.

- Introduce one selected-farm state shared across the workspace.
- Initialize it from the route, otherwise from the user's default farm or last valid selection.
- Validate that the selected farm still exists and belongs to the current user.
- Persist the preference through the settings/default-farm API when available; local storage may be used only as a UI cache.
- Every module link must use the selected farm.
- After deleting the selected farm, select another valid farm or return to the empty onboarding state.

### 6. Digital Twin insight tabs are cosmetic

Satellite, Vegetation, Soil, Water, Flood Risk and Elevation currently change only the polygon fill color. They are not spatial data layers.

- Keep Satellite as a real basemap plus farm boundary.
- Render a vegetation layer only when the backend supplies a real spatial NDVI/NDMI asset or tile source for the farm and acquisition date.
- Render elevation, soil, water or hazard surfaces only if real spatial outputs exist.
- If only a farm-wide statistic is available, show it in the evidence panel and do not label a recolored polygon as a map layer.
- Disable unavailable tabs with a reason and acquisition status.
- Every active layer must show source, valid/acquisition time, resolution, quality, data mode and attribution.
- Never manufacture colored gradients, field subdivisions, water stress, vegetation health or flood zones to imitate the reference design.

### 7. Live provider evidence is incomplete and poorly gated

Current weather can be present while climate, satellite or soil are unavailable. The UI still looks generally ready, and downstream modules fail later.

Audit and repair:

- Open-Meteo current weather: current conditions, daily forecast, units, UTC timestamps and farm timezone conversion.
- Historical climate baseline: 30-year monthly temperature means and precipitation totals, complete-month validation, correctly matched periods and explicit baseline years.
- SoilGrids: expected depth keys, units/scaling, modelled-data label, resolution and no-data behavior.
- Copernicus DEM: polygon sampling, elevation units, slope conversion and water/no-data handling.
- Sentinel-2: search window, cloud/valid-pixel rules, acquisition time, NDVI/NDMI calculation, geometry size limits and spatial output if exposed on the map.
- Conduit: real current station ingestion and usable station metadata if a live source is configured. Historical fixtures must not be presented as current. If no eligible live station exists, return unavailable with the reason.

Define readiness per capability. A completed snapshot may contain partial evidence, but Crop Simulator must clearly report that its required climate fields are unavailable. A failed provider must not silently fall back to demonstration values. Expose retryable/non-retryable status and let the user rerun analysis.

### 8. Crop Simulator is visually incomplete and has unsafe contracts

The crop page and `features/crops` components use many CSS class names with no corresponding styles. The frontend types require numeric values although backend schemas correctly permit null scores/components.

- Add a coherent responsive style system for all crop controls, filter chips, result cards, scores, detail panels, requirement tabs, warnings and scenario comparison tables.
- Change frontend contracts so unsupported suitability/component values are nullable.
- Make every component handle `null` without numeric comparisons, progress-bar math or misleading badges.
- Display top farm inputs: growing-period temperature, rainfall/irrigation, soil and vegetation evidence with source/status.
- Rank all crops only when the required growing-period temperature and rainfall evidence exists.
- Preserve “Insufficient evidence” instead of generating a fallback number.
- Make planting date affect the complete crop duration, including year boundaries and leap days.
- Make rain-fed/irrigated mode and irrigation millimetres affect the calculation once, with documented units.
- Filters, search, sorting and crop selection must work through keyboard and pointer input.
- “Add to Crop Plan” must create a real plan entry with planting/harvest dates and show validation conflicts.
- Do not show expected yield, market demand or soil moisture unless backed by an implemented and identified source/model.

### 9. Annual Crop Plan still uses the legacy demonstration engine

The visible page calls `calculateDecisionSupport`, whose backend endpoint always invokes `backend/app/services/decision_support.py` and always returns `data_mode: demonstration`. The repository also has a newer snapshot-backed planner service, producing two competing implementations. The supposed real scenario branch is unreachable from the primary demo response, and scenario errors can silently fall through.

- Make `backend/app/services/planner_service.py` and its versioned API the single source of annual recommendations.
- Remove the normal frontend dependency on `/decision-support`.
- Remove or quarantine the legacy demonstration engine after moving any generally useful pure functions into correctly named domain modules.
- Remove runtime imports from live snapshot code into `decision_support.py`.
- Never catch a live scenario error and silently show demonstration output.
- Generate each month's recommendations from the farm's real monthly climate baseline, crop requirements and optional user irrigation settings.
- If a month lacks essential evidence, show an unavailable month with an explanation.
- Implement the reference layout: twelve month cards, selected-month details, suitability, planting window, expected environmental inputs, main risk, and practical tip.
- Persist plan entries and enforce overlap rules.
- Support field/area allocation only after defining a real persisted model and validating allocated area against farm area.
- Generate change proposals only from newly acquired evidence with old value, proposed value, reason, evidence snapshot, issue time, accept and dismiss states.
- Implement an export that contains the user's saved plan and provenance. CSV is acceptable for the first complete implementation; do not label an illustrative recommendation grid as a saved plan export.

### 10. Disaster Center is only a partial threshold screen

The current five-hazard engine is useful but has incomplete inputs. Drought becomes unknown without matched rainfall baseline; flood is a basic slope/rainfall exposure index; the target map, timeline and action presentation are incomplete.

- Keep terms scientifically honest: use “index” or “exposure” unless a calibrated probability model exists.
- Compute current and seven-day hazard inputs from matching forecast periods.
- Match drought rainfall with an equivalent climate-normal period.
- Version and test every threshold.
- Do not classify missing input as Low.
- Build the reference summary cards with level, index, direction, evidence timestamp and driver.
- Build a daily risk timeline from real daily weather values.
- Show a risk map only when real spatial hazard inputs exist. Otherwise show the farm boundary and clearly state that risk is farm-wide.
- Show recommended actions from versioned rules, priority, affected crops, rationale and completion state.
- Preserve completed actions across reloads.
- Detect contradictory actions and show the selected rule/priority resolution.

### 11. Climate navigation is broken

The sidebar points to `/twin#climate`, but the current Twin page has no climate section. `frontend/features/twin/ClimateOverview.tsx` exists but is disconnected.

- Create a real farm climate route, preferably `/app/farms/[farmId]/climate`, and update navigation/active states.
- Reuse or refactor the existing ClimateOverview component rather than leaving parallel dead UI.
- Implement Today, Next 7 Days, Monthly and Annual views from real weather and climate payloads.
- Show units, source, issue/valid time, timezone and unavailable states.
- Use accessible charts with textual equivalents.
- Compute best growing periods only from crop requirements plus real climate normals; label them as screening guidance rather than a guarantee.

### 12. Authentication is not production-complete

The browser API client does not obtain or send an OIDC bearer token. Local development may continue using the isolated local user, but this must not be confused with demonstration environmental data.

- Keep `AUTH__MODE=local_demo` available only for isolated local single-user development.
- Keep `DATA_MODE=live` independent so local development can use live providers without demo farms or synthetic decisions.
- When OIDC is configured, implement browser sign-in/session integration and attach access tokens to API requests.
- Continue enforcing ownership in backend repositories for every farm, snapshot, plan, scenario and action endpoint.
- Handle expired/invalid sessions and 401/403 responses visibly.
- Do not embed credentials, provider tokens or private configuration into frontend bundles.

## Target UX and visual behavior

Use the supplied screens as the visual direction. Match their hierarchy and behavior without copying unsupported information.

### Public landing page

- Clean FarmTwin header and navigation.
- Clear explanation of the workflow: select land, build Twin, simulate, plan and act.
- Start Farm Analysis opens authentication/onboarding.
- Provider badges describe actual integrations and their status; do not imply every provider is currently connected.
- Responsive, accessible sections and working anchors.

### Empty Overview

- When the user owns no farms, display the welcome card and Create My Farm Digital Twin action.
- Farm-specific modules are disabled until a farm is created or selected.
- No Sunrise Acres, Green Valley, California coordinate, fixed area or demo label may appear.

### Farm Digital Twin

- Large full-height satellite map.
- Clear farm boundary and editable vertices in edit mode.
- Search, draw/edit, measure area, save, zoom and basemap controls.
- Right evidence panel with farm identity, location, authoritative area, soil, vegetation, water-related evidence, terrain and climate risk.
- Statuses must represent real evidence: Good/Moderate/High only when a documented calculation supports them; otherwise Unavailable.

### Crop Simulator, Annual Plan, Risk Center and Climate

- Recreate the information hierarchy, cards, filters, selected detail panel, charts and action areas in the references.
- Use the existing FarmTwin green/neutral visual language consistently.
- Do not use raw unstyled form controls or concatenated text.
- Maintain readable layouts on mobile and desktop.
- Do not use crop photography or decorative icons as evidence. Images are presentation assets only.

## API and data-contract requirements

- Use explicit Pydantic request/response models; remove normal-route `dict[str, Any]` responses where a stable schema is known.
- Frontend types must mirror backend nullability and enums.
- Every evidence value must carry or be traceable to source, acquisition/valid time, unit, quality, resolution where relevant, data mode and snapshot/model version.
- Use UTC in storage and APIs; format in the selected farm/user timezone in the UI.
- Add request IDs and structured error envelopes consistently.
- Do not return HTTP success with a fabricated result after a provider or engine error.
- Preserve optimistic concurrency for boundary revisions.
- Analysis results must be tied to a farm geometry revision. Never display an old snapshot as current after the boundary changes.
- A rerun must either produce a new immutable snapshot or clearly return the already-running job.

## Code cleanup rules

- Remove code only after proving it is unused or replacing every caller.
- Remove the legacy decision-support runtime path from live pages.
- Remove duplicate API types and duplicated calculation logic.
- Keep deterministic fixture generation only under explicit demo/test modules.
- Delete obsolete components/styles/routes after references and tests have moved.
- Do not perform a broad rewrite of the design system.
- Do not replace working backend domain tests with snapshot tests that merely accept new output.
- Do not weaken missing-evidence rules to make the UI look complete.

## Required implementation order

Work in dependency order and keep the application runnable after each stage:

1. Establish a clean baseline and run tests/build.
2. Isolate/remove normal runtime demo data and clean known demo rows.
3. Fix farm creation, map rendering, area consistency and saved-boundary editing.
4. Add selected-farm state and complete navigation.
5. Repair analysis jobs, live provider payloads and per-capability readiness.
6. Repair the full-height Digital Twin and truthful map/evidence layers.
7. Fix Crop Simulator contracts, styling and live scoring.
8. Replace annual demo calculations with the real planner flow.
9. Complete the risk experience using real temporal/spatial evidence.
10. Connect the Climate route and views.
11. Finish settings, data-source status, authentication boundaries and accessibility.
12. Run full validation and update project documentation with verified status.

Do not begin later modules while farm creation/editing or analysis of a newly created farm is still broken.

## Tests and verification

Add meaningful coverage for the failures found here.

### Backend

- Geometry validation, self-intersection, coordinate order, area and revision conflict tests.
- Known demo-fixture cleanup test that proves user farms remain untouched.
- Provider payload parsing, unit conversion, unavailable state and timestamps.
- Growing-period climate integration across months, years and leap days.
- Crop nullability, hard exclusions, irrigation and no-demo-fallback tests.
- Annual planner live-snapshot tests for all twelve months.
- Risk matched-period, missing-input, threshold boundary and action persistence tests.
- Ownership tests for every farm-scoped resource.

### Frontend

- API contract tests for nullable environmental and crop values.
- MapEditor tests for initial fit, redraw, vertex editing, undo/redo, cancel and save.
- Selected-farm navigation and deletion behavior.
- Crop filtering, sorting, unavailable evidence and add-to-plan flow.
- Annual-plan live response, proposal acceptance/dismissal and export.
- Climate route/tab rendering and unavailable states.
- Risk detail/action completion.

### Browser workflow

Add a real browser test for this journey:

1. Start with a user who has no farms.
2. Open Overview and confirm no demo farms appear.
3. Create a farm by searching or centering on Kenya and drawing a valid polygon.
4. Confirm ownership/management, save, and verify authoritative area.
5. Wait for or poll analysis and inspect provider statuses.
6. Reload and verify farm selection and boundary persistence.
7. Edit one vertex, save revision 2, and confirm old analysis is not shown as current.
8. Open Crop Simulator and verify either evidence-backed rankings or an honest unavailable state.
9. Add a supported crop to the annual plan and verify persistence.
10. Open Risk Center and Climate and verify real timestamps/data or clear unavailable reasons.
11. Delete the test farm and return to the empty onboarding state.

External providers can be replaced with contract-faithful test servers in automated tests. Include at least one separately documented live smoke test that is not required for deterministic CI.

Run and report:

```text
frontend: build, lint and complete test suite
backend: complete pytest suite and migration checks
browser: end-to-end farm journey
```

Fix the current Base UI accessibility warnings. Do not finish with console errors, unhandled promise rejections, TypeScript errors, missing CSS classes, broken links, or silently swallowed live-data failures.

## Completion acceptance criteria

The task is complete only when all of these statements are true:

- A clean user sees no seeded farms and can create their real farm.
- Both new and edit maps load reliably and fill their intended panels.
- A saved polygon is fitted, editable and persisted as a new revision.
- Area and centroid are consistent across API, Overview, editor and Twin.
- Returning to Overview does not lose the selected farm.
- The Twin map fills the viewport without a blank lower half.
- Insight tabs never pretend a color fill is a real environmental layer.
- Live analysis never silently uses demonstration values.
- Crop scores appear only with the required real evidence.
- The Crop Simulator matches the supplied layout quality and handles unavailable values safely.
- The Annual Plan no longer calls or displays the legacy demonstration index.
- Plan entries and proposals persist and operate correctly.
- Risk levels use matching real inputs; missing inputs show Unknown.
- Climate navigation opens a working farm climate page.
- Data-source statuses reflect actual provider results and timestamps.
- Normal routes contain no hard-coded demo farms, scores, locations, forecasts, market claims or risk probabilities.
- The frontend build, backend suite and browser journey pass.
- Documentation states exactly which providers/features are operational and which remain unavailable or require credentials.

## Required final report

When implementation is complete, provide:

1. Files changed, grouped by Farm, Twin, Crop, Planner, Risk, Climate and shared infrastructure.
2. Demo paths and hard-coded values removed or isolated.
3. Live provider behavior and required environment variables.
4. Database migration/cleanup actions performed.
5. Test commands and exact outcomes.
6. Browser journey results at desktop and mobile widths.
7. Remaining externally blocked capabilities, such as unavailable credentials or unvalidated scientific models.

Do not describe an implemented adapter as a working feature unless its result reaches the browser through the full farm workflow. Do not mark a module complete because its unit tests pass while its actual page is broken.
