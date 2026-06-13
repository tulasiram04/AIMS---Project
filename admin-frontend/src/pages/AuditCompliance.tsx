import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, ScrollText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../services/adminApi';
import { type AuditLog } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const TT = { backgroundColor:'#0D1526',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',color:'#E2E8F0' };

const ACTION_COLORS: Record<string, string> = {
  RECONCILIATION_COMPLETED: 'badge-green',
  REPORT_GENERATED:         'badge-blue',
  USER_CREATED:             'badge-purple',
  USER_UPDATED:             'badge-amber',
  USER_DELETED:             'badge-red',
  PASSWORD_RESET:           'badge-amber',
  STATUS_CHANGE:            'badge-amber',
  UPLOAD_INVENTORY:         'badge-blue',
  UPLOAD_LIVE_INVENTORY:    'badge-blue',
  CHATBOT_QUERY:            'badge-purple',
  GENERATE_REPORT:          'badge-green',
};

export default function AuditCompliance() {
  const [logs, setLogs]           = useState<AuditLog[]>([]);
  const [total, setTotal]         = useState(0);
  const [dist, setDist]           = useState<{ action: string; count: number }[]>([]);
  const [page, setPage]           = useState(1);
  const [action, setAction]       = useState('');
  const [days, setDays]           = useState(30);
  const [loading, setLoading]     = useState(true);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getAuditLogs({ page, limit, action: action || undefined, days });
      setLogs(r.data.logs);
      setTotal(r.data.total);
      setDist(r.data.action_distribution ?? []);
    } finally { setLoading(false); }
  }, [page, action, days]);

  useEffect(() => { load(); }, [load]);

  const actions = [
    'RECONCILIATION_COMPLETED','REPORT_GENERATED','USER_CREATED','USER_UPDATED',
    'USER_DELETED','PASSWORD_RESET','STATUS_CHANGE','UPLOAD_INVENTORY',
    'UPLOAD_LIVE_INVENTORY','CHATBOT_QUERY','GENERATE_REPORT',
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit & Compliance Center</h1>
          <p className="page-subtitle">{total.toLocaleString()} audit entries in selected period</p>
        </div>
      </div>

      {/* Action distribution chart */}
      {dist.length > 0 && (
        <div className="chart-container">
          <p className="chart-title">Action Distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dist}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="action" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4,4,0,0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="admin-select w-52">
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(1); }} className="admin-select w-36">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>#</th><th>User</th><th>Action</th><th>Details</th><th>Timestamp</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono text-slate-600 text-xs">#{log.id}</td>
                    <td className="font-medium text-white">{log.username}</td>
                    <td><span className={ACTION_COLORS[log.action] ?? 'badge-blue'} style={{ fontSize: 10 }}>{log.action.replace(/_/g, ' ')}</span></td>
                    <td className="text-slate-400 max-w-xs truncate text-xs">{log.details || '—'}</td>
                    <td className="text-slate-500 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-12"><ScrollText size={32} className="mx-auto mb-2 text-slate-700" />No audit logs found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {Math.ceil(total / limit) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">Page {page} of {Math.ceil(total / limit)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
