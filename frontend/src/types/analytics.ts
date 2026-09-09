/**
 * TypeScript types for Dashboard Analytics.
 */

export interface DashboardSummary {
  total_groups: number;
  total_contests: number;
  total_participants: number;
  total_results: number;
  overall_pass_rate: number;
}

export interface GroupAnalyticsCard {
  id: number;
  name: string;
  description: string;
  contest_count: number;
  participant_count: number;
  pass_rate: number;
  passed_count: number;
  total_results: number;
  created_at: string | null;
}

export interface AnalyticsResponse {
  summary: DashboardSummary;
  groups: GroupAnalyticsCard[];
}
