/**
 * TypeScript types for Spreadsheets, CSV Mapping, and Groups.
 */

export type SpreadsheetType = "participants" | "attendance";

export interface Spreadsheet {
  id: number;
  name: string;
  filename: string;
  spreadsheet_type: SpreadsheetType;
  handle_column: string;
  phone_column: string;
  columns: string[];
  row_count: number;
  created_at: string | null;
  group_count: number;
}

export interface SpreadsheetData extends Spreadsheet {
  rows: Record<string, any>[];
}

export interface CSVPreviewResponse {
  filename: string;
  columns: string[];
  suggested_handle_column: string | null;
  suggested_phone_column: string | null;
  sample_rows: Record<string, any>[];
  total_rows: number;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  default_participants: string[];
  spreadsheet_id: number | null;
  spreadsheet?: Spreadsheet | null;
  attendance_spreadsheets?: Spreadsheet[];
  created_at: string | null;
  contest_count: number;
}

export interface GroupCreatePayload {
  name: string;
  description?: string;
  default_participants?: string[];
  spreadsheet_id?: number | null;
}

export interface GroupUpdatePayload {
  name?: string;
  description?: string;
  default_participants?: string[];
  spreadsheet_id?: number | null;
  attendance_spreadsheet_ids?: number[];
}

export interface ApplyParticipantsResponse {
  success: boolean;
  contests_updated: number;
  participants_applied: number;
}
