import { useEffect, useState, useCallback } from 'react';
import { Trash2, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { type Reconciliation } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import { GitMerge, AlertTriangle } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'badge-green', FAILED: 'badge-red',
    IN_PROGRESS: 'badge-blue', PENDING: 'badge-amber',
  };
  return <span className={map[status] ?? 'badge-blue'}>{status}</span>;
}

export default function ReconciliationOps() {
  const [recons, setRecons] = useState<Reconciliation[]>([]);
  const [total, setTotal]   = useState(0);
  const [summary, setSummary] = useState<{ total_discrepancies: number; avg_processing_seconds: number | null }>({ total_discrepancies: 0, avg_processing_seconds: null });
  const [status, setStatus] = useState('');
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]       = useState('');
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getReconciliations({ page, limit, status: status || undefined });
      setRecons(r.data.reconciliations);
      setTotal(r.data.total);
      setSummary(r.data.summary);
    } finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const completed = recons.filter(r => r.status === 'COMPLETED').length;
  const failed    = recons.filter(r => r.status === 'FAILED').length;

  async function handleDelete(id: number) {
    if (!confirm('Delete this reconciliation run and all its discrepancies?')) return;
    await adminApi.deleteReconciliation(id);
    setMsg('Reconciliation deleted'); load();
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reconciliation Operations</h1>
          <p className="page-subtitle">{total} total reconciliation runs</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} />Refresh</button>
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">{msg}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Runs"         value={total}                                          icon={GitMerge}    color="blue" />
        <KPICard title="Completed"          value={completed}                                      icon={CheckCircle2} color="green" />
        <KPICard title="Failed"             value={failed}                                         icon={XCircle}     color="red" />
        <KPICard title="Total Discrepancies" value={summary.total_discrepancies}                   icon={AlertTriangle} color="amber" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="admin-select w-40">
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>
        </div>
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th><th>Status</th><th>CSV Assets</th><th>JSON Assets</th>
                  <th>Missing</th><th>Untracked</th><th>Config Drift</th><th>Started</th><th></th>
                </tr>
              </thead>
              <tbody>
                {recons.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-slate-500">#{r.id}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-slate-300">{r.total_csv_assets}</td>
                    <td className="text-slate-300">{r.total_json_assets}</td>
                    <td className="text-red-400">{r.missing_assets_count}</td>
                    <td className="text-amber-400">{r.untracked_assets_count}</td>
                    <td className="text-orange-400">{r.config_mismatch_count}</td>
                    <td className="text-slate-500 text-xs">{r.started_at ? new Date(r.started_at).toLocaleString() : '—'}</td>
                    <td>
                      <button className="btn-ghost text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {recons.length === 0 && <tr><td colSpan={9} className="text-center text-slate-500 py-12">No reconciliations found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {Math.ceil(total / limit) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">Page {page} of {Math.ceil(total / limit)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))} disabled={page >= Math.ceil(total / limit)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
