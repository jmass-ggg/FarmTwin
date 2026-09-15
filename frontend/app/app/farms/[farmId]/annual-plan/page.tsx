'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle,
  CloudRain,
  Info,
  Plus,
  ThermometerSun,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ScenarioControls } from '@/features/decision/ScenarioControls';
import { CropVisual } from '@/features/crops/CropCard';
import {
  acceptChangeProposal,
  createPlanEntry,
  deletePlanEntry,
  dismissChangeProposal,
  getAnnualPlan,
  type PlanEntryCreate,
} from '@/lib/api/planner';
import { calculateDecisionSupport } from '@/lib/api/farms';
import {
  computeScenario,
  type CropScenarioResult,
  type HazardScenarioResult,
} from '@/lib/api/scenarios';

// ---------------------------------------------------------------------------
// Add-to-plan form
// ---------------------------------------------------------------------------

interface AddToPlanFormProps {
  farmId: string;
  cropName: string;
  monthNumber: number;
  monthName: string;
  onSuccess: () => void;
  onClose: () => void;
}

function AddToPlanForm({
  farmId,
  cropName,
  monthNumber,
  monthName,
  onSuccess,
  onClose,
}: AddToPlanFormProps) {
  const year = new Date().getFullYear();
  const defaultDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`;

  const [plantingDate, setPlantingDate] = useState(defaultDate);
  const [cultivationMode, setCultivationMode] = useState<'rain_fed' | 'irrigated'>('rain_fed');
  const [irrigationMm, setIrrigationMm] = useState('');
  const [areaHa, setAreaHa] = useState('1');

  const mutation = useMutation({
    mutationFn: (data: PlanEntryCreate) => createPlanEntry(farmId, data),
    onSuccess: () => {
      toast.add({ title: `${cropName} added to plan`, type: 'success' });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.add({
        title: 'Could not add entry',
        description: err.message,
        type: 'error',
      });
    },
  });

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: PlanEntryCreate = {
      crop_name: cropName,
      planting_date: plantingDate,
      cultivation_mode: cultivationMode,
      area_ha: Number(areaHa),
    };
    if (cultivationMode === 'irrigated' && irrigationMm) {
      data.irrigation_mm = Number(irrigationMm);
    }
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="planner-form">
      <div className="planner-form-field">
        <label htmlFor="crop-name-display">Crop</label>
        <p id="crop-name-display" className="planner-form-value">
          {cropName}
        </p>
      </div>

      <div className="planner-form-field">
        <label htmlFor="planting-date">Planting date</label>
        <input
          id="planting-date"
          type="date"
          value={plantingDate}
          onChange={(e) => setPlantingDate(e.target.value)}
          required
          aria-label={`Planting date for ${monthName}`}
        />
      </div>

      <fieldset className="planner-form-field">
        <legend>Cultivation mode</legend>
        <div className="planner-radio-group">
          <label>
            <input
              type="radio"
              name="cultivation-mode"
              value="rain_fed"
              checked={cultivationMode === 'rain_fed'}
              onChange={() => setCultivationMode('rain_fed')}
            />
            Rain-fed
          </label>
          <label>
            <input
              type="radio"
              name="cultivation-mode"
              value="irrigated"
              checked={cultivationMode === 'irrigated'}
              onChange={() => setCultivationMode('irrigated')}
            />
            Irrigated
          </label>
        </div>
      </fieldset>

      {cultivationMode === 'irrigated' && (
        <div className="planner-form-field">
          <label htmlFor="irrigation-mm">Irrigation (mm/month)</label>
          <input
            id="irrigation-mm"
            type="number"
            min="0"
            step="any"
            value={irrigationMm}
            onChange={(e) => setIrrigationMm(e.target.value)}
            required
            aria-label="Irrigation quantity in millimetres per month"
          />
        </div>
      )}

      <div className="planner-form-field">
        <label htmlFor="area-ha">Area (hectares)</label>
        <input
          id="area-ha"
          type="number"
          min="0.01"
          step="any"
          value={areaHa}
          onChange={(e) => setAreaHa(e.target.value)}
          required
          aria-label="Area in hectares"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add to plan'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete-entry confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteEntryDialogProps {
  farmId: string;
  entryId: string;
  cropName: string;
  onDeleted: () => void;
}

function DeleteEntryDialog({
  farmId,
  entryId,
  cropName,
  onDeleted,
}: DeleteEntryDialogProps) {
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deletePlanEntry(farmId, entryId),
    onSuccess: () => {
      toast.add({ title: `${cropName} removed from plan`, type: 'success' });
      setOpen(false);
      onDeleted();
    },
    onError: (err: Error) => {
      toast.add({ title: 'Delete failed', description: err.message, type: 'error' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${cropName} entry`}
          />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove entry?</DialogTitle>
          <DialogDescription>
            This will permanently remove <strong>{cropName}</strong> from your
            saved schedule.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Change-proposal review dialog
// ---------------------------------------------------------------------------

interface ProposalDialogProps {
  farmId: string;
  proposals: import('@/lib/api/planner').ChangeProposalResponse[];
  entries: import('@/lib/api/planner').PlanEntryResponse[];
  onAccepted: () => void;
}

function ProposalDialog({ farmId, proposals, entries, onAccepted }: ProposalDialogProps) {
  const [open, setOpen] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: (proposalId: string) => acceptChangeProposal(farmId, proposalId),
    onSuccess: () => {
      toast.add({ title: 'Proposal accepted', type: 'success' });
      setOpen(false);
      onAccepted();
    },
    onError: (err: Error) => {
      toast.add({ title: 'Accept failed', description: err.message, type: 'error' });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (proposalId: string) => dismissChangeProposal(farmId, proposalId),
    onSuccess: () => {
      toast.add({ title: 'Proposal dismissed', type: 'success' });
      setOpen(false);
      onAccepted();
    },
    onError: (err: Error) => {
      toast.add({ title: 'Dismiss failed', description: err.message, type: 'error' });
    },
  });

  const isBusy = acceptMutation.isPending || dismissMutation.isPending;

  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  if (pendingProposals.length === 0) return null;
  const featuredProposal = pendingProposals[0];
  const featuredEntry = entries.find((entry) => entry.id === featuredProposal.entry_id);
  const featuredDelta = featuredProposal.new_suitability_index - featuredProposal.old_suitability_index;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="planner-change-banner" aria-label="Review change proposals" />
        }
      >
        <Bell />
        <span className="planner-change-copy">
          <strong>Farm plan update available</strong>
          <span>
            {featuredEntry?.crop_name ?? 'A saved crop'} suitability changed from{' '}
            {featuredProposal.old_suitability_index} to {featuredProposal.new_suitability_index}
            {featuredDelta === 0 ? '.' : ` (${featuredDelta > 0 ? '+' : ''}${featuredDelta}).`}
          </span>
        </span>
        <span className="planner-change-link">View details</span>
        <span className="proposal-badge" aria-label={`${pendingProposals.length} pending proposals`}>
          {pendingProposals.length}
        </span>
      </DialogTrigger>

      <DialogContent className="proposal-dialog-content" showCloseButton>
        <DialogHeader>
          <DialogTitle>Change Proposals</DialogTitle>
          <DialogDescription>
            Environmental conditions have changed. Review and accept or dismiss
            each proposal.
          </DialogDescription>
        </DialogHeader>

        <div className="proposal-list">
          {pendingProposals.map((proposal) => {
            const entry = entries.find((e) => e.id === proposal.entry_id);
            const delta = proposal.new_suitability_index - proposal.old_suitability_index;
            return (
              <div key={proposal.id} className="proposal-item">
                <div className="proposal-item-header">
                  <strong>{entry?.crop_name ?? 'Unknown crop'}</strong>
                  <span className="proposal-delta" data-direction={delta > 0 ? 'up' : 'down'}>
                    {delta > 0 ? '+' : ''}{delta} pts
                  </span>
                </div>
                <div className="proposal-scores">
                  <span>
                    Was <b>{proposal.old_suitability_index}</b>
                  </span>
                  <span>→</span>
                  <span>
                    Now <b>{proposal.new_suitability_index}</b>
                  </span>
                </div>
                {Object.entries(proposal.changed_inputs).length > 0 && (
                  <dl className="proposal-changes">
                    {Object.entries(proposal.changed_inputs).map(([field, vals]) => (
                      <div key={field}>
                        <dt>{field}</dt>
                        <dd>
                          {String((vals as { old: unknown; new: unknown }).old)} →{' '}
                          {String((vals as { old: unknown; new: unknown }).new)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="proposal-item-actions">
                  <Button
                    size="sm"
                    onClick={() => acceptMutation.mutate(proposal.id)}
                    disabled={isBusy}
                  >
                    <CheckCircle />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissMutation.mutate(proposal.id)}
                    disabled={isBusy}
                    aria-label={`Reject proposal for ${entry?.crop_name ?? 'crop'}`}
                  >
                    <X />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnnualPlanPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();

  const [month, setMonth] = useState(1);
  const [draftRainfall, setDraftRainfall] = useState(0);
  const [draftTemperature, setDraftTemperature] = useState(0);
  const [draftIrrigationMm, setDraftIrrigationMm] = useState('');
  const [scenario, setScenario] = useState({ rainfall: 0, temperature: 0 });
  const [addToPlanOpen, setAddToPlanOpen] = useState(false);
  const [addToPlanCrop, setAddToPlanCrop] = useState<{ name: string; monthNumber: number; monthName: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cropName = params.get('crop')?.trim();
    const requestedMonth = Number(params.get('month'));
    if (!cropName) return;
    const monthNumber = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth
      : new Date().getMonth() + 1;
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
      new Date(Date.UTC(year, monthNumber - 1, 1)),
    );
    queueMicrotask(() => {
      setMonth(monthNumber);
      setAddToPlanCrop({ name: cropName, monthNumber, monthName });
      setAddToPlanOpen(true);
    });
  }, [year]);

  // Real scenario results (populated when snapshot is available)
  const [scenarioResult, setScenarioResult] = useState<{
    crops: CropScenarioResult[];
    hazards: HazardScenarioResult[];
  } | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);

  const plan = useQuery({
    queryKey: [
      'decision-support',
      farmId,
      month,
      scenario.rainfall,
      scenario.temperature,
    ],
    queryFn: ({ signal }) =>
      calculateDecisionSupport(
        farmId,
        {
          selected_month: month,
          rainfall_change_pct: scenario.rainfall,
          temperature_change_c: scenario.temperature,
        },
        signal,
      ),
  });

  const cropPlan = useQuery({
    queryKey: ['crop-plan', farmId, year],
    queryFn: ({ signal }) => getAnnualPlan(farmId, year, signal),
  });

  const invalidatePlan = () => {
    void queryClient.invalidateQueries({ queryKey: ['crop-plan', farmId, year] });
  };

  // Build a set of month numbers that already have a saved entry
  const savedMonths = new Set(
    (cropPlan.data?.entries ?? []).map((e) => {
      const d = new Date(e.planting_date);
      return d.getUTCMonth() + 1;
    }),
  );

  // Derive snapshotId from the decision-support response data_mode
  // (data_mode !== 'demonstration' means a snapshot is backing the response)
  const snapshotId =
    plan.data && plan.data.data_mode !== 'demonstration'
      ? (plan.data as { snapshot_id?: string }).snapshot_id ?? null
      : null;

  const apply = async () => {
    const hasChanges =
      draftRainfall !== 0 || draftTemperature !== 0 || draftIrrigationMm !== '';

    if (snapshotId && hasChanges) {
      // Use real scenario API when a snapshot backs the response
      setScenarioBusy(true);
      try {
        const result = await computeScenario(farmId, 'Planner scenario', {
          rainfall_change_pct: draftRainfall,
          temperature_change_c: draftTemperature,
          irrigation_mm_override: draftIrrigationMm !== '' ? parseFloat(draftIrrigationMm) : null,
        });
        setScenarioResult({ crops: result.crops, hazards: result.hazards });
        setScenario({ rainfall: draftRainfall, temperature: draftTemperature });
      } catch {
        // fall through to demo engine on error
        setScenario({ rainfall: draftRainfall, temperature: draftTemperature });
      } finally {
        setScenarioBusy(false);
      }
    } else {
      // Demo engine path — just pass params to decision-support query
      setScenarioResult(null);
      setScenario({ rainfall: draftRainfall, temperature: draftTemperature });
    }
  };

  const reset = () => {
    setDraftRainfall(0);
    setDraftTemperature(0);
    setDraftIrrigationMm('');
    setScenario({ rainfall: 0, temperature: 0 });
    setScenarioResult(null);
  };

  const openAddToPlan = (cropName: string, monthNumber: number, monthName: string) => {
    setAddToPlanCrop({ name: cropName, monthNumber, monthName });
    setAddToPlanOpen(true);
  };

  const selectedRecommendation = plan.data?.selected_month.recommendations[0] ?? null;

  return (
    <div className="decision-page content-stack">
      <Link className="back-link" href={`/app/farms/${farmId}/twin`}>
        <ArrowLeft /> Back to farm
      </Link>
      <header className="page-heading decision-heading">
        <div>
          <p className="section-kicker">{plan.data?.farm_name ?? 'Annual planning'}</p>
          <h1>Your Annual Farm Plan</h1>
          <p>See which crops are most suitable for each month based on available farm conditions.</p>
        </div>
        {plan.data?.data_mode && (
          <span className="mode-pill" data-mode={plan.data.data_mode}>
            {plan.data.data_mode === 'demonstration'
              ? 'Demonstration profile'
              : plan.data.data_mode.replace(/_/g, ' ')}
          </span>
        )}
      </header>

      {cropPlan.data && (
        <ProposalDialog
          farmId={farmId}
          proposals={cropPlan.data.proposals}
          entries={cropPlan.data.entries}
          onAccepted={invalidatePlan}
        />
      )}

      {plan.isPending && (
        <div className="decision-loading">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      )}
      {plan.isError && (
        <ApiErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      )}
      {plan.data && (
        <>
          <div className="evidence-banner">
            <Info />
            <span>
              <strong>Planning estimate—not a forecast.</strong>{' '}
              {plan.data.disclaimer}
            </span>
          </div>
          <details className="planner-secondary-tools">
            <summary>Climate what-if</summary>
            <ScenarioControls
              rainfall={draftRainfall}
              temperature={draftTemperature}
              irrigationMm={draftIrrigationMm}
              busy={plan.isFetching || scenarioBusy}
              onRainfallChange={setDraftRainfall}
              onTemperatureChange={setDraftTemperature}
              onIrrigationChange={setDraftIrrigationMm}
              onApply={() => void apply()}
              onReset={reset}
            />
          </details>

          <div className="annual-plan-workspace">
          <section className="annual-months" aria-labelledby="year-title">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Twelve planting periods</p>
                <h2 id="year-title">What fits, and when?</h2>
              </div>
              <p>Select a month for the full explanation.</p>
            </div>
            <div className="month-grid">
              {plan.data.months.map((item) => (
                <button
                  key={item.month}
                  type="button"
                  data-active={item.month_number === month || undefined}
                  onClick={() => setMonth(item.month_number)}
                >
                  <span className="month-grid-label-row">
                    {item.month.slice(0, 3)}
                    {savedMonths.has(item.month_number) && (
                      <span className="saved-badge" aria-label="Saved entry">
                        <CheckCircle aria-hidden="true" /> Saved
                      </span>
                    )}
                  </span>
                  {item.recommendations[0] ? (
                    <>
                      <CropVisual cropName={item.recommendations[0].crop} />
                      <strong className="month-crop-name">{item.recommendations[0].crop}</strong>
                      <small className="month-status-pill">{item.recommendations[0].label}</small>
                    </>
                  ) : (
                    <>
                      <CropVisual cropName="" />
                      <strong className="month-crop-name">No recommendation</strong>
                    </>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section
            className="workspace-card month-detail"
            aria-labelledby="month-detail-title"
          >
            <div className="month-detail-hero">
              <div className="month-detail-visual">
                <CropVisual cropName={selectedRecommendation?.crop ?? ''} />
              </div>
              <div>
                <p className="month-detail-month">{plan.data.selected_month.month}</p>
                <span>Recommended crop</span>
                <h2 id="month-detail-title">
                  {selectedRecommendation?.crop ?? 'No recommendation'}
                </h2>
                {selectedRecommendation && (
                  <strong className="month-detail-score">
                    {selectedRecommendation.score}% · {selectedRecommendation.label}
                  </strong>
                )}
              </div>
            </div>
            <div className="climate-metrics">
              <div>
                <ThermometerSun />
                <span>
                  <small>Expected temperature</small>
                  <strong>
                    {plan.data.selected_month.expected_temperature_c}°C
                  </strong>
                </span>
              </div>
              <div>
                <CloudRain />
                <span>
                  <small>Expected rainfall</small>
                  <strong>
                    {plan.data.selected_month.expected_rainfall_mm} mm
                  </strong>
                </span>
              </div>
              <div>
                <CalendarDays />
                <span>
                  <small>Planting window</small>
                  <strong>{plan.data.selected_month.planting_window}</strong>
                </span>
              </div>
              <div>
                <TriangleAlert />
                <span>
                  <small>Main risk</small>
                  <strong>{plan.data.selected_month.main_risk}</strong>
                </span>
              </div>
            </div>
            <div className="recommendation-grid">
              {plan.data.selected_month.recommendations.slice(0, 1).map((crop) => (
                <article key={crop.crop}>
                  <div className="month-advisory">
                    <Info aria-hidden="true" />
                    <span><strong>Why this crop?</strong>{crop.reason}</span>
                  </div>
                  <Dialog
                    open={addToPlanOpen && addToPlanCrop !== null}
                    onOpenChange={(o) => {
                      if (!o) setAddToPlanOpen(false);
                    }}
                  >
                    <DialogTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="add-to-plan-btn"
                          aria-label={`Add ${crop.crop} to plan`}
                          onClick={() =>
                            openAddToPlan(
                              crop.crop,
                              plan.data.selected_month.month_number,
                              plan.data.selected_month.month,
                            )
                          }
                        />
                      }
                    >
                      <Plus /> Add to plan
                    </DialogTrigger>
                    {addToPlanCrop && (
                        <DialogContent showCloseButton={false}>
                          <DialogHeader>
                            <DialogTitle>Add to plan</DialogTitle>
                            <DialogDescription>
                              Confirm details for{' '}
                              <strong>{addToPlanCrop.name}</strong> in{' '}
                              {addToPlanCrop.monthName}.
                            </DialogDescription>
                          </DialogHeader>
                          <AddToPlanForm
                            farmId={farmId}
                            cropName={addToPlanCrop.name}
                            monthNumber={addToPlanCrop.monthNumber}
                            monthName={addToPlanCrop.monthName}
                            onSuccess={() => {
                              setAddToPlanOpen(false);
                              invalidatePlan();
                            }}
                            onClose={() => setAddToPlanOpen(false)}
                          />
                        </DialogContent>
                      )}
                  </Dialog>
                </article>
              ))}
            </div>
          </section>
          </div>

          {(scenarioResult || scenario.rainfall !== 0 || scenario.temperature !== 0) && (
          <section
            className="workspace-card comparison-card"
            aria-labelledby="comparison-title"
          >
            <div className="card-heading-row">
              <div>
                <p className="section-kicker">Before and after</p>
                <h2 id="comparison-title">
                  Scenario impact in {plan.data.selected_month.month}
                </h2>
              </div>
              <span>
                {scenario.rainfall}% rain ·{' '}
                {scenario.temperature > 0 ? '+' : ''}
                {scenario.temperature}°C
              </span>
            </div>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <caption className="sr-only">
                  Baseline and climate scenario crop scores
                </caption>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Baseline</th>
                    <th>Scenario</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioResult
                    ? scenarioResult.crops.map((item) => {
                        const delta = item.scenario_index - item.baseline_index;
                        return (
                          <tr key={item.crop_name}>
                            <td>{item.crop_name}</td>
                            <td>
                              {item.baseline_index}
                              <small className="comparison-label"> {item.baseline_label}</small>
                            </td>
                            <td>
                              {item.scenario_index}
                              <small className="comparison-label"> {item.scenario_label}</small>
                            </td>
                            <td>
                              <b
                                data-direction={
                                  delta === 0 ? 'same' : delta > 0 ? 'up' : 'down'
                                }
                              >
                                {delta > 0 ? '+' : ''}
                                {delta}
                              </b>
                            </td>
                          </tr>
                        );
                      })
                    : plan.data.comparison.map((item) => (
                        <tr key={item.crop}>
                          <td>{item.crop}</td>
                          <td>{item.baseline_score}</td>
                          <td>{item.scenario_score}</td>
                          <td>
                            <b
                              data-direction={
                                item.delta === 0
                                  ? 'same'
                                  : item.delta > 0
                                    ? 'up'
                                    : 'down'
                              }
                            >
                              {item.delta > 0 ? '+' : ''}
                              {item.delta}
                            </b>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {scenarioResult && scenarioResult.hazards.length > 0 && (
              <div className="comparison-hazards">
                <h3>Hazard levels</h3>
                <table className="comparison-table">
                  <caption className="sr-only">
                    Baseline and scenario hazard levels
                  </caption>
                  <thead>
                    <tr>
                      <th>Hazard</th>
                      <th>Baseline</th>
                      <th>Scenario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResult.hazards.map((h) => (
                      <tr key={h.hazard}>
                        <td>{h.hazard}</td>
                        <td>
                          <span data-level={h.baseline_level.toLowerCase()}>
                            {h.baseline_level}
                          </span>
                        </td>
                        <td>
                          <span data-level={h.scenario_level.toLowerCase()}>
                            {h.scenario_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}

          <details className="assumptions-card">
            <summary>Model assumptions and limitations</summary>
            <ul>
              {plan.data.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Model: {plan.data.model_version} · Centroid{' '}
              {plan.data.centroid.latitude}, {plan.data.centroid.longitude}
            </p>
          </details>
        </>
      )}

      {/* Task 5.3: My Schedule panel */}
      {cropPlan.data && cropPlan.data.entries.length > 0 && (
        <section
          className="workspace-card schedule-panel"
          aria-labelledby="schedule-title"
        >
          <div className="card-heading-row">
            <div>
              <p className="section-kicker">Saved schedule</p>
              <h2 id="schedule-title" className="schedule-heading">
                My Schedule
              </h2>
            </div>
            <span className="count-badge">
              {cropPlan.data.entries.length} entr
              {cropPlan.data.entries.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>
          <ul className="schedule-list" aria-label="Saved plan entries">
            {cropPlan.data.entries.map((entry) => (
              <li key={entry.id} className="schedule-row">
                <div className="schedule-row-main">
                  <strong>{entry.crop_name}</strong>
                  <span className="schedule-dates">
                    <CalendarDays aria-hidden="true" />
                    {entry.planting_date} → {entry.harvest_date}
                  </span>
                  <span className="schedule-mode">
                    {entry.cultivation_mode === 'irrigated' ? 'Irrigated' : 'Rain-fed'}
                  </span>
                </div>
                <div className="schedule-row-meta">
                  <span className="schedule-area">{entry.area_ha} ha</span>
                  <span className="schedule-score">
                    Suitability: <b>{entry.suitability_index}</b>
                  </span>
                  <DeleteEntryDialog
                    farmId={farmId}
                    entryId={entry.id}
                    cropName={entry.crop_name}
                    onDeleted={invalidatePlan}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
