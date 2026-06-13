import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock, Zap } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminApi } from '../services/adminApi';
import { type APIAnalytics } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';

const TT = { backgroundColor:'#0D1526',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',color:'#E2E8F0' };

export default function APIMonitoring() {
  const [data, setData]     = useState<APIAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]     = useState(7);

  useEffect(() => {
    setLoading(true);
    adminApi.getApiAnalytics(days).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingSpinner text="Loading API analytics…" />;
  if (!data) return <p className="text-slate-400">No data</p>;
  const s = data.summary;

  const statusColors: Record<number, string> = { 200: '#10B981', 201: '#10B981', 400: '#F59E0B', 401: '#EF4444', 403: '#EF4444', 404: '#F59E0B', 500: '#EF4444' };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">API Monitoring Center</h1>
          <p className="page-subtitle">Request tracking, error rates, and performance</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="admin-select w-36">
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Requests"   value={s.total_requests.toLocaleString()} icon={Activity}      color="blue"  />
        <KPICard title="Error Requests"   value={s.error_requests.toLocaleString()} icon={AlertTriangle}  color="red"   />
        <KPICard title="Error Rate"       value={`${s.error_rate}%`}               icon={AlertTriangle}  color="amber" />
        <KPICard title="Avg Response"     value={`${s.avg_response_ms}ms`}          icon={Clock}          color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="chart-container">
          <p className="chart-title">Request Volume Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.daily_trend}>
              <defs>
                <linearGradient id="apiG2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="count" stroke="#F59E0B" fill="url(#apiG2)" strokeWidth={2} dot={false} name="Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <p className="chart-title">Status Code Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.status_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="code" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="count" radius={[4,4,0,0]} name="Requests">
                {data.status_distribution.map((entry) => (
                  <Cell key={entry.code} fill={statusColors[entry.code] ?? '#64748B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Endpoints Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Top Endpoints</p>
        </div>
        <table className="admin-table">
          <thead><tr><th>Rank</th><th>Endpoint</th><th>Requests</th><th>Avg Response</th><th>Load</th></tr></thead>
          <tbody>
            {data.top_endpoints.map((e, i) => {
              const max = data.top_endpoints[0]?.count || 1;
              const perfColor = e.avg_ms < 200 ? 'text-emerald-400' : e.avg_ms < 500 ? 'text-amber-400' : 'text-red-400';
              return (
                <tr key={e.endpoint}>
                  <td className="text-slate-500">#{i + 1}</td>
                  <td className="font-mono text-xs text-blue-300">{e.endpoint}</td>
                  <td className="text-white font-medium">{e.count.toLocaleString()}</td>
                  <td className={`font-mono text-xs ${perfColor}`}>{e.avg_ms}ms</td>
                  <td>
                    <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${(e.count / max) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.top_endpoints.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No API request data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
