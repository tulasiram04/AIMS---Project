import { useEffect, useState } from 'react';
import { BrainCircuit, Zap, CheckCircle2, XCircle, Clock, DollarSign } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../services/adminApi';
import { type GeminiAnalytics } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444'];
const TT = { backgroundColor:'#0D1526',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',color:'#E2E8F0' };

export default function AIOperations() {
  const [data, setData] = useState<GeminiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    adminApi.getGeminiAnalytics(days).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingSpinner text="Loading AI analytics…" />;
  if (!data) return <p className="text-slate-400">No data</p>;
  const s = data.summary;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI / Gemini Operations Center</h1>
          <p className="page-subtitle">Gemini 2.5 Flash usage analytics and cost tracking</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="admin-select w-36">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total AI Requests"   value={s.total_requests}       icon={BrainCircuit} color="purple" delay={0} />
        <KPICard title="Successful"          value={s.successful}           icon={CheckCircle2} color="green"  delay={0.05} />
        <KPICard title="Failed"              value={s.failed}               icon={XCircle}      color="red"    delay={0.1} />
        <KPICard title="Avg Response"        value={`${s.avg_response_ms}ms`} icon={Clock}      color="amber"  delay={0.15} />
        <KPICard title="Est. Tokens"         value={s.estimated_tokens.toLocaleString()} icon={Zap} color="cyan" delay={0.2} />
        <KPICard title="Est. Cost (USD)"     value={`$${s.estimated_cost_usd}`} icon={DollarSign} color="green" delay={0.25} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="chart-container">
          <p className="chart-title">AI Request Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.daily_trend}>
              <defs>
                <linearGradient id="aiG2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="count" stroke="#8B5CF6" fill="url(#aiG2)" strokeWidth={2} dot={false} name="AI Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <p className="chart-title">Request Type Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.type_distribution} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80}
                   label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.type_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top AI Users */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Top AI Users</p>
        </div>
        <table className="admin-table">
          <thead><tr><th>Rank</th><th>Username</th><th>AI Requests</th><th>Share</th></tr></thead>
          <tbody>
            {data.top_users.map((u, i) => {
              const max = data.top_users[0]?.count || 1;
              return (
                <tr key={u.user_id}>
                  <td className="text-slate-500">#{i + 1}</td>
                  <td className="font-medium text-white">{u.username}</td>
                  <td className="text-purple-400 font-mono">{u.count}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(u.count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{((u.count / max) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.top_users.length === 0 && (
              <tr><td colSpan={4} className="text-center text-slate-500 py-8">No AI usage data yet — will populate as reconciliations and chatbot queries are made</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
