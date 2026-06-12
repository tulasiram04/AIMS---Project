import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auditAPI, usersAPI } from '../services/api';
import { AuditLog } from '../types';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  LogIn,
  FileSpreadsheet,
  Braces,
  GitCompareArrows,
  FileText,
  Bot,
  UserPlus,
  UserMinus,
  Pin,
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  Lock,
  Activity
} from 'lucide-react';

const ACTION_ICON_MAP: Record<string, React.ElementType> = {
  LOGIN:                    LogIn,
  UPLOAD_INVENTORY:         FileSpreadsheet,
  UPLOAD_LIVE_INVENTORY:    Braces,
  RUN_RECONCILIATION:       GitCompareArrows,
  RECONCILIATION_COMPLETED: GitCompareArrows,
  GENERATE_REPORT:          FileText,
  REPORT_GENERATED:         FileText,
  CHATBOT_QUERY:            Bot,
  CREATE_USER:              UserPlus,
  USER_CREATED:             UserPlus,
  DELETE_USER:              UserMinus,
  USER_DELETED:             UserMinus,
  USER_UPDATED:             Sliders,
  PASSWORD_RESET:           Lock,
  STATUS_CHANGE:            Activity,
};

const ACTION_COLOR_MAP: Record<string, string> = {
  LOGIN:                    'bg-blue-50 text-blue-600',
  UPLOAD_INVENTORY:         'bg-indigo-50 text-indigo-600',
  UPLOAD_LIVE_INVENTORY:    'bg-cyan-50 text-cyan-600',
  RUN_RECONCILIATION:       'bg-purple-50 text-purple-600',
  RECONCILIATION_COMPLETED: 'bg-purple-50 text-purple-600',
  GENERATE_REPORT:          'bg-amber-50 text-amber-600',
  REPORT_GENERATED:         'bg-amber-50 text-amber-600',
  CHATBOT_QUERY:            'bg-emerald-50 text-emerald-600',
  CREATE_USER:              'bg-green-50 text-green-600',
  USER_CREATED:             'bg-green-50 text-green-600',
  DELETE_USER:              'bg-red-50 text-red-600',
  USER_DELETED:             'bg-red-50 text-red-600',
  USER_UPDATED:             'bg-blue-50 text-blue-600',
  PASSWORD_RESET:           'bg-orange-50 text-orange-600',
  STATUS_CHANGE:            'bg-teal-50 text-teal-600',
};

const actionLabels: Record<string, string> = {
  LOGIN:                    'User Login',
  UPLOAD_INVENTORY:         'CSV Upload',
  UPLOAD_LIVE_INVENTORY:    'JSON Upload',
  RUN_RECONCILIATION:       'Reconciliation',
  RECONCILIATION_COMPLETED: 'Reconciliation Run Completed',
  GENERATE_REPORT:          'Report Generated',
  REPORT_GENERATED:         'Executive Report Generated',
  CHATBOT_QUERY:            'Chatbot Query',
  CREATE_USER:              'User Created',
  USER_CREATED:             'IAM User Account Created',
  DELETE_USER:              'User Deleted',
  USER_DELETED:             'IAM User Account Deleted',
  USER_UPDATED:             'IAM User Account Updated',
  PASSWORD_RESET:           'Password Reset Override',
  STATUS_CHANGE:            'Profile Status Changed',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [userFilter, setUserFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  
  const [users, setUsers] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, limit, userFilter, categoryFilter]);

  const loadUsers = async () => {
    try {
      const res = await usersAPI.list({ limit: 100 });
      setUsers(res.data?.users || []);
    } catch (err) {
      console.warn('Failed to load user list for logs filtering:', err);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.getLogs({
        skip: (page - 1) * limit,
        limit: limit,
        user_id: userFilter !== '' ? userFilter : undefined,
        action_category: categoryFilter !== '' ? categoryFilter : undefined,
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side text search across retrieved records
  const filteredLogs = logs.filter(log => {
    const term = searchText.trim().toLowerCase();
    if (term === '') return true;
    return (
      log.username.toLowerCase().includes(term) ||
      (log.details || '').toLowerCase().includes(term) ||
      (actionLabels[log.action] || log.action).toLowerCase().includes(term)
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto pb-12 font-sans"
    >
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Governance Activity Tracker</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Audit and search enterprise user configuration changes, logons, and reconciliation compliance events.
        </p>
      </div>

      {/* FILTER PANEL */}
      <div className="p-4 bg-white border border-[#E2E8F0] rounded-[24px] shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search logs by keyword, username, or details..."
            className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="select-field text-xs py-2 px-3 border border-gray-200 rounded-xl bg-white w-full sm:w-36 font-semibold"
          >
            <option value="">All Categories</option>
            <option value="Reconciliation">Reconciliation</option>
            <option value="Reports">Reports</option>
            <option value="User Management">User Management</option>
          </select>

          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
            className="select-field text-xs py-2 px-3 border border-gray-200 rounded-xl bg-white w-full sm:w-40 font-semibold"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} (@{u.username})
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="select-field text-xs py-2 px-3 border border-gray-200 rounded-xl bg-white w-full sm:w-20 font-semibold"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12">
          <LoadingSpinner message="Fetching activity logs..." />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card p-12 text-center border border-[#E2E8F0] rounded-[24px] bg-white">
          <div className="flex justify-center mb-3">
            <ScrollText size={36} className="text-gray-300" />
          </div>
          <p className="text-xs text-gray-500 font-bold">No governance events logged matching criteria.</p>
        </div>
      ) : (
        <div className="card overflow-hidden border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                  <th className="px-4 py-3 w-12"></th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3">Initiated By</th>
                  <th className="px-4 py-3">Event Details</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Redirection Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => {
                  const IconComponent = ACTION_ICON_MAP[log.action] ?? Pin;
                  const colorClass = ACTION_COLOR_MAP[log.action] ?? 'bg-gray-50 text-gray-500';
                  
                  // Parse deep link identifiers from event details
                  let reportIdLink: number | null = null;
                  let reconIdLink: number | null = null;

                  if (log.action === 'REPORT_GENERATED') {
                    const match = log.details?.match(/Report #(\d+) Generated/);
                    if (match) reportIdLink = Number(match[1]);
                  } else if (log.action === 'RECONCILIATION_COMPLETED') {
                    const match = log.details?.match(/Reconciliation #(\d+) Completed/);
                    if (match) reconIdLink = Number(match[1]);
                  }

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-gray-600"
                    >
                      <td className="px-4 py-3.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <IconComponent size={14} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-[#0F172A]">
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold">
                        {log.username}
                      </td>
                      <td className="px-4 py-3.5 font-semibold max-w-xs truncate" title={log.details || ''}>
                        {log.details || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[10px]">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        {reportIdLink !== null && (
                          <button
                            onClick={() => navigate(`/reports?previewReportId=${reportIdLink}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-[#10B981] hover:bg-[#0D9488] rounded-xl active:scale-95 transition-all shadow-sm"
                          >
                            <Eye size={11} />
                            Preview Report
                          </button>
                        )}
                        {reconIdLink !== null && (
                          <button
                            onClick={() => navigate(`/reports?previewReconId=${reconIdLink}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl active:scale-95 transition-all shadow-sm"
                          >
                            <Eye size={11} />
                            View Run Report
                          </button>
                        )}
                        {reportIdLink === null && reconIdLink === null && (
                          <span className="text-gray-400 font-medium italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
            <span>
              Showing Page {page} (limit: {limit} logs per offset)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < limit}
                className="p-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
