import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { adminApi } from '../services/adminApi';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
const TT = { backgroundColor: '#0D1526', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#E2E8F0' };

export default function UserAnalytics() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getUserAnalytics().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading user analytics…" />;
  if (!data) return <p className="text-slate-400">No data</p>;

  const topUsers       = (data.top_active_users     as { username: string; activity_count: number }[])  ?? [];
  const regTrend       = (data.registration_trend   as { date: string; count: number }[])               ?? [];
  const loginTrend     = (data.login_trend          as { date: string; count: number }[])               ?? [];
  const roleDist       = (data.role_distribution    as { role: string; count: number }[])               ?? [];
  const topApiUsers    = (data.top_api_users        as { username: string; requests: number }[])         ?? [];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Analytics Center</h1>
          <p className="page-subtitle">Behaviour, retention, and engagement metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Active Users */}
        <div className="chart-container">
          <p className="chart-title">Most Active Users (by audit actions)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topUsers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="username" tick={{ fill: '#94A3B8', fontSize: 11 }} width={80} tickLine={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="activity_count" fill="#3B82F6" radius={[0,4,4,0]} name="Actions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Role Distribution */}
        <div className="chart-container">
          <p className="chart-title">Role Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={roleDist} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} label={({ role, percent }) => `${role} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {roleDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Registration Trend */}
        <div className="chart-container">
          <p className="chart-title">New Registrations (90 days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={regTrend}>
              <defs>
                <linearGradient id="rG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="count" stroke="#10B981" fill="url(#rG)" strokeWidth={2} dot={false} name="New Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Login Trend */}
        <div className="chart-container">
          <p className="chart-title">Login Sessions (30 days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={loginTrend}>
              <defs>
                <linearGradient id="lG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="count" stroke="#8B5CF6" fill="url(#lG)" strokeWidth={2} dot={false} name="Sessions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top API Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Top API Users</p>
        </div>
        <table className="admin-table">
          <thead><tr><th>Rank</th><th>Username</th><th>API Requests</th><th>Share</th></tr></thead>
          <tbody>
            {topApiUsers.map((u, i) => {
              const maxReq = topApiUsers[0]?.requests || 1;
              return (
                <tr key={u.username}>
                  <td className="text-slate-500">#{i + 1}</td>
                  <td className="font-medium text-white">{u.username}</td>
                  <td className="text-blue-400 font-mono">{u.requests.toLocaleString()}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(u.requests / maxReq) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{((u.requests / maxReq) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {topApiUsers.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-8">No API request data yet — starts populating as users interact</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
