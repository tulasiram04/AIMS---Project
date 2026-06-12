export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface UserCreate {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role: string;
}

export interface Upload {
  id: number;
  filename: string;
  upload_type: string;
  total_records: number;
  upload_date: string;
}

export interface Discrepancy {
  id: number;
  discrepancy_type: string;
  csv_asset_id: string | null;
  json_asset_id: string | null;
  severity: string | null;
  details: string | null;
  root_cause: string | null;
  recommended_action: string | null;
  csv_data: Record<string, unknown> | null;
  json_data: Record<string, unknown> | null;
}

export interface Reconciliation {
  id: number;
  status: string;
  total_csv_assets: number;
  total_json_assets: number;
  missing_assets_count: number;
  untracked_assets_count: number;
  config_mismatch_count: number;
  naming_mismatch_count: number;
  ai_analysis: string | null;
  recommendations: { recommendations: Array<{ text: string }> } | null;
  executive_summary: string | null;
  csv_filename?: string;
  json_filename?: string;
  started_at: string | null;
  completed_at: string | null;
  discrepancies: Discrepancy[];
}

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  details: string | null;
  created_at: string | null;
}

export interface Report {
  id: number;
  reconciliation_id: number;
  report_type: string;
  executive_summary: string | null;
  generated_at: string | null;
}

export interface ChatbotResponse {
  query: string;
  response: string;
  sources: string[];
}

export type UserRole = 'Administrator' | 'Auditor' | 'Analyst' | 'Viewer';

export const ROLE_LABELS: Record<string, string> = {
  Administrator: 'Administrator',
  Auditor: 'Auditor',
  Analyst: 'Analyst',
  Viewer: 'Viewer',
};
