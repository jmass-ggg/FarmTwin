# Farm Creation Page - Architecture Documentation

## Overview

The farm creation page allows users to create a new farm by:
1. Naming the farm
2. Finding and navigating to the farm location
3. Drawing the farm boundary on a map
4. Saving the farm with validation

## Page Structure

```
/app/farms/new
├── Header Section
│   ├── Back Navigation Link
│   ├── Page Title & Description
│   └── Farm Name Input + Save Button (inline)
├── Progress Steps Indicator
├── Map Toolbar
│   ├── Location Search Input
│   └── Find Button
└── Map Editor Section
    ├── Interactive Map Canvas
    ├── Drawing Controls Panel
    │   ├── Draw boundary
    │   ├── Undo vertex
    │   ├── Close ring
    │   ├── Delete selected corner
    │   ├── Erase boundary
    │   └── Reset / cancel edits
    ├── Map Legend
    ├── Area Status Card
    │   ├── Calculated Area (hectares)
    │   └── Validation Status Message
    ├── Import GeoJSON Panel (collapsible)
    │   ├── Textarea for JSON input
    │   ├── File upload
    │   └── Apply button
    └── Boundary Confirmation Checkbox (when complete)
```

## Component Hierarchy

```
NewFarmPage (page.tsx)
│
├── AppShell (layout wrapper)
│   ├── Navigation Sidebar
│   └── Header
│
├── FarmNameInput
│   ├── Label
│   ├── Input Field
│   ├── Save Farm Button
│   └── Helper Text / Error Message
│
└── MapEditor
    ├── Map Toolbar
    │   ├── Location Search Input
    │   └── Find Button
    │
    ├── Map Workspace
    │   ├── MapLibre GL Map (interactive)
    │   │   ├── Base map layers (street/satellite)
    │   │   ├── Draft boundary layer (orange)
    │   │   ├── Draft vertices layer (circles)
    │   │   └── Navigation controls
    │   │
    │   └── Fallback Map (iframe - for compatibility)
    │       └── Static OpenStreetMap embed
    │
    ├── Drawing Controls
    │   └── Action Buttons Panel
    │
    ├── Status Section
    │   ├── Area Status Card
    │   └── Import GeoJSON Panel
    │
    └── Save Section (conditionally hidden)
        ├── Boundary Confirmation Checkbox
        └── Status Messages
```

## Data Flow

### State Management

```
NewFarmPage State:
├── name: string
├── saving: boolean
├── nameError: string | null
├── geometryError: string | null
├── currentGeometry: GeoJSONPolygon | null
└── isGeometryValid: boolean

MapEditor State:
├── coordinates: Position[]
├── closed: boolean
├── dirty: boolean
├── importText: string
├── importError: string | null
├── locationQuery: string
├── locationStatus: string | null
├── boundaryConfirmed: boolean
├── mapMode: 'loading' | 'interactive' | 'fallback'
├── fallbackCenter: Position
├── fallbackZoom: number
├── selectedVertex: number | null
├── history: Array<{coordinates, closed}>
└── historyLength: number
```

### Event Flow

```
User Action Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. User types farm name                                     │
│    ├─> FarmNameInput onChange                               │
│    ├─> NewFarmPage setName()                                │
│    └─> nameError cleared                                    │
├─────────────────────────────────────────────────────────────┤
│ 2. User searches location                                   │
│    ├─> MapEditor location search input                      │
│    ├─> onKeyDown (Enter) triggers searchLocation()          │
│    ├─> Fetch Nominatim API                                  │
│    └─> Map flies to location                                │
├─────────────────────────────────────────────────────────────┤
│ 3. User draws boundary                                      │
│    ├─> Click map → add vertex                               │
│    ├─> Drag vertex → update coordinates                     │
│    ├─> Double-click / Close ring → close polygon           │
│    ├─> History tracking (undo support)                      │
│    └─> Validation runs automatically                        │
├─────────────────────────────────────────────────────────────┤
│ 4. Geometry updates                                         │
│    ├─> coordinates/closed state changes                     │
│    ├─> draftGeometry computed (useMemo)                     │
│    ├─> validationState computed (useMemo)                   │
│    ├─> onGeometryChange callback fired                      │
│    └─> NewFarmPage receives geometry + validity             │
├─────────────────────────────────────────────────────────────┤
│ 5. User clicks Save Farm                                    │
│    ├─> FarmNameInput onSave() triggered                     │
│    ├─> NewFarmPage handleSaveClick()                        │
│    ├─> Validation checks (name + geometry)                  │
│    ├─> createFarm API call                                  │
│    │   ├─> POST /api/v1/farms                               │
│    │   └─> Include idempotency key                          │
│    ├─> On success: router.push to farm twin page           │
│    └─> On error: display error messages                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Location Search
- **Input**: Text field accepting place names or lat/long coordinates
- **API**: OpenStreetMap Nominatim (public geocoding service)
- **Behavior**: 
  - Direct coordinates: "lat, long" format
  - Place search: Returns best match
  - Map flies to result location
  - Status message shows found location name

### 2. Boundary Drawing
- **Interactive Mode**: MapLibre GL JS
  - Click to add vertices
  - Drag vertices to move
  - Click edge to insert vertex
  - Double-click to close ring
  - Visual feedback (cursor changes, hover effects)
  
- **Fallback Mode**: Static OpenStreetMap iframe
  - Loads if MapLibre fails
  - Click to add vertices
  - Double-click to close
  - SVG overlay for vertices

### 3. Drawing Controls
- **Draw boundary**: Start new polygon (clears existing)
- **Undo vertex**: Step back through history
- **Close ring**: Manually close the polygon
- **Delete selected corner**: Remove selected vertex
- **Erase boundary**: Clear all vertices
- **Reset / cancel edits**: Revert to initial geometry

### 4. Validation System

```typescript
Validation Rules:
├── Minimum 3 distinct vertices
├── Ring must be closed
├── No self-intersections
├── Area >= 0.01 hectares
├── Area <= 50,000 hectares
└── Valid GeoJSON Polygon structure

Validation States:
├── "Area pending" - Not enough vertices
├── "Close the ring..." - Need to close
├── "Boundary ready to save" - ✓ Valid
└── Error messages for violations
```

### 5. GeoJSON Import
- **Formats Supported**:
  - Full GeoJSON Feature
  - GeoJSON Polygon geometry
  - Coordinates array only
  
- **Validation**:
  - Must be Polygon type
  - Must have valid coordinate array
  - Automatically closes ring if needed
  
- **Input Methods**:
  - Paste JSON into textarea
  - Upload .geojson or .json file

### 6. Save Flow

```
Save Button State:
├── Enabled when:
│   ├── Farm name is non-empty
│   ├── Geometry is valid
│   └── Boundary confirmation checked (if required)
│
└── Disabled when:
    ├── No farm name
    ├── Invalid/incomplete geometry
    ├── Already saving (prevents duplicates)
    └── Confirmation not checked
```

## API Integration

### Endpoint: POST /api/v1/farms

**Request:**
```typescript
{
  name: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  idempotency_key?: string; // UUID for safe retries
}
```

**Response (Success):**
```typescript
{
  id: UUID;
  name: string;
  current_geometry_revision: number;
  current_geometry: {
    id: UUID;
    revision: number;
    geometry: GeoJSON;
    centroid: GeoJSON Point;
    hectares: number;
  };
  analysis_job_id: UUID | null;
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

**Error Handling:**
- **422 Validation Error**: Field-specific messages
- **409 Conflict**: Duplicate idempotency key
- **Network Errors**: Generic error message

## Map Rendering

### MapLibre GL JS (Primary)
```typescript
Map Configuration:
├── Style: Custom vector tiles (street/satellite)
├── Center: Kenya default [36.8219, -1.2921]
├── Initial Zoom: 10 (new) / 14 (existing)
├── Attribution: OpenStreetMap contributors
└── Controls: Navigation (zoom, rotate)

Map Layers:
├── Base Map Layer (street or satellite)
├── Saved Boundary (green) - if editing existing
├── Draft Boundary (orange, dashed)
├── Draft Preview Line (orange, while drawing)
└── Draft Vertices (circles, selectable)

Interactions:
├── Click: Add vertex or select vertex
├── Double-click: Close ring
├── Drag: Move vertex
├── Pan: Default map panning
└── Zoom: Scroll or controls
```

### Fallback Map (Compatibility)
- **Used when**: MapLibre fails to load
- **Source**: OpenStreetMap iframe embed
- **Interactions**: Basic click/double-click
- **SVG Overlay**: Shows vertices and polygon

## Coordinate System

- **Input/Output**: WGS84 (EPSG:4326) - latitude/longitude
- **Format**: [longitude, latitude] (GeoJSON standard)
- **Backend Storage**: PostGIS with SRID 4326
- **Validation**: Longitude [-180, 180], Latitude [-90, 90]

## Area Calculation

```typescript
Library: @turf/area
Input: GeoJSON Feature with Polygon geometry
Output: Square meters
Conversion: square meters / 10,000 = hectares
Display: Fixed to 2 decimal places
Note: Server performs authoritative geodesic calculation
```

## State Persistence

### Browser State:
- **Unsaved Changes Warning**: beforeunload event
- **Link Click Guard**: Confirms before navigation
- **No localStorage**: Draft not persisted locally

### Server State:
- **Idempotency**: UUID prevents duplicate creation
- **Single Source of Truth**: Database is authoritative
- **Immediate Persistence**: No draft mode

## Navigation Flow

```
Entry Points:
├── /app → "Create Farm" button
├── /app/farms (empty list) → "Create Farm" CTA
└── Direct URL: /app/farms/new

Exit Points:
├── Success → /app/farms/{farmId}/twin
├── Cancel → /app (back link)
└── Browser back → with confirmation if dirty
```

## Responsive Behavior

### Desktop (>768px):
- Full sidebar visible
- Map takes majority of width
- Controls in horizontal toolbar
- Farm name + Save button inline

### Mobile (<768px):
- Collapsed sidebar (hamburger menu)
- Map full width
- Controls stacked vertically
- Farm name + Save button may stack

## Error Handling Strategy

```typescript
Error Types:
├── Name Validation Error
│   └── Display under name input
├── Geometry Validation Error
│   └── Display under map/controls
├── API Error
│   ├── Validation (422): Field-specific
│   ├── Conflict (409): Generic message
│   └── Network: Generic failure message
└── Import Error
    └── Display in import panel
```

## Performance Considerations

### Map Loading:
- 8-second timeout before fallback
- Lazy load map libraries
- Minimal initial center (Kenya)

### Geometry Validation:
- Runs on every coordinate change
- Memoized with useMemo
- O(n²) self-intersection check (acceptable for farm boundaries)

### API Calls:
- Single POST on save (no auto-save)
- Idempotency key prevents duplicates
- Location search: debounced by user action (Enter key)

## Accessibility

### Keyboard Navigation:
- Tab through all interactive elements
- Enter in location search triggers find
- Form controls fully keyboard accessible

### ARIA Labels:
- Map canvas: `aria-label="Interactive farm boundary map"`
- Status messages: `role="alert"` for errors
- Progress indicators: `role="status"`
- Drawing controls: `aria-label` descriptive names

### Screen Reader Support:
- Boundary status announced
- Error messages announced
- Progress updates announced
- Drawing hints provided

## Security Considerations

### Input Validation:
- Farm name: Max 255 characters
- Coordinates: Finite numbers only
- Geometry: Valid GeoJSON structure
- SQL injection: Prevented by parameterized queries (backend)

### API Security:
- Authentication: Required (via session)
- Authorization: User-scoped farms
- Rate limiting: Backend enforced
- CORS: Restricted origins

### XSS Prevention:
- All user input escaped by React
- No dangerouslySetInnerHTML used
- CSP headers recommended

## Testing Strategy

### Unit Tests:
- Validation functions (validateDraft)
- Coordinate transformations
- GeoJSON parsing
- Area calculations

### Integration Tests:
- Farm creation flow
- Geometry drawing
- Location search
- Import GeoJSON

### E2E Tests:
- Full farm creation workflow
- Error handling paths
- Browser compatibility
- Responsive layouts

## Future Enhancements

### Potential Improvements:
1. **Drawing Tools**:
   - Rectangle tool
   - Circle tool (converted to polygon)
   - Snap to existing boundaries

2. **Layer Options**:
   - Satellite imagery toggle
   - Parcel boundaries overlay
   - Topographic layer

3. **Advanced Features**:
   - Multi-polygon support (multiple fields)
   - Buffer tool (expand/contract boundary)
   - Area measurement tool
   - Distance measurement

4. **Import Sources**:
   - KML file support
   - Shapefile upload
   - GPS track import

5. **Collaboration**:
   - Share draft link
   - Copy boundary to new farm
   - Import from existing farm

## Dependencies

### Frontend:
- `maplibre-gl`: ^4.x - Map rendering
- `@turf/area`: ^7.x - Area calculation
- `lucide-react`: ^0.x - Icons
- `next`: ^14.x - Framework
- `react`: ^18.x - UI library

### Backend:
- PostGIS: Spatial database
- FastAPI: REST API
- SQLAlchemy: ORM
- GeoAlchemy2: Spatial ORM extension

### External Services:
- OpenStreetMap Nominatim: Geocoding (public API)
- OpenStreetMap Tiles: Base map imagery

## File Structure

```
farmtwin/frontend/
├── app/app/farms/new/
│   └── page.tsx                    # Main page component
├── features/farm/
│   ├── FarmNameInput.tsx           # Name input + save button
│   └── MapEditor.tsx               # Map + drawing interface
├── lib/api/
│   └── farms.ts                    # API client functions
├── lib/
│   └── map-style.ts                # MapLibre style configuration
└── components/ui/
    ├── button.tsx                  # Button component
    ├── input.tsx                   # Input component
    └── textarea.tsx                # Textarea component
```

## Configuration

### Environment Variables:
```bash
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_MAPBOX_TOKEN=<not required, using OSM>

# Backend
DATABASE_URL=postgresql://...
API_HOST=0.0.0.0
API_PORT=8000
```

### Map Style:
- Configured in `lib/map-style.ts`
- Uses OpenStreetMap standard tiles
- Satellite option uses ArcGIS World Imagery

## Troubleshooting

### Common Issues:

**Map Not Loading:**
- Check console for errors
- Verify network connectivity
- Fallback should activate after 8 seconds
- Check browser WebGL support

**Save Button Disabled:**
- Verify farm name entered
- Ensure boundary closed (3+ points)
- Check validation messages
- Confirm boundary confirmation checkbox

**Location Search Not Working:**
- Check Nominatim API availability
- Verify query format (place or lat,long)
- Check network requests in DevTools
- API may rate-limit frequent requests

**Geometry Validation Failing:**
- Check for self-intersecting boundaries
- Verify minimum area (0.01 ha)
- Verify maximum area (50,000 ha)
- Ensure ring is properly closed
