export interface ContestHeader {
  id: number;
  cf_contest_id: number;
  name: string;
  total_problems: number;
  min_solved: number;
  min_solved_is_percent: boolean;
  required_solved: number;
}

export interface ContestResultCellData {
  solved_count: number;
  passed: boolean;
  participated: boolean;
  rank: number;
}

export interface ParticipantMatrixRow {
  handle: string;
  results: Record<string, ContestResultCellData>;
  in_spreadsheet: boolean;
  attendance: number;
  total_attendance_sheets: number;
  total_passes: number;
  total_solved: number;
  points: number;
}

export interface OverviewData {
  group: {
    id: number;
    name: string;
    description?: string;
    spreadsheet_id?: number | null;
  };
  contests: ContestHeader[];
  participants: ParticipantMatrixRow[];
  total_attendance_sheets: number;
}
