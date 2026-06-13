import { useEffect, useState } from 'react';
import { Database, HardDrive, Table2, Hash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../services/adminApi';
import { type DBHealth } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';

const TT = { backgroundColor:'#0D1526',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',color:'#E2E8F0' };

export default function DatabaseOps() {
  const [data, setData]     = useState<DBHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDatabaseHealth().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading database health…" />;
  if (!data) return <p className="text-slate-400">No data</p>;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Database Operations Center</h1>
          <p className="page-subtitle">{data.database_type} · Read-only health analytics</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${data.status === 'healthy' ? 'badge-green' : 'badge-red'}`}>
          {data.status === 'healthy' ? '● Healthy' : '● Degraded'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Database Type"    value={data.database_type}              icon={Database}  color="blue"   />
        <KPICard title="Database Size"    value={`${data.size_mb} MB`}            icon={HardDrive} color="purple" />
        <KPICard title="Total Tables"     value={data.table_stats.length}         icon={Table2}    color="green"  />
        <KPICard title="Total Records"    value={data.total_records.toLocaleString()} icon={Hash}   color="amber"  />
      </div>

      {/* Version info */}
      <div className="glass-card p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Database Version</p>
        <p className="text-sm font-mono text-slate-300">{data.version}</p>
      </div>

      {/* Table stats chart */}
      <div className="chart-container">
        <p className="chart-title">Table Row Counts</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.table_stats} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="table" tick={{ fill: '#94A3B8', fontSize: 11 }} width={130} tickLine={false} />
            <Tooltip contentStyle={TT} />
            <Bar dataKey="row_count" fill="#3B82F6" radius={[0,4,4,0]} name="Rows" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table stats detail */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Table Statistics</p>
          <p className="text-xs text-slate-500 mt-0.5">Read-only — no modification or deletion available</p>
        </div>
        <table className="admin-table">
          <thead><tr><th>Table</th><th>Row Count</th><th>Share</th></tr></thead>
          <tbody>
            {data.table_stats.sort((a, b) => b.row_count - a.row_count).map(t => {
              const max = Math.max(...data.table_stats.map(x => x.row_count), 1);
              return (
                <tr key={t.table}>
                  <td className="font-mono text-blue-300 text-sm">{t.table}</td>
                  <td className="text-white font-medium tabular-nums">{t.row_count.toLocaleString()}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(t.row_count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-10 text-right">{((t.row_count / max) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Safety notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-400">
          ⚠️ <strong>Database Operations Center</strong> is intentionally read-only.
          SQL execution, table truncation, and schema changes are not exposed here for safety.
          Use database migration tools (Alembic) or a trusted DBA for schema modifications.
        </p>
      </div>
    </div>
  );
}
