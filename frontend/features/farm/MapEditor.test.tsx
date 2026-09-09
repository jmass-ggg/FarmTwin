import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Link from 'next/link';

import { MapEditor } from './MapEditor';

const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
const flyTo = vi.fn();
let mapShouldFail = false;

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
    remove() {}
    on(event: string, handler: () => void) { if (event === 'load') handler(); }
  }
  return {
    default: {
      Map: MockMap,
      AttributionControl: class {},
      NavigationControl: class {},
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
  beforeEach(() => { sources.clear(); flyTo.mockClear(); mapShouldFail = false; });

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
