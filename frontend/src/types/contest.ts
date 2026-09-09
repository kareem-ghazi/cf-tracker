/** TypeScript types for Contest management domain. */

export interface ContestResponse {
  id: number;
  group_id: number;
  cf_contest_id: number;
  name: string;
  min_solved: number;
  min_solved_is_percent: boolean;
  total_problems: number;
  required_solved: number;
  participants: string[];
  lock_participants: boolean;
  start_date: string | null;
  last_refreshed: string | null;
  created_at: string | null;
  result_count: number;
}

export interface CachedResultResponse {
  id: number;
  contest_id: number;
  handle: string;
  solved_count: number;
  passed: boolean;
  participated: boolean;
  rank: number;
  cached_at: string | null;
}

export interface ContestResultsResponse {
  contest: ContestResponse;
  total: number;
  passed: number;
  failed: number;
  not_participated: number;
  results: CachedResultResponse[];
}

export interface ContestStandingsResponse {
  contest: ContestResponse;
  standings: CachedResultResponse[];
  summary: {
    total: number;
    participated: number;
    not_participated: number;
  };
}

export interface FetchHistoryResponse {
  id: number;
  contest_id: number;
  fetch_date: string;
  passed_count: number;
  failed_count: number;
  not_participated_count: number;
  total_count: number;
}

export interface TaskDispatchResponse {
  status: string;
  task_id: string;
  message: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";
  progress?: number;
  message?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ContestCreatePayload {
  group_id: number;
  cf_contest_id: number;
  name?: string;
  min_solved?: number;
  min_solved_is_percent?: boolean;
  participants?: string[];
  lock_participants?: boolean;
}

export interface BatchContestCreatePayload {
  group_id: number;
  contest_ids: number[];
  min_solved?: number;
  min_solved_is_percent?: boolean;
}

export type ResultStatusFilter =
  | "all"
  | "passed"
  | "failed"
  | "participated"
  | "not_participated";
