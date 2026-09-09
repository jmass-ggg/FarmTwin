import { FarmTwinApiError, requestApi } from './client';
import type { ApiErrorDetail } from './types';

// ---------------------------------------------------------------------------
// Planner types
// ---------------------------------------------------------------------------

export interface PlanEntryResponse {
  id: string;
  farm_id: string;
  crop_name: string;
  planting_date: string;
  harvest_date: string;
  cultivation_mode: 'rain_fed' | 'irrigated';
  irrigation_mm: number | null;
  area_ha: number;
  snapshot_id: string | null;
  data_mode: string;
  suitability_index: number;
  engine_version: string;
  created_at: string;
  updated_at: string | null;
}

export interface MonthRecommendation {
  crop_name: string;
  suitability_index: number;
  label: string;
  limiting_factor: string;
}

export interface MonthRecommendationResponse {
  month: number;
  month_name: string;
  data_mode: string;
  snapshot_id: string | null;
  recommendations: MonthRecommendation[];
}

export interface ChangeProposalResponse {
  id: string;
  farm_id: string;
  entry_id: string;
  old_suitability_index: number;
  new_suitability_index: number;
  changed_inputs: Record<string, { old: unknown; new: unknown }>;
  new_snapshot_id: string;
  issue_date: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
}

export interface AnnualPlanResponse {
  farm_id: string;
  year: number;
  months: MonthRecommendationResponse[];
  entries: PlanEntryResponse[];
  proposals: ChangeProposalResponse[];
}

export interface PlanEntryCreate {
  crop_name: string;
  planting_date: string;
  cultivation_mode: 'rain_fed' | 'irrigated';
  irrigation_mm?: number;
  area_ha: number;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class PlannerApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'PlannerApiError';
  }
}

export class PlannerConflictError extends PlannerApiError {
  constructor(
    message: string,
    public readonly details: ApiErrorDetail[],
    requestId?: string,
  ) {
    super(message, 422, requestId);
    this.name = 'PlannerConflictError';
  }
}

function mapPlannerError(error: unknown): never {
  if (!(error instanceof FarmTwinApiError)) throw error;
  if (error.status === 422) {
    throw new PlannerConflictError(error.message, error.details, error.requestId);
  }
  throw new PlannerApiError(error.message, error.status, error.requestId);
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getAnnualPlan(
  farmId: string,
  year: number,
  signal?: AbortSignal,
): Promise<AnnualPlanResponse> {
  try {
    return (
      await requestApi<AnnualPlanResponse>(
        `/api/v1/farms/${encodeURIComponent(farmId)}/crop-plan?year=${year}`,
        { signal },
      )
    ).data;
  } catch (error) {
    return mapPlannerError(error);
  }
}

export async function createPlanEntry(
  farmId: string,
  data: PlanEntryCreate,
): Promise<PlanEntryResponse> {
  try {
    return (
      await requestApi<PlanEntryResponse>(
        `/api/v1/farms/${encodeURIComponent(farmId)}/crop-plan/entries`,
        { method: 'POST', body: JSON.stringify(data) },
      )
    ).data;
  } catch (error) {
    return mapPlannerError(error);
  }
}

export async function deletePlanEntry(
  farmId: string,
  entryId: string,
): Promise<void> {
  try {
    await requestApi<void>(
      `/api/v1/farms/${encodeURIComponent(farmId)}/crop-plan/entries/${encodeURIComponent(entryId)}`,
      { method: 'DELETE' },
    );
  } catch (error) {
    return mapPlannerError(error);
  }
}

export async function acceptChangeProposal(
  farmId: string,
  proposalId: string,
): Promise<PlanEntryResponse> {
  try {
    return (
      await requestApi<PlanEntryResponse>(
        `/api/v1/farms/${encodeURIComponent(farmId)}/crop-plan/proposals/${encodeURIComponent(proposalId)}/accept`,
        { method: 'POST' },
      )
    ).data;
  } catch (error) {
    return mapPlannerError(error);
  }
}

export async function dismissChangeProposal(
  farmId: string,
  proposalId: string,
): Promise<void> {
  try {
    await requestApi<void>(
      `/api/v1/farms/${encodeURIComponent(farmId)}/crop-plan/proposals/${encodeURIComponent(proposalId)}/dismiss`,
      { method: 'POST' },
    );
  } catch (error) {
    return mapPlannerError(error);
  }
}
