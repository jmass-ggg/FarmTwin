'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnnualPlanPage from './page';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  getAnnualPlan,
  createPlanEntry,
  acceptChangeProposal,
  dismissChangeProposal,
  deletePlanEntry,
  calculateDecisionSupport,
  PlannerConflictError,
} = vi.hoisted(() => ({
  getAnnualPlan: vi.fn(),
  createPlanEntry: vi.fn(),
  acceptChangeProposal: vi.fn(),
  dismissChangeProposal: vi.fn(),
  deletePlanEntry: vi.fn(),
  calculateDecisionSupport: vi.fn(),
  PlannerConflictError: class PlannerConflictError extends Error {
    status = 422;
    details: unknown[];
    constructor(message: string, details: unknown[], requestId?: string) {
      super(message);
      this.name = 'PlannerConflictError';
      this.details = details;
      void requestId;
    }
  },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ farmId: 'farm-001' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/api/planner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/planner')>();
  return {
    ...actual,
    getAnnualPlan,
    createPlanEntry,
    acceptChangeProposal,
    dismissChangeProposal,
    deletePlanEntry,
    PlannerConflictError,
  };
});

vi.mock('@/lib/api/farms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/farms')>();
  return { ...actual, calculateDecisionSupport };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function makeDecisionSupportResponse() {
  return {
    farm_id: 'farm-001',
    farm_name: 'Test Farm',
    disclaimer: 'Planning estimate only.',
    model_version: 'v1',
    centroid: { latitude: -1.3, longitude: 36.8 },
    assumptions: ['Assumes uniform soil.'],
    selected_month: {
      month: 'January',
      month_number: 1,
      planting_window: 'Early January',
      expected_temperature_c: 22,
      expected_rainfall_mm: 60,
      main_risk: 'Drought',
      recommendations: [
        { crop: 'Maize', score: 85, label: 'Good match', reason: 'Grows well here.', temperature_score: 80, water_score: 75, climate_safety_score: 90 },
        { crop: 'Beans', score: 72, label: 'Possible match', reason: 'Adequate conditions.', temperature_score: 70, water_score: 68, climate_safety_score: 80 },
        { crop: 'Sorghum', score: 65, label: 'Higher caution', reason: 'Water limited.', temperature_score: 65, water_score: 60, climate_safety_score: 70 },
      ],
    },
    months: MONTH_NAMES.map((name, i) => ({
      month: name,
      month_number: i + 1,
      recommendations: [
        { crop: 'Maize', score: 80, label: 'Good match' },
        { crop: 'Beans', score: 70, label: 'Possible match' },
      ],
      main_risk: 'Drought',
    })),
    comparison: [
      { crop: 'Maize', baseline_score: 85, scenario_score: 80, delta: -5 },
    ],
  };
}

function makeAnnualPlanResponse(
  entries: import('@/lib/api/planner').PlanEntryResponse[] = [],
  proposals: import('@/lib/api/planner').ChangeProposalResponse[] = [],
): import('@/lib/api/planner').AnnualPlanResponse {
  return {
    farm_id: 'farm-001',
    year: new Date().getFullYear(),
    months: [],
    entries,
    proposals,
  };
}

function makePlanEntry(overrides: Partial<import('@/lib/api/planner').PlanEntryResponse> = {}): import('@/lib/api/planner').PlanEntryResponse {
  const year = new Date().getFullYear();
  return {
    id: 'entry-1',
    farm_id: 'farm-001',
    crop_name: 'Maize',
    planting_date: `${year}-01-01`,
    harvest_date: `${year}-04-01`,
    cultivation_mode: 'rain_fed',
    irrigation_mm: null,
    area_ha: 2.5,
    snapshot_id: null,
    data_mode: 'demonstration',
    suitability_index: 85,
    engine_version: 'v1',
    created_at: `${year}-01-01T00:00:00Z`,
    updated_at: null,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<import('@/lib/api/planner').ChangeProposalResponse> = {}): import('@/lib/api/planner').ChangeProposalResponse {
  return {
    id: 'proposal-1',
    farm_id: 'farm-001',
    entry_id: 'entry-1',
    old_suitability_index: 85,
    new_suitability_index: 72,
    changed_inputs: { rainfall_mm: { old: 60, new: 40 } },
    new_snapshot_id: 'snap-2',
    issue_date: new Date().toISOString(),
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('AnnualPlanPage', () => {
  beforeEach(() => {
    calculateDecisionSupport.mockResolvedValue(makeDecisionSupportResponse());
    getAnnualPlan.mockResolvedValue(makeAnnualPlanResponse());
    createPlanEntry.mockResolvedValue(makePlanEntry());
    acceptChangeProposal.mockResolvedValue(makePlanEntry());
    dismissChangeProposal.mockResolvedValue(undefined);
    deletePlanEntry.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Requirement 5.2 — Saved badge on month card
  // -------------------------------------------------------------------------

  describe('month card saved indicator (Req 5.2)', () => {
    it('shows a "Saved" badge on a month card when a plan entry exists for that month', async () => {
      const entry = makePlanEntry({ planting_date: `${new Date().getFullYear()}-01-15` });
      getAnnualPlan.mockResolvedValue(makeAnnualPlanResponse([entry]));

      renderWithClient(<AnnualPlanPage />);

      await waitFor(() =>
        expect(screen.getByLabelText('Saved entry')).toBeInTheDocument(),
      );
    });

    it('does not show a "Saved" badge when no plan entries exist', async () => {
      getAnnualPlan.mockResolvedValue(makeAnnualPlanResponse([]));

      renderWithClient(<AnnualPlanPage />);

      // Wait for the page to finish loading (month grid renders)
      await waitFor(() =>
        expect(screen.getByText('Jan')).toBeInTheDocument(),
      );

      expect(screen.queryByLabelText('Saved entry')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 5.3 — Add-to-plan form
  // -------------------------------------------------------------------------

  describe('"Add to plan" form (Req 5.3)', () => {
    it('calls createPlanEntry on form submission', async () => {
      const user = userEvent.setup();
      renderWithClient(<AnnualPlanPage />);

      // Wait for crop recommendations to load
      await waitFor(() =>
        expect(screen.getByLabelText('Add Maize to plan')).toBeInTheDocument(),
      );

      await user.click(screen.getByLabelText('Add Maize to plan'));

      // Dialog should open with the form
      await waitFor(() =>
        expect(screen.getByRole('dialog')).toBeInTheDocument(),
      );

      await user.click(screen.getByRole('button', { name: 'Add to plan' }));

      await waitFor(() => expect(createPlanEntry).toHaveBeenCalledOnce());
      expect(createPlanEntry).toHaveBeenCalledWith(
        'farm-001',
        expect.objectContaining({ crop_name: 'Maize', cultivation_mode: 'rain_fed' }),
      );
    });

    it('keeps the dialog open and does not call onSuccess when createPlanEntry returns 422', async () => {
      const user = userEvent.setup();
      createPlanEntry.mockRejectedValue(
        new PlannerConflictError('Overlap detected', [{ field: 'planting_date', message: 'Overlaps with existing entry' }]),
      );

      renderWithClient(<AnnualPlanPage />);

      await waitFor(() =>
        expect(screen.getByLabelText('Add Maize to plan')).toBeInTheDocument(),
      );

      await user.click(screen.getByLabelText('Add Maize to plan'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Add to plan' }));

      // createPlanEntry was called with the conflict
      await waitFor(() => expect(createPlanEntry).toHaveBeenCalledOnce());
      // Dialog stays open (form still visible after error)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 5.5 — Change proposal dialog
  // -------------------------------------------------------------------------

  describe('change proposal dialog (Req 5.5)', () => {
    it('shows a notification badge when proposals are pending', async () => {
      const entry = makePlanEntry();
      const proposal = makeProposal();
      getAnnualPlan.mockResolvedValue(makeAnnualPlanResponse([entry], [proposal]));

      renderWithClient(<AnnualPlanPage />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Review change proposals' })).toBeInTheDocument(),
      );

      const trigger = screen.getByRole('button', { name: 'Review change proposals' });
      expect(within(trigger).getByText('1')).toBeInTheDocument();
    });

    it('shows accept and reject buttons inside the proposal dialog', async () => {
      const user = userEvent.setup();
      const entry = makePlanEntry();
      const proposal = makeProposal();
      getAnnualPlan.mockResolvedValue(makeAnnualPlanResponse([entry], [proposal]));

      renderWithClient(<AnnualPlanPage />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Review change proposals' })).toBeInTheDocument(),
      );

      await user.click(screen.getByRole('button', { name: 'Review change proposals' }));

      await waitFor(() =>
        expect(screen.getByRole('dialog')).toBeInTheDocument(),
      );

      expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
    });

    it('calls acceptChangeProposal when the Accept button is clicked', async () => {
      const user = userEvent.setup();
      const entry = makePlanEntry();
      const proposal = makeProposal();
      getAnnualPlan.mockResolvedValue(makeAnnualPlanResponse([entry], [proposal]));

      renderWithClient(<AnnualPlanPage />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Review change proposals' })).toBeInTheDocument(),
      );

      await user.click(screen.getByRole('button', { name: 'Review change proposals' }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /Accept/i }));

      await waitFor(() => expect(acceptChangeProposal).toHaveBeenCalledWith('farm-001', 'proposal-1'));
    });
  });
});
