import { useEffect, useState, useCallback } from 'react';
import { Search, Package, Trash2, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../services/adminApi';
import { type Asset } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899'];
const TT = { backgroundColor:'#0D1526',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',color:'#E2E8F0' };

export default function InventoryGovernance() {
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [total, setTotal]     = useState(0);
  const [types, setTypes]     = useState<{ type: string; count: number }[]>([]);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getAssets({ page, limit: 20, search: search || undefined });
      setAssets(r.data.assets);
      setTotal(r.data.total);
      setTypes(r.data.type_breakdown ?? []);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete asset "${name}"?`)) return;
    await adminApi.deleteAsset(id);
    setMsg(`Asset deleted`); load();
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Governance</h1>
          <p className="page-subtitle">{total.toLocaleString()} total assets across all uploads</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} />Refresh</button>
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Asset Type Pie */}
        <div className="chart-container">
          <p className="chart-title">Asset Type Distribution</p>
          {types.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={types} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={75}>
                  {types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-500 text-sm py-12 text-center">No assets yet</p>}
          <div className="mt-3 space-y-1.5">
            {types.slice(0, 6).map((t, i) => (
              <div key={t.type} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-slate-400 flex-1 truncate">{t.type || 'Unknown'}</span>
                <span className="text-white font-medium">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assets Table */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="admin-input pl-9 w-full" placeholder="Search assets…" />
            </div>
          </div>
          {loading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Asset ID</th><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs text-slate-400">{a.asset_id}</td>
                      <td className="font-medium text-white">{a.asset_name || '—'}</td>
                      <td><span className="badge-blue">{a.asset_type || 'Unknown'}</span></td>
                      <td className="text-slate-400 text-xs">{a.location || '—'}</td>
                      <td>{a.status === 'active' ? <span className="badge-green">Active</span> : <span className="badge-amber">{a.status}</span>}</td>
                      <td>
                        <button className="btn-ghost text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(a.id, a.asset_name)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {assets.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-12"><Package size={32} className="mx-auto mb-2 text-slate-700" />No assets found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {Math.ceil(total / 20) > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <p className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))} disabled={page >= Math.ceil(total / 20)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
