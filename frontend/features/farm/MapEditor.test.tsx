import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Link from 'next/link';

import { MapEditor } from './MapEditor';

const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
const flyTo = vi.fn();
const fitBounds = vi.fn();
let hitVertex: number | null = null;
let mapShouldFail = false;
const mapHandlers = new Map<string, (event: unknown) => void>();

vi.mock('maplibre-gl', () => {
  class MockMap {
    doubleClickZoom = { disable: vi.fn() };
    constructor() { if (mapShouldFail) throw new Error('WebGL unavailable'); }
    addControl() {}
    addSource(name: string) { sources.set(name, { setData: vi.fn() }); }
    addLayer() {}
    getSource(name: string) { return sources.get(name); }
    isStyleLoaded() { return true; }
    flyTo = flyTo;
    fitBounds = fitBounds;
    dragPan = { disable: vi.fn(), enable: vi.fn() };
    queryRenderedFeatures() { return hitVertex === null ? [] : [{ properties: { index: hitVertex } }]; }
    project(point: number[]) { return { x: point[0], y: point[1] }; }
    remove() {}
    on(event: string, handler: (event?: unknown) => void) {
      mapHandlers.set(event, handler);
      if (event === 'load') handler();
    }
  }
  return {
    default: {
      Map: MockMap,
      AttributionControl: class {},
      NavigationControl: class {},
      LngLatBounds: class { extend() { return this; } },
    },
  };
});

const valid = JSON.stringify({
  type: 'Polygon',
  coordinates: [[[36.8, -1.3], [36.805, -1.3], [36.805, -1.295], [36.8, -1.3]]],
});

async function importBoundary(text: string) {
  await userEvent.click(screen.getByText('Import GeoJSON'));
  const input = screen.getByLabelText('GeoJSON Polygon');
  fireEvent.change(input, { target: { value: text } });
  await userEvent.click(screen.getByRole('button', { name: 'Use pasted boundary' }));
}

describe('MapEditor', () => {
  it('draws three vertices, closes, undoes, redraws and saves the confirmed polygon', async () => {
    const save = vi.fn();
    render(<MapEditor requireBoundaryConfirmation onSave={save} />);
    const clickMap = (lng: number, lat: number) => act(() => {
      mapHandlers.get('click')?.({ lngLat: { lng, lat } });
    });
    const draw = () => {
      clickMap(36.8, -1.3);
      clickMap(36.805, -1.3);
      clickMap(36.805, -1.295);
    };
    draw();
    const close = screen.getByRole('button', { name: 'Close ring' });
    expect(close).toBeEnabled();
    await userEvent.click(close);
    expect(screen.getByText('Boundary is ready to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save farm' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Undo vertex' }));
    expect(close).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Draw boundary' }));
    expect(close).toBeDisabled();
    draw();
    await userEvent.click(close);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Save farm' }));
    expect(save).toHaveBeenCalledWith(JSON.parse(valid));
  });
  beforeEach(() => { sources.clear(); flyTo.mockClear(); fitBounds.mockClear(); hitVertex = null; mapShouldFail = false; });

  it('fits a saved boundary, moves and deletes a corner, inserts an edge corner, erases and resets', async () => {
    render(<MapEditor initialGeometry={JSON.parse(valid)} onSave={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalled();
    hitVertex = 0;
    act(() => mapHandlers.get('mousedown')?.({ point: { x: 0, y: 0 }, preventDefault: vi.fn() }));
    act(() => mapHandlers.get('mousemove')?.({ lngLat: { lng: 36.799, lat: -1.301 } }));
    act(() => mapHandlers.get('mouseup')?.({}));
    const draft = () => sources.get('draft-boundary')!.setData.mock.lastCall![0].geometry.coordinates[0];
    expect(draft()[0]).toEqual([36.799, -1.301]);
    expect(draft().at(-1)).toEqual(draft()[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Undo vertex' }));
    expect(draft()).toEqual(JSON.parse(valid).coordinates[0]);
    // The click after a drag is intentionally suppressed.
    hitVertex = null;
    act(() => mapHandlers.get('click')?.({ point: { x: 36.802, y: -1.3 }, lngLat: { lng: 36.802, lat: -1.3 } }));
    act(() => mapHandlers.get('click')?.({ point: { x: 36.802, y: -1.3 }, lngLat: { lng: 36.802, lat: -1.3 } }));
    expect(draft()).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected corner' }));
    expect(draft()).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Erase boundary' }));
    expect(sources.get('draft-boundary')!.setData.mock.lastCall![0].features).toEqual([]);
    expect(sources.get('saved-boundary')!.setData.mock.lastCall![0].features).toEqual([]);
    expect(screen.getByRole('button', { name: 'Save farm' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reset / cancel edits' }));
    expect(draft()).toEqual(JSON.parse(valid).coordinates[0]);
    expect(screen.getByRole('button', { name: 'Save farm' })).toBeDisabled();
  });

  it('disables save with too few vertices', () => {
    render(<MapEditor onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save farm' })).toBeDisabled();
    expect(screen.getByText(/Add 3 more distinct vertices/)).toBeInTheDocument();
  });

  it('disables save when imported area exceeds the limit', async () => {
    render(<MapEditor onSave={vi.fn()} />);
    await importBoundary(JSON.stringify({
      type: 'Polygon', coordinates: [[[30, 0], [40, 0], [40, 10], [30, 0]]],
    }));
    expect(await screen.findByText('The boundary cannot exceed 50,000 hectares.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save farm' })).toBeDisabled();
  });

  it('rejects a non-Polygon import without clearing the saved draft', async () => {
    render(<MapEditor initialGeometry={JSON.parse(valid)} hasExternalChanges onSave={vi.fn()} />);
    await importBoundary(JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('must be a GeoJSON Polygon');
    expect(screen.getByRole('button', { name: 'Save farm' })).toBeEnabled();
  });

  it('requires land confirmation before creating a farm', async () => {
    render(<MapEditor requireBoundaryConfirmation onSave={vi.fn()} />);
    await importBoundary(valid);
    const save = screen.getByRole('button', { name: 'Save farm' });
    expect(save).toBeDisabled();
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I confirm this boundary represents land I own or manage.',
      }),
    );
    expect(save).toBeEnabled();
  });

  it('guards navigation when a draft has unsaved changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<><MapEditor onSave={vi.fn()} /><Link href="/app">Leave editor</Link></>);
    await userEvent.click(screen.getByRole('button', { name: 'Draw boundary' }));
    fireEvent.click(screen.getByRole('link', { name: 'Leave editor' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
  });

  it('displays an API error without losing the editor', () => {
    render(<MapEditor apiError="The backend rejected this geometry." onSave={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The backend rejected this geometry.');
    expect(screen.getByLabelText('Interactive farm boundary map')).toBeInTheDocument();
  });

  it('shows a drawable OpenStreetMap fallback when WebGL is unavailable', async () => {
    mapShouldFail = true;
    render(<MapEditor onSave={vi.fn()} />);
    expect(await screen.findByTitle('OpenStreetMap farm boundary map')).toBeInTheDocument();
    expect(screen.getByLabelText('Farm boundary drawing surface')).toBeInTheDocument();
  });
});
