// ── Core types matching backend API responses ─────────────────────────────

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  is_active: boolean;
  total_logins: number;
  created_at: string | null;
  last_login: string | null;
  last_activity: string | null;
  stats?: {
    uploads: number;
    reconciliations: number;
    reports: number;
    chatbot_queries: number;
  };
}

export interface DashboardData {
  users: {
    total: number; active: number; disabled: number;
    online: number; new_today: number; new_this_month: number;
  };
  inventory:       { total_uploads: number; total_assets: number };
  reconciliations: { total: number; completed: number; failed: number; success_rate: number };
  reports:         { total: number };
  audit:           { total: number };
  ai:              { total_requests: number; chatbot_queries: number };
  api:             { total_requests: number };
  database:        { size_mb: number };
  trends: {
    user_growth:   TrendPoint[];
    upload_trend:  TrendPoint[];
    recon_trend:   TrendPoint[];
    report_trend:  TrendPoint[];
    ai_trend:      TrendPoint[];
    api_trend:     TrendPoint[];
  };
}

export interface TrendPoint { date: string; count: number }

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface Asset {
  id: number;
  asset_id: string;
  asset_name: string;
  asset_type: string;
  location: string;
  status: string;
  created_at: string | null;
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
  started_at: string | null;
  completed_at: string | null;
}

export interface Report {
  id: number;
  report_type: string;
  file_path: string;
  generated_at: string | null;
  reconciliation_id: number;
  generated_by_id: number;
}

export interface GeminiAnalytics {
  summary: {
    total_requests: number; successful: number; failed: number;
    avg_response_ms: number; estimated_tokens: number; estimated_cost_usd: number;
  };
  daily_trend:       TrendPoint[];
  top_users:         { user_id: number; username: string; count: number }[];
  type_distribution: { type: string; count: number }[];
}

export interface APIAnalytics {
  summary: {
    total_requests: number; error_requests: number;
    error_rate: number; avg_response_ms: number;
  };
  top_endpoints:      { endpoint: string; count: number; avg_ms: number }[];
  status_distribution:{ code: number; count: number }[];
  daily_trend:        TrendPoint[];
}

export interface DBHealth {
  database_type: string;
  version: string;
  size_mb: number;
  table_stats: { table: string; row_count: number }[];
  total_records: number;
  status: string;
}

export interface SystemHealth {
  services: { name: string; status: string; details: string }[];
  metrics:  { active_sessions: number; total_users: number; total_audit_logs: number };
}

export interface SecurityData {
  security_score: number;
  summary: {
    password_resets: number; account_changes: number;
    disabled_accounts: number; user_deletions: number;
    auth_errors: number; total_api_requests: number;
  };
  recent_events: { id: number; action: string; username: string; details: string | null; created_at: string }[];
}

export interface BusinessIntelligence {
  kpis: { most_active_user: string; most_active_count: number; most_used_feature: string };
  feature_adoption:  { feature: string; count: number }[];
  platform_growth:   { week: string; activities: number }[];
  top_report_types:  { type: string; count: number }[];
}
