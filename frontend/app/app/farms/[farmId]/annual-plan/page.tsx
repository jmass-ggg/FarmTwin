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
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

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
import {
  acceptChangeProposal,
  createPlanEntry,
  deletePlanEntry,
  getAnnualPlan,
  type PlanEntryCreate,
} from '@/lib/api/planner';
import { calculateDecisionSupport } from '@/lib/api/farms';

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
      toast.create({ title: `${cropName} added to plan`, type: 'success' });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.create({
        title: 'Could not add entry',
        description: err.message,
        type: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
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

      <div className="planner-form-field">
        <label>Cultivation mode</label>
        <div className="planner-radio-group" role="group" aria-label="Cultivation mode">
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
      </div>

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
      toast.create({ title: `${cropName} removed from plan`, type: 'success' });
      setOpen(false);
      onDeleted();
    },
    onError: (err: Error) => {
      toast.create({ title: 'Delete failed', description: err.message, type: 'error' });
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
      toast.create({ title: 'Proposal accepted', type: 'success' });
      setOpen(false);
      onAccepted();
    },
    onError: (err: Error) => {
      toast.create({ title: 'Accept failed', description: err.message, type: 'error' });
    },
  });

  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  if (pendingProposals.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="planner-proposal-trigger" aria-label="Review change proposals" />
        }
      >
        <Bell />
        <span>
          {pendingProposals.length} proposal
          {pendingProposals.length !== 1 ? 's' : ''} pending
        </span>
        <span className="proposal-badge" aria-hidden="true">
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
                    disabled={acceptMutation.isPending}
                  >
                    <CheckCircle />
                    Accept
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
  const [scenario, setScenario] = useState({ rainfall: 0, temperature: 0 });
  const [addToPlanOpen, setAddToPlanOpen] = useState(false);
  const [addToPlanCrop, setAddToPlanCrop] = useState<{ name: string; monthNumber: number; monthName: string } | null>(null);

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

  const apply = () =>
    setScenario({ rainfall: draftRainfall, temperature: draftTemperature });
  const reset = () => {
    setDraftRainfall(0);
    setDraftTemperature(0);
    setScenario({ rainfall: 0, temperature: 0 });
  };

  const openAddToPlan = (cropName: string, monthNumber: number, monthName: string) => {
    setAddToPlanCrop({ name: cropName, monthNumber, monthName });
    setAddToPlanOpen(true);
  };

  return (
    <div className="decision-page content-stack">
      <Link className="back-link" href={`/app/farms/${farmId}/twin`}>
        <ArrowLeft /> Back to farm
      </Link>
      <header className="page-heading decision-heading">
        <div>
          <p className="section-kicker">Seasonal / annual farm planner</p>
          <h1>{plan.data?.farm_name ?? 'Plan the growing year'}</h1>
          <p>
            Compare twelve planting periods, inspect the strongest crop options,
            and test how a different climate could change the ranking.
          </p>
        </div>
        <div className="planner-header-actions">
          <span className="mode-pill">Demonstration index</span>
          {cropPlan.data && (
            <ProposalDialog
              farmId={farmId}
              proposals={cropPlan.data.proposals}
              entries={cropPlan.data.entries}
              onAccepted={invalidatePlan}
            />
          )}
        </div>
      </header>

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
          <ScenarioControls
            rainfall={draftRainfall}
            temperature={draftTemperature}
            busy={plan.isFetching}
            onRainfallChange={setDraftRainfall}
            onTemperatureChange={setDraftTemperature}
            onApply={apply}
            onReset={reset}
          />

          {/* Month grid — Task 5.1: saved-entry indicators */}
          <section aria-labelledby="year-title">
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
                    {/* Task 5.1: Saved badge */}
                    {savedMonths.has(item.month_number) && (
                      <span className="saved-badge" aria-label="Saved entry">
                        <CheckCircle aria-hidden="true" /> Saved
                      </span>
                    )}
                  </span>
                  {item.recommendations.slice(0, 2).map((crop) => (
                    <strong key={crop.crop}>
                      {crop.crop} <b>{crop.score}</b>
                    </strong>
                  ))}
                  <small>{item.main_risk}</small>
                </button>
              ))}
            </div>
          </section>

          {/* Month detail — Task 5.2: Add to plan action */}
          <section
            className="workspace-card month-detail"
            aria-labelledby="month-detail-title"
          >
            <div className="month-detail-heading">
              <div>
                <p className="section-kicker">Selected planting period</p>
                <h2 id="month-detail-title">
                  {plan.data.selected_month.month}
                </h2>
              </div>
              <span>{plan.data.selected_month.planting_window}</span>
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
              {plan.data.selected_month.recommendations.map((crop, index) => (
                <article key={crop.crop}>
                  <div>
                    <span>#{index + 1}</span>
                    <b>{crop.label}</b>
                  </div>
                  <h3>{crop.crop}</h3>
                  <strong className="crop-score">
                    {crop.score}
                    <small>/100</small>
                  </strong>
                  <p>{crop.reason}</p>
                  <dl>
                    <div>
                      <dt>Temperature</dt>
                      <dd>{crop.temperature_score}</dd>
                    </div>
                    <div>
                      <dt>Water</dt>
                      <dd>{crop.water_score}</dd>
                    </div>
                    <div>
                      <dt>Climate safety</dt>
                      <dd>{crop.climate_safety_score}</dd>
                    </div>
                  </dl>
                  {/* Task 5.2: Add to plan button */}
                  <Dialog
                    open={
                      addToPlanOpen &&
                      addToPlanCrop?.name === crop.crop &&
                      addToPlanCrop?.monthNumber === plan.data.selected_month.month_number
                    }
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
                    {addToPlanCrop?.name === crop.crop &&
                      addToPlanCrop?.monthNumber === plan.data.selected_month.month_number && (
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
                  {plan.data.comparison.map((item) => (
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
          </section>

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
