'use client';

import area from '@turf/area';
import {
  Check,
  FileUp,
  LocateFixed,
  MapPin,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GeoJSONPolygon } from '@/lib/api/farms';

type Position = [number, number];
type MapMode = 'loading' | 'interactive' | 'fallback';
export type ValidationState =
  | { valid: true; areaHa: number; message: string; warning?: string }
  | { valid: false; areaHa: number | null; message: string; warning?: string };

const MIN_AREA_HA = 0.01;
const MAX_AREA_HA = 50_000;

function mercatorPoint([longitude, latitude]: Position, zoom: number): Position {
  const worldSize = 256 * 2 ** zoom;
  const safeLatitude = Math.max(-85.051129, Math.min(85.051129, latitude));
  const sinLatitude = Math.sin((safeLatitude * Math.PI) / 180);
  return [
    ((longitude + 180) / 360) * worldSize,
    (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize,
  ];
}

function unprojectMercator([x, y]: Position, zoom: number): Position {
  const worldSize = 256 * 2 ** zoom;
  const longitude = (x / worldSize) * 360 - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldSize))) * 180) / Math.PI;
  return [longitude, latitude];
}

function fallbackMapUrl([longitude, latitude]: Position, zoom: number): string {
  const longitudeSpan = Math.min(340, (360 / 2 ** zoom) * 5.5);
  const latitudeSpan = Math.min(
    160,
    longitudeSpan * Math.max(0.18, Math.cos((latitude * Math.PI) / 180)) * 0.58,
  );
  const bbox = [
    longitude - longitudeSpan / 2,
    Math.max(-85, latitude - latitudeSpan / 2),
    longitude + longitudeSpan / 2,
    Math.min(85, latitude + latitudeSpan / 2),
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
}

function orientation(a: Position, b: Position, c: Position): number {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function linesCross(a: Position, b: Position, c: Position, d: Position): boolean {
  return orientation(a, b, c) * orientation(a, b, d) < 0
    && orientation(c, d, a) * orientation(c, d, b) < 0;
}

function hasSelfIntersection(ring: Position[]): boolean {
  const edgeCount = ring.length - 1;
  for (let first = 0; first < edgeCount; first += 1) {
    for (let second = first + 1; second < edgeCount; second += 1) {
      if (Math.abs(first - second) <= 1 || (first === 0 && second === edgeCount - 1)) continue;
      if (linesCross(ring[first], ring[first + 1], ring[second], ring[second + 1])) return true;
    }
  }
  return false;
}

export function validateDraft(
  coordinates: Position[],
  closed: boolean,
): ValidationState {
  const openRing = closed ? coordinates.slice(0, -1) : coordinates;
  const distinct = new Set(openRing.map(([longitude, latitude]) => `${longitude},${latitude}`));
  if (distinct.size < 3) {
    return {
      valid: false,
      areaHa: null,
      message: `Add ${3 - distinct.size} more distinct ${distinct.size === 2 ? 'vertex' : 'vertices'} to form a boundary.`,
    };
  }
  if (!closed) {
    return { valid: false, areaHa: null, message: 'Close the ring to validate this boundary.' };
  }

  const geometry: GeoJSONPolygon = { type: 'Polygon', coordinates: [coordinates] };
  const areaHa = area({ type: 'Feature', properties: {}, geometry }) / 10_000;
  const warning = hasSelfIntersection(coordinates)
    ? 'The boundary appears to cross itself. Redraw it before saving.'
    : undefined;
  if (warning) return { valid: false, areaHa, message: warning, warning };
  if (areaHa < MIN_AREA_HA) {
    return { valid: false, areaHa, message: 'The boundary must cover at least 0.01 hectares.' };
  }
  if (areaHa > MAX_AREA_HA) {
    return { valid: false, areaHa, message: 'The boundary cannot exceed 50,000 hectares.' };
  }
  return { valid: true, areaHa, message: 'Boundary is ready to save.' };
}

function asFeature(geometry: GeoJSONPolygon | null) {
  return geometry
    ? { type: 'Feature' as const, properties: {}, geometry }
    : { type: 'FeatureCollection' as const, features: [] };
}

function lineFeature(coordinates: Position[]) {
  return coordinates.length > 1
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates },
      }
    : { type: 'FeatureCollection' as const, features: [] };
}

function parseImportedGeometry(value: string): GeoJSONPolygon {
  const parsed: unknown = JSON.parse(value);
  const candidate = Array.isArray(parsed)
    ? { type: 'Polygon', coordinates: parsed }
    : (parsed as { type?: string; geometry?: unknown; coordinates?: unknown });
  const geometry = candidate && candidate.type === 'Feature'
    ? (candidate.geometry as { type?: string; coordinates?: unknown })
    : candidate;
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) {
    throw new Error('Import must be a GeoJSON Polygon. Other geometry types are not supported.');
  }
  const ring = geometry.coordinates[0];
  if (!Array.isArray(ring)) throw new Error('The Polygon exterior ring is missing.');
  const positions = ring.map((point) => {
    if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite)) {
      throw new Error('Every coordinate must be a finite [longitude, latitude] pair.');
    }
    return [Number(point[0]), Number(point[1])] as Position;
  });
  if (positions.length > 0) {
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) positions.push([...first]);
  }
  return { type: 'Polygon', coordinates: [positions] };
}

interface MapEditorProps {
  initialGeometry?: GeoJSONPolygon;
  isSaving?: boolean;
  canSave?: boolean;
  hasExternalChanges?: boolean;
  apiError?: string | null;
  onSave: (geometry: GeoJSONPolygon) => Promise<void> | void;
}

export function MapEditor({
  initialGeometry,
  isSaving = false,
  canSave = true,
  hasExternalChanges = false,
  apiError,
  onSave,
}: MapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [coordinates, setCoordinates] = useState<Position[]>(
    () => (initialGeometry?.coordinates[0] as Position[] | undefined) ?? [],
  );
  const [closed, setClosed] = useState(Boolean(initialGeometry));
  const [dirty, setDirty] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const initialCenter = (initialGeometry?.coordinates[0]?.[0] ?? [36.8219, -1.2921]) as Position;
  const [mapMode, setMapMode] = useState<MapMode>('loading');
  const [fallbackCenter, setFallbackCenter] = useState<Position>(initialCenter);
  const [fallbackZoom, setFallbackZoom] = useState(initialGeometry ? 14 : 10);
  const coordinatesRef = useRef(coordinates);
  const closedRef = useRef(closed);

  useEffect(() => { coordinatesRef.current = coordinates; }, [coordinates]);
  useEffect(() => { closedRef.current = closed; }, [closed]);

  const draftGeometry = useMemo<GeoJSONPolygon | null>(
    () => (closed && coordinates.length >= 4 ? { type: 'Polygon', coordinates: [coordinates] } : null),
    [closed, coordinates],
  );
  const validationState = useMemo(
    () => validateDraft(coordinates, closed),
    [coordinates, closed],
  );
  const hasUnsavedChanges = dirty || hasExternalChanges;

  const finishDrawing = useCallback(() => {
    const points = coordinatesRef.current;
    if (closedRef.current || points.length < 3) return;
    const first = points[0];
    setCoordinates([...points, [...first]]);
    setClosed(true);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let map: MapLibreMap | null = null;
    let loadTimer: number | undefined;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: initialCenter,
        zoom: initialGeometry ? 14 : 10,
        attributionControl: false,
      });
    } catch {
      setMapMode('fallback');
      return;
    }
    loadTimer = window.setTimeout(() => setMapMode('fallback'), 5000);
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Map © OpenStreetMap contributors · OpenFreeMap',
      }),
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.doubleClickZoom.disable();
    map.on('load', () => {
      if (loadTimer) window.clearTimeout(loadTimer);
      setMapMode('interactive');
      map.addSource('saved-boundary', { type: 'geojson', data: asFeature(initialGeometry ?? null) });
      map.addLayer({
        id: 'saved-fill', type: 'fill', source: 'saved-boundary',
        paint: { 'fill-color': '#08783b', 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'saved-line', type: 'line', source: 'saved-boundary',
        paint: { 'line-color': '#08783b', 'line-width': 3 },
      });
      map.addSource('draft-boundary', { type: 'geojson', data: asFeature(null) });
      map.addLayer({
        id: 'draft-fill', type: 'fill', source: 'draft-boundary',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.22 },
      });
      map.addLayer({
        id: 'draft-line', type: 'line', source: 'draft-boundary',
        paint: { 'line-color': '#d97706', 'line-width': 3, 'line-dasharray': [2, 1.3] },
      });
      map.addSource('draft-preview', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'draft-preview-line', type: 'line', source: 'draft-preview',
        paint: { 'line-color': '#d97706', 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
      });
    });
    map.on('click', (event) => {
      if (closedRef.current) return;
      setCoordinates((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
      setDirty(true);
    });
    map.on('dblclick', finishDrawing);
    mapRef.current = map;
    return () => {
      if (loadTimer) window.clearTimeout(loadTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [finishDrawing, initialGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource('draft-boundary') as GeoJSONSource | undefined)?.setData(asFeature(draftGeometry));
    (map.getSource('draft-preview') as GeoJSONSource | undefined)?.setData(
      closed ? lineFeature([]) : lineFeature(coordinates),
    );
  }, [closed, coordinates, draftGeometry]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLink = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && anchor.href !== window.location.href
        && !window.confirm('Discard your unsaved boundary changes?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardLink, true);
    };
  }, [hasUnsavedChanges]);

  const startDrawing = () => {
    setCoordinates([]);
    setClosed(false);
    setDirty(true);
    setImportError(null);
  };

  const undo = () => {
    if (closed) {
      setCoordinates((current) => current.slice(0, -1));
      setClosed(false);
    } else {
      setCoordinates((current) => current.slice(0, -1));
    }
    setDirty(true);
  };

  const applyImport = (value: string) => {
    try {
      const geometry = parseImportedGeometry(value);
      setCoordinates(geometry.coordinates[0] as Position[]);
      setClosed(true);
      setDirty(true);
      setImportError(null);
      const first = geometry.coordinates[0][0];
      setFallbackCenter(first as Position);
      setFallbackZoom(14);
      mapRef.current?.flyTo({ center: first as Position, zoom: 14 });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Boundary import failed.');
    }
  };

  const searchLocation = async () => {
    const query = locationQuery.trim();
    if (!query) return;
    setLocationStatus('Searching…');
    const direct = query.split(',').map(Number);
    if (direct.length === 2 && direct.every(Number.isFinite)) {
      const center: Position = [direct[1], direct[0]];
      setFallbackCenter(center);
      setFallbackZoom(14);
      mapRef.current?.flyTo({ center, zoom: 14 });
      setLocationStatus('Map moved to the supplied coordinates.');
      return;
    }
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const matches = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (!matches[0]) throw new Error('No matching place was found.');
      const center: Position = [Number(matches[0].lon), Number(matches[0].lat)];
      setFallbackCenter(center);
      setFallbackZoom(14);
      mapRef.current?.flyTo({ center, zoom: 14 });
      setLocationStatus(matches[0].display_name);
    } catch (error) {
      setLocationStatus(error instanceof Error ? error.message : 'Location search failed.');
    }
  };

  const addFallbackVertex = (event: React.MouseEvent<SVGSVGElement>) => {
    if (closedRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerPoint = mercatorPoint(fallbackCenter, fallbackZoom);
    const clickedPoint: Position = [
      centerPoint[0] + event.clientX - rect.left - rect.width / 2,
      centerPoint[1] + event.clientY - rect.top - rect.height / 2,
    ];
    setCoordinates((current) => [...current, unprojectMercator(clickedPoint, fallbackZoom)]);
    setDirty(true);
  };

  const fallbackPoints = coordinates.map((coordinate) => {
    const centerPoint = mercatorPoint(fallbackCenter, fallbackZoom);
    const point = mercatorPoint(coordinate, fallbackZoom);
    return `${point[0] - centerPoint[0] + 600},${point[1] - centerPoint[1] + 280}`;
  }).join(' ');

  return (
    <section className="map-editor" aria-label="Farm boundary editor">
      <div className="map-editor-toolbar">
        <div className="location-search">
          <MapPin aria-hidden="true" />
          <Input
            aria-label="Search location or enter latitude, longitude"
            placeholder="Search place or enter latitude, longitude"
            value={locationQuery}
            onChange={(event) => setLocationQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void searchLocation(); }}
          />
          <Button type="button" variant="outline" onClick={() => void searchLocation()}>
            <LocateFixed /> Find
          </Button>
        </div>
        {locationStatus && <p className="map-helper-text" role="status">{locationStatus}</p>}
      </div>

      <div className="map-workspace">
        <div className="map-canvas" ref={mapContainerRef} aria-label="Interactive farm boundary map" />
        {mapMode === 'loading' && (
          <div className="map-loading" role="status">Loading map…</div>
        )}
        {mapMode === 'fallback' && (
          <div className="fallback-map" data-testid="fallback-map">
            <iframe
              src={fallbackMapUrl(fallbackCenter, fallbackZoom)}
              title="OpenStreetMap farm boundary map"
              loading="eager"
            />
            <svg
              viewBox="0 0 1200 560"
              preserveAspectRatio="none"
              aria-label="Farm boundary drawing surface"
              onClick={addFallbackVertex}
            >
              {closed && fallbackPoints && <polygon points={fallbackPoints} />}
              {!closed && fallbackPoints && <polyline points={fallbackPoints} />}
              {coordinates.map((coordinate, index) => {
                const centerPoint = mercatorPoint(fallbackCenter, fallbackZoom);
                const point = mercatorPoint(coordinate, fallbackZoom);
                return (
                  <circle
                    key={`${coordinate[0]}-${coordinate[1]}-${index}`}
                    cx={point[0] - centerPoint[0] + 600}
                    cy={point[1] - centerPoint[1] + 280}
                    r="6"
                  />
                );
              })}
            </svg>
            <span className="fallback-map-note">Compatibility map · click to add boundary points</span>
          </div>
        )}
        <div className="drawing-controls" aria-label="Drawing controls">
          <Button type="button" onClick={startDrawing}><RotateCcw /> Draw boundary</Button>
          <Button type="button" variant="outline" onClick={undo} disabled={coordinates.length === 0}>
            <Undo2 /> Undo vertex
          </Button>
          <Button type="button" variant="outline" onClick={finishDrawing} disabled={closed || coordinates.length < 3}>
            <Redo2 /> Close ring
          </Button>
        </div>
        <div className="map-legend" aria-label="Boundary legend">
          {initialGeometry && <span><i data-kind="saved" /> Saved boundary</span>}
          <span><i data-kind="draft" /> Draft boundary</span>
        </div>
      </div>

      <div className="editor-details-grid">
        <div className="boundary-status" data-valid={validationState.valid}>
          <span>{validationState.valid ? <Check /> : <MapPin />}</span>
          <div>
            <strong>{validationState.areaHa === null ? 'Area pending' : `${validationState.areaHa.toFixed(2)} estimated hectares`}</strong>
            <p role="status">{validationState.message}</p>
            <small>Server validation and geodesic area remain authoritative.</small>
          </div>
        </div>

        <details className="import-panel">
          <summary><FileUp /> Import GeoJSON</summary>
          <p>Paste a Polygon, its coordinates array, or choose a GeoJSON file.</p>
          <Textarea
            aria-label="GeoJSON Polygon"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={'{"type":"Polygon","coordinates":[[[36.8,-1.3],...]]}' }
          />
          <div className="import-actions">
            <Input
              aria-label="Choose GeoJSON file"
              type="file"
              accept="application/geo+json,application/json,.geojson,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void file.text().then((value) => { setImportText(value); applyImport(value); });
              }}
            />
            <Button type="button" variant="outline" onClick={() => applyImport(importText)}>Use pasted boundary</Button>
          </div>
          {importError && <p className="field-error" role="alert">{importError}</p>}
        </details>
      </div>

      {apiError && <p className="form-error" role="alert">{apiError}</p>}
      <div className="editor-save-row">
        <p>{hasUnsavedChanges ? 'You have unsaved changes.' : 'The saved boundary is unchanged.'}</p>
        <Button
          className="primary-button"
          type="button"
          disabled={!validationState.valid || !draftGeometry || !hasUnsavedChanges || !canSave || isSaving}
          onClick={() => draftGeometry && void onSave(draftGeometry)}
        >
          <Save /> {isSaving ? 'Saving farm…' : 'Save farm'}
        </Button>
      </div>
    </section>
  );
}
