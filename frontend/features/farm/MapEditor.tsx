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
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GeoJSONPolygon } from '@/lib/api/farms';
import { createFarmMapStyle } from '@/lib/map-style';

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

function pointFeatures(coordinates: Position[], closed: boolean) {
  const visible = closed ? coordinates.slice(0, -1) : coordinates;
  return {
    type: 'FeatureCollection' as const,
    features: visible.map((coordinate, index) => ({
      type: 'Feature' as const,
      properties: { index },
      geometry: { type: 'Point' as const, coordinates: coordinate },
    })),
  };
}

function setMapCursor(map: MapLibreMap, cursor: string) {
  map.getCanvas?.().style.setProperty('cursor', cursor);
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
  requireBoundaryConfirmation?: boolean;
  /** Optional: current farm name value — shown inline in save row when name is missing */
  farmName?: string;
  /** Optional: callback when user types a name inline in the save row */
  onNameChange?: (name: string) => void;
  onSave: (geometry: GeoJSONPolygon) => Promise<void> | void;
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
  onSave,
}: MapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReady = useRef(false);
  const pendingCenter = useRef<Position | null>(null);
  const [coordinates, setCoordinates] = useState<Position[]>(
    () => (initialGeometry?.coordinates[0] as Position[] | undefined) ?? [],
  );
  const [closed, setClosed] = useState(Boolean(initialGeometry));
  const [dirty, setDirty] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);
  const initialCenter = useMemo(
    () => (initialGeometry?.coordinates[0]?.[0] ?? [36.8219, -1.2921]) as Position,
    [initialGeometry],
  );
  const [mapMode, setMapMode] = useState<MapMode>('loading');
  const [fallbackCenter, setFallbackCenter] = useState<Position>(initialCenter);
  const [fallbackZoom, setFallbackZoom] = useState(initialGeometry ? 14 : 10);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const history = useRef<Array<{ coordinates: Position[]; closed: boolean }>>([]);
  const [historyLength, setHistoryLength] = useState(0);
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
  const distinctPointCount = useMemo(() => {
    const open = closed ? coordinates.slice(0, -1) : coordinates;
    return new Set(open.map(([lng, lat]) => `${lng},${lat}`)).size;
  }, [coordinates, closed]);

  const saveBlockingReason = !canSave ? 'Enter a farm name at the top of the page.'
    : distinctPointCount < 3 ? `Add at least ${3 - distinctPointCount} more boundary ${3 - distinctPointCount === 1 ? 'point' : 'points'}.`
    : !closed ? 'Double-click the map or click "Close ring" to finish the boundary.'
    : !validationState.valid ? validationState.message
    : requireBoundaryConfirmation && !boundaryConfirmed ? 'Tick the confirmation checkbox above.'
    : !hasUnsavedChanges ? 'The saved boundary is unchanged.'
    : isSaving ? 'Saving farm…' : null;


  const remember = useCallback(() => {
    history.current.push({ coordinates: structuredClone(coordinatesRef.current), closed: closedRef.current });
    setHistoryLength(history.current.length);
  }, []);

  const change = useCallback((points: Position[], isClosed: boolean) => {
    coordinatesRef.current = points;
    closedRef.current = isClosed;
    setCoordinates(points);
    setClosed(isClosed);
    setDirty(true);
    setBoundaryConfirmed(false);
  }, []);

  const finishDrawing = useCallback(() => {
    const points = coordinatesRef.current;
    if (closedRef.current || points.length < 3) return;
    remember();
    change([...points, [...points[0]]], true);
  }, [change, remember]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let map: MapLibreMap | null = null;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: createFarmMapStyle('street'),
        center: initialCenter,
        zoom: initialGeometry ? 14 : 10,
        attributionControl: false,
      });
    } catch {
      queueMicrotask(() => setMapMode('fallback'));
      return;
    }
    const loadTimer = window.setTimeout(() => setMapMode('fallback'), 8000);
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Map © OpenStreetMap contributors',
      }),
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.doubleClickZoom.disable();
    map.on('load', () => {
      window.clearTimeout(loadTimer);
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
      map.addSource('draft-boundary', { type: 'geojson', data: asFeature(initialGeometry ?? null) });
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
      map.addSource('draft-vertices', {
        type: 'geojson',
        data: pointFeatures(coordinatesRef.current, closedRef.current),
      });
      map.addLayer({
        id: 'draft-vertices',
        type: 'circle',
        source: 'draft-vertices',
        paint: {
          'circle-radius': 6,
          'circle-color': '#fff7e6',
          'circle-stroke-color': '#b85f00',
          'circle-stroke-width': 3,
        },
      });
      if (initialGeometry) {
        const ring = initialGeometry.coordinates[0] as Position[];
        const bounds = ring.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(ring[0], ring[0]));
        map.fitBounds(bounds, { padding: 90, maxZoom: 17, duration: 0 });
      }
      mapReady.current = true;
      if (pendingCenter.current) {
        map.flyTo({ center: pendingCenter.current, zoom: 14 });
        pendingCenter.current = null;
      }
      setMapCursor(map, closedRef.current ? 'grab' : 'crosshair');
    });
    map.on('error', (event) => {
      // A style can report loaded even when its raster source is blocked. Move
      // to the compatibility map instead of leaving a featureless green box.
      if (event.error) setMapMode('fallback');
    });
    let dragging: number | null = null;
    let dragged = false;
    const vertexAt = (point: { x: number; y: number }) => {
      if (!map.isStyleLoaded()) return null;
      const feature = map.queryRenderedFeatures?.(point as maplibregl.PointLike, { layers: ['draft-vertices'] })[0];
      return feature ? Number(feature.properties.index) : null;
    };
    map.on('mousedown', (event) => {
      const index = vertexAt(event.point);
      if (index === null) return;
      event.preventDefault();
      dragging = index;
      dragged = false;
      setSelectedVertex(index);
      remember();
      map.dragPan.disable();
    });
    map.on('mousemove', (event) => {
      if (dragging === null) return;
      dragged = true;
      const points = structuredClone(coordinatesRef.current);
      points[dragging] = [event.lngLat.lng, event.lngLat.lat];
      if (closedRef.current && dragging === 0) points[points.length - 1] = [...points[0]];
      change(points, closedRef.current);
    });
    const stopDrag = () => { dragging = null; map.dragPan?.enable(); };
    map.on('mouseup', stopDrag);
    window.addEventListener('mouseup', stopDrag);
    map.on('click', (event) => {
      if (dragged) { dragged = false; return; }
      const index = vertexAt(event.point);
      if (index !== null) { setSelectedVertex(index); return; }
      const point: Position = [event.lngLat.lng, event.lngLat.lat];
      const points = structuredClone(coordinatesRef.current);
      if (closedRef.current) {
        // Insert into the closest edge in screen space, preserving ring order.
        let best = Infinity;
        let insertion = 1;
        for (let i = 0; i < points.length - 1; i++) {
          const a = map.project(points[i]);
          const b = map.project(points[i + 1]);
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((event.point.x - a.x) * dx + (event.point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          const distance = Math.hypot(event.point.x - a.x - t * dx, event.point.y - a.y - t * dy);
          if (distance < best) { best = distance; insertion = i + 1; }
        }
        if (best > 14) { setSelectedVertex(null); return; }
        remember();
        points.splice(insertion, 0, point);
        change(points, true);
        setSelectedVertex(insertion);
      } else {
        remember();
        change([...points, point], false);
      }
    });
    map.on('dblclick', finishDrawing);
    mapRef.current = map;
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => map.resize())
      : null;
    resizeObserver?.observe(mapContainerRef.current);
    return () => {
      window.removeEventListener('mouseup', stopDrag);
      resizeObserver?.disconnect();
      window.clearTimeout(loadTimer);
      map.remove();
      mapRef.current = null;
      mapReady.current = false;
    };
  }, [change, remember, finishDrawing, initialCenter, initialGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource('saved-boundary') as GeoJSONSource | undefined)?.setData(asFeature(dirty ? null : initialGeometry ?? null));
    (map.getSource('draft-boundary') as GeoJSONSource | undefined)?.setData(asFeature(draftGeometry));
    (map.getSource('draft-preview') as GeoJSONSource | undefined)?.setData(
      closed ? lineFeature([]) : lineFeature(coordinates),
    );
    (map.getSource('draft-vertices') as GeoJSONSource | undefined)?.setData(
      pointFeatures(coordinates, closed),
    );
    map.setPaintProperty?.('draft-vertices', 'circle-color', ['case', ['==', ['get', 'index'], selectedVertex ?? -1], '#f59e0b', '#fff7e6']);
    setMapCursor(map, closed ? 'grab' : 'crosshair');
  }, [closed, coordinates, draftGeometry, dirty, initialGeometry, mapMode, selectedVertex]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
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
    remember();
    change([], false);
    setSelectedVertex(null);
    setImportError(null);
  };

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    change(previous.coordinates, previous.closed);
    setHistoryLength(history.current.length);
    setSelectedVertex(null);
  };

  const reset = () => {
    change(structuredClone((initialGeometry?.coordinates[0] ?? []) as Position[]), Boolean(initialGeometry));
    history.current = [];
    setHistoryLength(0);
    setSelectedVertex(null);
    setImportError(null);
    setImportText('');
    setDirty(false);
  };

  const deleteVertex = () => {
    if (selectedVertex === null) return;
    remember();
    const points = closed ? coordinates.slice(0, -1) : [...coordinates];
    points.splice(selectedVertex, 1);
    const staysClosed = closed && points.length >= 3;
    change(staysClosed ? [...points, [...points[0]]] : points, staysClosed);
    setSelectedVertex(null);
  };

  const applyImport = (value: string) => {
    try {
      const geometry = parseImportedGeometry(value);
      remember();
      change(geometry.coordinates[0] as Position[], true);
      setImportError(null);
      setBoundaryConfirmed(false);
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
    if (!query) {
      setLocationStatus('Enter a place or latitude, longitude.');
      return;
    }
    setLocationStatus('Searching…');
    try {
      const direct = query.split(',').map((part) => part.trim());
      let center: Position;
      let label: string;
      if (direct.length === 2 && direct.every((part) => part !== '' && Number.isFinite(Number(part)))) {
        center = [Number(direct[1]), Number(direct[0])];
        label = 'Map moved to the supplied coordinates.';
      } else {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'en' } },
        );
        if (!response.ok) throw new Error('Location search is unavailable. Please try again.');
        const matches = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
        if (!matches[0]) throw new Error('No matching place was found.');
        center = [Number(matches[0].lon), Number(matches[0].lat)];
        label = matches[0].display_name;
      }
      if (!center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) {
        throw new Error('Enter valid latitude and longitude coordinates.');
      }
      setFallbackCenter(center);
      setFallbackZoom(14);
      pendingCenter.current = center;
      if (mapReady.current && mapRef.current) {
        mapRef.current.flyTo({ center, zoom: 14 });
        pendingCenter.current = null;
      }
      setLocationStatus(label);
    } catch (error) {
      setLocationStatus(error instanceof Error ? error.message : 'Location search failed. Please try again.');
    }
  };

  const addFallbackVertex = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (closedRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerPoint = mercatorPoint(fallbackCenter, fallbackZoom);
    const clickedPoint: Position = [
      centerPoint[0] + event.clientX - rect.left - rect.width / 2,
      centerPoint[1] + event.clientY - rect.top - rect.height / 2,
    ];
    remember();
    change([...coordinatesRef.current, unprojectMercator(clickedPoint, fallbackZoom)], false);
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
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchLocation(); } }}
          />
          <Button type="button" variant="outline" onClick={() => void searchLocation()}>
            <LocateFixed /> Find
          </Button>
        </div>
        <output className="map-helper-text" aria-live="polite">{locationStatus ?? 'Search for a place or enter latitude, longitude.'}</output>
      </div>

      <div className="map-workspace">
        <div className="map-canvas" ref={mapContainerRef} aria-label="Interactive farm boundary map" />
        {mapMode === 'loading' && (
          <output className="map-loading">Loading map…</output>
        )}
        {mapMode === 'fallback' && (
          <div className="fallback-map" data-testid="fallback-map">
            <iframe
              key={`${fallbackCenter.join(',')}-${fallbackZoom}`}
              src={fallbackMapUrl(fallbackCenter, fallbackZoom)}
              title="OpenStreetMap farm boundary map"
              loading="eager"
            />
            <button
              type="button"
              className="fallback-drawing-surface"
              aria-label="Farm boundary drawing surface"
              onClick={addFallbackVertex}
              onDoubleClick={finishDrawing}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !closedRef.current) {
                  setCoordinates((current) => [...current, fallbackCenter]);
                  setDirty(true);
                }
              }}
            >
              <svg viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
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
            </button>
            <span className="fallback-map-note">Compatibility map · click to add boundary points</span>
          </div>
        )}
        <output className="map-drawing-hint">
          {closed
            ? 'Drag a corner to move it · click an edge to add a corner'
            : coordinates.length === 0
              ? 'Click the map to place the first corner'
              : coordinates.length < 3
                ? `Place ${3 - coordinates.length} more ${coordinates.length === 2 ? 'corner' : 'corners'}`
                : 'Ready to close · double-click map or use Close ring ↙'}
        </output>
        {!closed && coordinates.length >= 3 && (
          <div className="map-close-ring-cta">
            <Button type="button" size="sm" onClick={finishDrawing}>
              <Redo2 /> Close ring to finish boundary
            </Button>
          </div>
        )}
        <div className="drawing-controls" aria-label="Drawing controls">
          <Button type="button" onClick={startDrawing}><RotateCcw /> Draw boundary</Button>
          <Button type="button" variant="outline" onClick={undo} disabled={historyLength === 0}>
            <Undo2 /> Undo vertex
          </Button>
          <Button type="button" variant="outline" onClick={finishDrawing} disabled={closed || coordinates.length < 3}>
            <Redo2 /> Close ring
          </Button>
          <Button type="button" variant="outline" onClick={deleteVertex} disabled={selectedVertex === null}>Delete selected corner</Button>
          <Button type="button" variant="outline" onClick={startDrawing} disabled={coordinates.length === 0}>Erase boundary</Button>
          <Button type="button" variant="outline" onClick={reset} disabled={!dirty}>Reset / cancel edits</Button>
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
            <output>{validationState.message}</output>
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
        <div>
          {/* Inline name input — shown when user has scrolled past the top name field */}
          {!canSave && onNameChange !== undefined && (
            <div className="inline-name-field">
              <label htmlFor="inline-farm-name" className="inline-name-label">Farm name</label>
              <Input
                id="inline-farm-name"
                placeholder="Enter a name for this farm"
                value={farmName ?? ''}
                onChange={(e) => onNameChange(e.target.value)}
                aria-label="Farm name"
              />
            </div>
          )}
          {requireBoundaryConfirmation && closed && coordinates.length >= 3 && (
            <label className="boundary-confirmation">
              <input
                type="checkbox"
                checked={boundaryConfirmed}
                onChange={(event) => setBoundaryConfirmed(event.target.checked)}
              />
              <span>I confirm this boundary represents land I own or manage.</span>
            </label>
          )}
          <p>{hasUnsavedChanges ? 'You have unsaved changes.' : initialGeometry ? 'The saved boundary is unchanged.' : 'Draw your land boundary to get started.'}</p>
        </div>
        <Button
          className="primary-button"
          type="button"
          disabled={!validationState.valid || !draftGeometry || !hasUnsavedChanges || !canSave || isSaving || (requireBoundaryConfirmation && !boundaryConfirmed)}
          onClick={() => draftGeometry && void onSave(draftGeometry)}
        >
          <Save /> {isSaving ? 'Saving farm…' : 'Save farm'}
        </Button>
      </div>
      {saveBlockingReason && <p className="map-save-blocker" role="status">{saveBlockingReason}</p>}
    </section>
  );
}
