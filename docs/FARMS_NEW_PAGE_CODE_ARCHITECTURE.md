# /app/farms/new Page - Code Architecture

## File Structure

```
farmtwin/frontend/
├── app/app/farms/new/
│   └── page.tsx                           # Main page component
├── features/farm/
│   ├── FarmNameInput.tsx                  # Farm name input with save button
│   └── MapEditor.tsx                      # Map and boundary drawing component
├── components/ui/
│   ├── button.tsx                         # Reusable button component
│   ├── input.tsx                          # Reusable input component
│   └── textarea.tsx                       # Reusable textarea component
└── lib/api/
    └── farms.ts                           # Farm API functions
```

## 1. Main Page Component: `page.tsx`

**File**: `farmtwin/frontend/app/app/farms/new/page.tsx`

### Component Structure
```typescript
'use client';

export default function NewFarmPage() {
  // Imports needed:
  // - ArrowLeft from 'lucide-react'
  // - Link from 'next/link'
  // - useRouter from 'next/navigation'
  // - useRef, useState from 'react'
  // - FarmNameInput from '@/features/farm/FarmNameInput'
  // - MapEditor from '@/features/farm/MapEditor'
  // - createFarm, ValidationError, GeoJSONPolygon from '@/lib/api/farms'
  
  // State
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [currentGeometry, setCurrentGeometry] = useState<GeoJSONPolygon | null>(null);
  const [isGeometryValid, setIsGeometryValid] = useState(false);

  // Functions
  const save = async (geometry: GeoJSONPolygon) => {
    // Validate name
    // Set saving state
    // Call createFarm API
    // On success: navigate to /app/farms/{farmId}/twin
    // On error: set error messages
  };

  const handleSaveClick = () => {
    // Validate geometry exists and is valid
    // Call save() with currentGeometry
  };

  const canSave = Boolean(name.trim()) && isGeometryValid && currentGeometry !== null;

  // Render
  return (
    <div className="farm-editor-page">
      {/* Back Link */}
      <Link href="/app">Back to overview</Link>
      
      {/* Header */}
      <header className="editor-page-heading">
        <div>
          <p className="section-kicker">Create farm</p>
          <h1>Create your farm</h1>
          <p>Instructions text</p>
        </div>
        
        {/* Farm Name Input with inline Save button */}
        <FarmNameInput 
          value={name}
          onChange={(value) => { setName(value); setNameError(null); }}
          error={nameError}
          onSave={handleSaveClick}
          canSave={canSave}
          isSaving={saving}
        />
      </header>

      {/* Progress Steps */}
      <ol className="farm-create-steps">
        <li data-current><span>1</span> Locate your land</li>
        <li><span>2</span> Draw the boundary</li>
        <li><span>3</span> Confirm and analyse</li>
      </ol>

      {/* Map Editor */}
      <MapEditor
        farmName={name}
        onNameChange={(value) => { setName(value); setNameError(null); }}
        apiError={geometryError}
        requireBoundaryConfirmation
        onGeometryChange={(geometry, isValid) => {
          setCurrentGeometry(geometry);
          setIsGeometryValid(isValid);
        }}
        hideSaveButton
      />
    </div>
  );
}
```

### Key Props & State:

**State Variables:**
- `name`: Current farm name (string)
- `saving`: Loading state during API call (boolean)
- `nameError`: Validation error for name field (string | null)
- `geometryError`: Validation error for boundary (string | null)
- `currentGeometry`: Current drawn geometry (GeoJSONPolygon | null)
- `isGeometryValid`: Whether geometry passes validation (boolean)
- `idempotencyKey`: UUID for preventing duplicate farm creation (ref)

**Computed Values:**
- `canSave`: Enabled when name exists AND geometry is valid

**Functions:**
- `save(geometry)`: Async function that calls API
- `handleSaveClick()`: Triggered by Save button, validates and calls save()

---

## 2. Farm Name Input Component: `FarmNameInput.tsx`

**File**: `farmtwin/frontend/features/farm/FarmNameInput.tsx`

### Component Structure
```typescript
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export function FarmNameInput({
  value,
  onChange,
  error,
  onSave,
  canSave = false,
  isSaving = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  onSave?: () => void;
  canSave?: boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="farm-name-field">
      <label htmlFor="farm-name">Farm name</label>
      
      {/* Flex container for input and button */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        
        {/* Input section */}
        <div style={{ flex: 1 }}>
          <Input
            id="farm-name"
            maxLength={255}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'farm-name-error' : 'farm-name-help'}
            placeholder="Enter a name for this farm"
          />
          {error ? (
            <p id="farm-name-error" className="field-error" role="alert">
              {error}
            </p>
          ) : (
            <p id="farm-name-help" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Use a memorable name for this farm.
            </p>
          )}
        </div>

        {/* Save button (inline) */}
        {onSave && (
          <Button
            type="button"
            onClick={onSave}
            disabled={!canSave || isSaving}
            style={{ 
              backgroundColor: canSave && !isSaving ? '#10b981' : undefined,
              minWidth: '120px',
              whiteSpace: 'nowrap'
            }}
          >
            <Save /> {isSaving ? 'Saving...' : 'Save farm'}
          </Button>
        )}
      </div>
    </div>
  );
}
```

### Props Interface:
```typescript
{
  value: string;              // Current farm name value
  onChange: (value: string) => void;  // Called when user types
  error?: string | null;      // Error message to display
  onSave?: () => void;        // Called when Save button clicked
  canSave?: boolean;          // Enable/disable save button
  isSaving?: boolean;         // Show loading state
}
```

### Key Features:
- **Layout**: Flexbox with input taking flex: 1 and button at fixed width
- **Input**: Standard text input with 255 char limit
- **Validation Display**: Shows error below input OR helper text
- **Save Button**: 
  - Green (#10b981) when enabled
  - Shows "Saving..." during API call
  - Disabled when canSave=false or isSaving=true
  - Has Save icon from lucide-react

---

## 3. Map Editor Component: `MapEditor.tsx`

**File**: `farmtwin/frontend/features/farm/MapEditor.tsx`

### Component Structure (Simplified)

```typescript
'use client';

import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import area from '@turf/area';

// Import UI components and utilities
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GeoJSONPolygon } from '@/lib/api/farms';
import { createFarmMapStyle } from '@/lib/map-style';

// Icons from lucide-react
import { Check, FileUp, LocateFixed, MapPin, Redo2, RotateCcw, Undo2 } from 'lucide-react';

type Position = [number, number];  // [longitude, latitude]
type MapMode = 'loading' | 'interactive' | 'fallback';

export type ValidationState =
  | { valid: true; areaHa: number; message: string; warning?: string }
  | { valid: false; areaHa: number | null; message: string; warning?: string };

interface MapEditorProps {
  initialGeometry?: GeoJSONPolygon;
  isSaving?: boolean;
  canSave?: boolean;
  hasExternalChanges?: boolean;
  apiError?: string | null;
  requireBoundaryConfirmation?: boolean;
  farmName?: string;
  onNameChange?: (name: string) => void;
  onGeometryChange?: (geometry: GeoJSONPolygon | null, isValid: boolean) => void;
  hideSaveButton?: boolean;
  onSave?: (geometry: GeoJSONPolygon) => Promise<void> | void;
}

export function MapEditor({
  initialGeometry,
  isSaving = false,
  canSave = true,
  hasExternalChanges = false,
  apiError,
  requireBoundaryConfirmation = false,
  farmName,
  onNameChange,
  onGeometryChange,
  hideSaveButton = false,
  onSave,
}: MapEditorProps) {
  
  // === STATE ===
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [coordinates, setCoordinates] = useState<Position[]>([]);
  const [closed, setClosed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('loading');
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const history = useRef<Array<{ coordinates: Position[]; closed: boolean }>>([]);
  const [historyLength, setHistoryLength] = useState(0);

  // === COMPUTED VALUES ===
  const draftGeometry = useMemo<GeoJSONPolygon | null>(
    () => (closed && coordinates.length >= 4 
      ? { type: 'Polygon', coordinates: [coordinates] } 
      : null),
    [closed, coordinates],
  );

  const validationState = useMemo(
    () => validateDraft(coordinates, closed),
    [coordinates, closed],
  );

  // === EFFECTS ===
  
  // Notify parent of geometry changes
  useEffect(() => {
    if (onGeometryChange) {
      onGeometryChange(draftGeometry, validationState.valid);
    }
  }, [draftGeometry, validationState.valid, onGeometryChange]);

  // Map initialization
  useEffect(() => {
    // Initialize MapLibre GL map
    // Add layers for boundary, vertices
    // Set up event handlers for drawing
    // Return cleanup function
  }, []);

  // === FUNCTIONS ===
  
  const remember = useCallback(() => {
    // Save current state to history for undo
  }, []);

  const change = useCallback((points: Position[], isClosed: boolean) => {
    // Update coordinates and closed state
    // Mark as dirty
    // Clear boundary confirmation
  }, []);

  const finishDrawing = useCallback(() => {
    // Close the polygon ring
  }, [change, remember]);

  const searchLocation = async () => {
    // Call Nominatim API
    // Fly map to location
  };

  const applyImport = (value: string) => {
    // Parse GeoJSON from text
    // Validate format
    // Apply to map
  };

  const startDrawing = () => { /* Clear and start fresh */ };
  const undo = () => { /* Restore from history */ };
  const reset = () => { /* Reset to initial */ };
  const deleteVertex = () => { /* Remove selected vertex */ };

  // === RENDER ===
  return (
    <section className="map-editor">
      {/* Location Search Toolbar */}
      <div className="map-editor-toolbar">
        <div className="location-search">
          <MapPin />
          <Input
            placeholder="Search place or enter latitude, longitude"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void searchLocation(); }}
          />
          <Button type="button" onClick={searchLocation}>
            <LocateFixed /> Find
          </Button>
        </div>
        <output>{locationStatus ?? 'Search for a place...'}</output>
      </div>

      {/* Map Canvas */}
      <div className="map-workspace">
        <div className="map-canvas" ref={mapContainerRef} />
        
        {/* Map Loading State */}
        {mapMode === 'loading' && <output>Loading map…</output>}
        
        {/* Fallback Map (iframe) */}
        {mapMode === 'fallback' && (
          <div className="fallback-map">
            <iframe src={fallbackMapUrl} title="OpenStreetMap" />
            {/* SVG overlay for vertices */}
          </div>
        )}

        {/* Drawing Hint */}
        <output className="map-drawing-hint">
          {/* Context-specific hint text */}
        </output>

        {/* Close Ring CTA */}
        {!closed && coordinates.length >= 3 && (
          <Button onClick={finishDrawing}>
            <Redo2 /> Close ring to finish boundary
          </Button>
        )}

        {/* Drawing Controls */}
        <div className="drawing-controls">
          <Button onClick={startDrawing}>
            <RotateCcw /> Draw boundary
          </Button>
          <Button onClick={undo} disabled={historyLength === 0}>
            <Undo2 /> Undo vertex
          </Button>
          <Button onClick={finishDrawing} disabled={closed || coordinates.length < 3}>
            <Redo2 /> Close ring
          </Button>
          <Button onClick={deleteVertex} disabled={selectedVertex === null}>
            Delete selected corner
          </Button>
          <Button onClick={startDrawing} disabled={coordinates.length === 0}>
            Erase boundary
          </Button>
          <Button onClick={reset} disabled={!dirty}>
            Reset / cancel edits
          </Button>
        </div>

        {/* Map Legend */}
        <div className="map-legend">
          {initialGeometry && <span><i data-kind="saved" /> Saved boundary</span>}
          <span><i data-kind="draft" /> Draft boundary</span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="editor-details-grid">
        {/* Area Status Card */}
        <div className="boundary-status" data-valid={validationState.valid}>
          <span>{validationState.valid ? <Check /> : <MapPin />}</span>
          <div>
            <strong>
              {validationState.areaHa === null 
                ? 'Area pending' 
                : `${validationState.areaHa.toFixed(2)} estimated hectares`}
            </strong>
            <output>{validationState.message}</output>
            <small>Server validation remains authoritative.</small>
          </div>
        </div>

        {/* Import GeoJSON Panel */}
        <details className="import-panel">
          <summary><FileUp /> Import GeoJSON</summary>
          <p>Paste a Polygon or choose a GeoJSON file.</p>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"type":"Polygon","coordinates":[[[36.8,-1.3],...]]}'
          />
          <div className="import-actions">
            <Input
              type="file"
              accept=".geojson,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void file.text().then((text) => {
                  setImportText(text);
                  applyImport(text);
                });
              }}
            />
            <Button onClick={() => applyImport(importText)}>
              Use pasted boundary
            </Button>
          </div>
          {importError && <p className="field-error">{importError}</p>}
        </details>
      </div>

      {/* API Error Display */}
      {apiError && <p className="form-error">{apiError}</p>}

      {/* Save Row (conditionally hidden) */}
      {!hideSaveButton && (
        <div className="editor-save-row">
          <div>
            {/* Boundary Confirmation Checkbox */}
            {requireBoundaryConfirmation && closed && coordinates.length >= 3 && (
              <label className="boundary-confirmation">
                <input
                  type="checkbox"
                  checked={boundaryConfirmed}
                  onChange={(e) => setBoundaryConfirmed(e.target.checked)}
                />
                <span>I confirm this boundary represents land I own or manage.</span>
              </label>
            )}
            <p>
              {hasUnsavedChanges 
                ? 'You have unsaved changes.' 
                : initialGeometry 
                  ? 'The saved boundary is unchanged.' 
                  : 'Draw your land boundary to get started.'}
            </p>
          </div>

          {/* Save Button */}
          {onSave && (
            <Button
              type="button"
              disabled={
                !validationState.valid || 
                !draftGeometry || 
                !canSave || 
                isSaving ||
                (requireBoundaryConfirmation && !boundaryConfirmed)
              }
              onClick={() => draftGeometry && void onSave(draftGeometry)}
            >
              <Save /> {isSaving ? 'Saving farm…' : 'Save farm'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

// === UTILITY FUNCTIONS ===

export function validateDraft(
  coordinates: Position[],
  closed: boolean,
): ValidationState {
  // Check minimum vertices
  // Check if closed
  // Calculate area with @turf/area
  // Check for self-intersections
  // Validate area range (0.01 to 50,000 ha)
  // Return validation state
}

function parseImportedGeometry(value: string): GeoJSONPolygon {
  // Parse JSON
  // Validate Polygon format
  // Extract coordinates
  // Close ring if needed
  // Return GeoJSONPolygon
}
```

### Key Props:
```typescript
{
  // Optional initial geometry (for editing existing farm)
  initialGeometry?: GeoJSONPolygon;
  
  // Save button state
  isSaving?: boolean;
  canSave?: boolean;
  
  // External state
  hasExternalChanges?: boolean;
  apiError?: string | null;
  
  // Feature flags
  requireBoundaryConfirmation?: boolean;
  hideSaveButton?: boolean;
  
  // Callbacks
  onGeometryChange?: (geometry: GeoJSONPolygon | null, isValid: boolean) => void;
  onSave?: (geometry: GeoJSONPolygon) => Promise<void> | void;
  onNameChange?: (name: string) => void;
  
  // Pass-through from parent
  farmName?: string;
}
```

### State Variables:
- `coordinates`: Array of [lng, lat] positions
- `closed`: Whether polygon ring is closed
- `dirty`: Whether user has made changes
- `locationQuery`: Location search input value
- `locationStatus`: Search result message
- `boundaryConfirmed`: Confirmation checkbox state
- `mapMode`: 'loading' | 'interactive' | 'fallback'
- `selectedVertex`: Index of selected vertex (for deletion)
- `importText`: GeoJSON import textarea value
- `importError`: Import validation error
- `history`: Undo/redo history stack

### Key Functions:
- `remember()`: Save state to history
- `change()`: Update coordinates
- `finishDrawing()`: Close the polygon
- `searchLocation()`: Geocode and fly to location
- `applyImport()`: Parse and apply GeoJSON
- `validateDraft()`: Run validation rules

---

## 4. API Functions: `farms.ts`

**File**: `farmtwin/frontend/lib/api/farms.ts`

### Key Function:
```typescript
export async function createFarm(data: FarmCreate): Promise<FarmResponse> {
  const { idempotency_key, ...body } = data;
  
  try {
    return (
      await requestApi<FarmResponse>('/api/v1/farms', {
        method: 'POST',
        headers: idempotency_key ? { 'Idempotency-Key': idempotency_key } : {},
        body: JSON.stringify(body),
      })
    ).data;
  } catch (error) {
    return mapFarmError(error);
  }
}
```

### Types:
```typescript
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface FarmCreate {
  name: string;
  geometry: GeoJSONPolygon;
  idempotency_key?: string;
}

export type FarmResponse = {
  id: string;
  name: string;
  current_geometry_revision: number;
  current_geometry: {
    id: string;
    revision: number;
    geometry: GeoJSONPolygon;
    centroid: { type: 'Point'; coordinates: number[] };
    hectares: number;
  };
  analysis_job_id: string | null;
  created_at: string;
  updated_at: string;
};

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: Array<{ field: string; message: string; code: string }>,
    public readonly requestId?: string,
  ) {
    super(message);
  }
  
  fieldMessage(field: string): string | undefined {
    return this.details.find(d => d.field.endsWith(field))?.message;
  }
}
```

---

## Component Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ NewFarmPage                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ State:                                                  │ │
│ │ - name, nameError                                       │ │
│ │ - currentGeometry, isGeometryValid                      │ │
│ │ - saving, geometryError                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌───────────────────────────────┐                          │
│ │ FarmNameInput                 │                          │
│ │ ┌───────────────────────────┐ │                          │
│ │ │ Props:                    │ │                          │
│ │ │ - value={name}            │ │                          │
│ │ │ - onChange={setName}      │ │                          │
│ │ │ - error={nameError}       │ │                          │
│ │ │ - onSave={handleSaveClick}│ │                          │
│ │ │ - canSave                 │ │                          │
│ │ │ - isSaving                │ │                          │
│ │ └───────────────────────────┘ │                          │
│ │                               │                          │
│ │ Renders:                      │                          │
│ │ ┌─────────────────┬─────────┐ │                          │
│ │ │ Input           │ Button  │ │                          │
│ │ │ [Farm name]     │ [Save]  │ │                          │
│ │ └─────────────────┴─────────┘ │                          │
│ └───────────────────────────────┘                          │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ MapEditor                                             │  │
│ │ ┌───────────────────────────────────────────────────┐ │  │
│ │ │ Props:                                            │ │  │
│ │ │ - onGeometryChange={(geo, valid) => {             │ │  │
│ │ │     setCurrentGeometry(geo);                      │ │  │
│ │ │     setIsGeometryValid(valid);                    │ │  │
│ │ │   }}                                              │ │  │
│ │ │ - apiError={geometryError}                        │ │  │
│ │ │ - hideSaveButton={true}                           │ │  │
│ │ │ - requireBoundaryConfirmation={true}              │ │  │
│ │ └───────────────────────────────────────────────────┘ │  │
│ │                                                       │  │
│ │ Internal State:                                       │  │
│ │ - coordinates, closed                                 │  │
│ │ - draftGeometry, validationState                      │  │
│ │                                                       │  │
│ │ Effect: When geometry changes                         │  │
│ │   → calls onGeometryChange()                          │  │
│ │   → NewFarmPage receives geometry + validity          │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ When Save Clicked:                                          │
│   1. FarmNameInput button → onSave()                        │
│   2. NewFarmPage handleSaveClick()                          │
│   3. Validates name + geometry                              │
│   4. Calls save(currentGeometry)                            │
│   5. createFarm API → POST /api/v1/farms                    │
│   6. On success → router.push('/app/farms/{id}/twin')       │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Implementation Rules

### 1. Save Button Behavior
```typescript
// Save button is ONLY enabled when ALL conditions true:
const canSave = Boolean(name.trim()) && isGeometryValid && currentGeometry !== null;

// The button MUST NOT trigger save on:
// - Name input change
// - Geometry change
// - Enter key press (unless explicitly handled)
// - Tab key press
// - Focus/blur events

// ONLY trigger save when:
// - User explicitly clicks "Save farm" button
```

### 2. Geometry Validation
```typescript
// Validation must check:
// 1. Minimum 3 distinct vertices
// 2. Ring is closed
// 3. No self-intersections
// 4. Area >= 0.01 hectares
// 5. Area <= 50,000 hectares

// Use @turf/area library for calculation
// Return ValidationState with clear message
```

### 3. State Updates
```typescript
// When name changes:
setName(value);
setNameError(null);  // Clear error

// When geometry changes:
onGeometryChange(geometry, isValid);
// Parent receives and stores in state

// Errors are cleared when user makes corrections
```

### 4. API Call
```typescript
// Must include:
// - name (trimmed, validated)
// - geometry (valid GeoJSON Polygon)
// - idempotency_key (UUID, prevents duplicates)

// Error handling:
// - ValidationError: Extract field-specific messages
// - Network errors: Generic message
// - All errors: Keep user on page with error displayed
```

### 5. Navigation
```typescript
// Success:
router.push(`/app/farms/${farm.id}/twin`);

// Cancel:
<Link href="/app">Back to overview</Link>

// Unsaved changes warning:
// MapEditor handles beforeunload event
```

---

## Styling Classes Reference

```css
/* Page wrapper */
.farm-editor-page { }

/* Back link */
.back-link { }

/* Header section */
.editor-page-heading { }
.section-kicker { }

/* Farm name field */
.farm-name-field { }
.field-error { }

/* Progress steps */
.farm-create-steps { }

/* Map editor */
.map-editor { }
.map-editor-toolbar { }
.location-search { }
.map-workspace { }
.map-canvas { }
.map-loading { }
.fallback-map { }
.map-drawing-hint { }
.map-close-ring-cta { }

/* Controls */
.drawing-controls { }
.map-legend { }

/* Status cards */
.editor-details-grid { }
.boundary-status { }
.import-panel { }

/* Save row */
.editor-save-row { }
.boundary-confirmation { }
.form-error { }
.map-save-blocker { }
```

---

## Dependencies Required

```json
{
  "dependencies": {
    "maplibre-gl": "^4.x",
    "@turf/area": "^7.x",
    "lucide-react": "^0.x",
    "next": "^14.x",
    "react": "^18.x"
  }
}
```

---

## Environment & Configuration

```typescript
// Map defaults
const DEFAULT_CENTER: Position = [36.8219, -1.2921];  // Nairobi, Kenya
const DEFAULT_ZOOM = 10;

// Validation constants
const MIN_AREA_HA = 0.01;
const MAX_AREA_HA = 50_000;

// API endpoint
const API_BASE_URL = '/api/v1';

// Location search
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
```

---

## Testing Checklist

```
□ Type farm name → state updates
□ Draw 3 vertices → validation shows "ready to close"
□ Close ring → validation shows "ready to save"
□ Save button enabled only when name + valid geometry
□ Click Save → API called with correct data
□ Success → navigates to /app/farms/{id}/twin
□ Error → displays error message
□ Location search → map flies to location
□ Import GeoJSON → geometry loaded
□ Undo → reverts last vertex
□ Reset → clears boundary
□ Typing name does NOT trigger save
□ Enter key in name does NOT trigger save
□ Tab key does NOT trigger save
□ Click away does NOT trigger save
```

This is the complete code architecture your AI needs to rebuild the `/app/farms/new` page.
