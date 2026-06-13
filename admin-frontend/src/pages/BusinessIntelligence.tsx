import { useEffect, useState } from 'react';
import { TrendingUp, Star, Zap, BarChart3, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { adminApi } from '../services/adminApi';
import { type BusinessIntelligence } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899'];
const TT = { backgroundColor:'#0D1526',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',color:'#E2E8F0' };

export default function BusinessIntelligencePage() {
  const [data, setData]     = useState<BusinessIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getBusinessIntelligence().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading business intelligence…" />;
  if (!data)   return <p className="text-slate-400">No data</p>;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Intelligence Center</h1>
          <p className="page-subtitle">Platform growth, feature adoption, and engagement analytics</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Most Active User"
          value={data.kpis.most_active_user}
          icon={Star}
          color="amber"
          subtitle={`${data.kpis.most_active_count.toLocaleString()} platform actions`}
        />
        <KPICard
          title="Most Used Feature"
          value={data.kpis.most_used_feature.replace(/_/g, ' ')}
          icon={Zap}
          color="purple"
        />
        <KPICard
          title="Feature Coverage"
          value={`${data.feature_adoption.length} features`}
          icon={BarChart3}
          color="green"
          subtitle="Actively used across the platform"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform Growth */}
        <div className="chart-container">
          <p className="chart-title">Platform Growth (Weekly Activity — 12 weeks)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.platform_growth}>
              <defs>
                <linearGradient id="pgG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Area
                type="monotone" dataKey="activities"
                stroke="#3B82F6" fill="url(#pgG)" strokeWidth={2} dot={false} name="Activity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Adoption Pie */}
        <div className="chart-container">
          <p className="chart-title">Feature Usage Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.feature_adoption.slice(0, 7)}
                dataKey="count" nameKey="feature"
                cx="50%" cy="50%" outerRadius={85}
                label={({ feature, percent }) =>
                  `${(feature as string).replace(/_/g,' ').slice(0,12)} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.feature_adoption.slice(0, 7).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TT} formatter={(v: number, n: string) => [v, n.replace(/_/g,' ')]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Adoption Bar */}
      <div className="chart-container">
        <p className="chart-title">Feature Adoption — All Actions Ranked</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.feature_adoption.map(f => ({ ...f, feature: f.feature.replace(/_/g,' ') }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="feature" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} angle={-20} textAnchor="end" height={45} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TT} />
            <Bar dataKey="count" radius={[4,4,0,0]} name="Usage Count">
              {data.feature_adoption.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Report Types & Feature Adoption Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white">Top Report Types</p>
          </div>
          <table className="admin-table">
            <thead><tr><th>Report Type</th><th>Count</th><th>Share</th></tr></thead>
            <tbody>
              {data.top_report_types.length > 0 ? data.top_report_types.map((r, i) => {
                const max = data.top_report_types[0]?.count || 1;
                return (
                  <tr key={r.type}>
                    <td className="font-medium text-white">{r.type}</td>
                    <td className="text-blue-400 font-mono">{r.count}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${(r.count/max)*100}%`, background: COLORS[i%COLORS.length] }} />
                        </div>
                        <span className="text-xs text-slate-500">{((r.count/max)*100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={3} className="text-center text-slate-500 py-8">No reports generated yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white">Feature Adoption Ranking</p>
          </div>
          <table className="admin-table">
            <thead><tr><th>Rank</th><th>Feature</th><th>Usages</th></tr></thead>
            <tbody>
              {data.feature_adoption.map((f, i) => (
                <tr key={f.feature}>
                  <td>
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold
                      ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-500/20 text-slate-400' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'text-slate-600'}`}>
                      {i+1}
                    </span>
                  </td>
                  <td className="text-slate-300 text-xs">{f.feature.replace(/_/g,' ')}</td>
                  <td className="text-white font-medium tabular-nums">{f.count.toLocaleString()}</td>
                </tr>
              ))}
              {data.feature_adoption.length === 0 && (
                <tr><td colSpan={3} className="text-center text-slate-500 py-8">No activity data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
