import { useEffect, useState } from 'react';
import {
  Users, UserCheck, Database, GitMerge, FileText, ScrollText,
  BrainCircuit, Activity, Package, UserX, UserPlus, Clock,
  CheckCircle2, XCircle, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { adminApi } from '../services/adminApi';
import { type DashboardData } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';

const CHART_COLORS = {
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
};

const tooltipStyle = {
  backgroundColor: '#0D1526',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#E2E8F0',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-container">
      <p className="chart-title">{title}</p>
      {children}
    </div>
  );
}

export default function ExecutiveDashboard() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    adminApi.getDashboard()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading executive dashboard…" />;
  if (error || !data) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400 text-sm">{error || 'No data'}</p>
    </div>
  );

  const d = data;
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Platform-wide KPIs · Last updated {now}</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-secondary">
          <TrendingUp size={15} /> Refresh
        </button>
      </div>

      {/* KPI Grid — Row 1: Users */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">User Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard title="Total Users"       value={d.users.total}           icon={Users}       color="blue"   delay={0}    />
          <KPICard title="Active Users"      value={d.users.active}          icon={UserCheck}   color="green"  delay={0.05} />
          <KPICard title="Online Now"        value={d.users.online}          icon={Clock}       color="cyan"   delay={0.1}  />
          <KPICard title="New Today"         value={d.users.new_today}       icon={UserPlus}    color="purple" delay={0.15} />
          <KPICard title="New This Month"    value={d.users.new_this_month}  icon={TrendingUp}  color="amber"  delay={0.2}  />
          <KPICard title="Disabled Users"    value={d.users.disabled}        icon={UserX}       color="red"    delay={0.25} />
        </div>
      </div>

      {/* KPI Grid — Row 2: Platform */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Platform Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
          <KPICard title="Total Assets"      value={d.inventory.total_assets}          icon={Package}      color="blue"   delay={0.3}
                   subtitle={`${d.inventory.total_uploads} upload files`} />
          <KPICard title="Reconciliations"   value={d.reconciliations.total}           icon={GitMerge}     color="purple" delay={0.35}
                   subtitle={`${d.reconciliations.success_rate}% success rate`} />
          <KPICard title="Reports Generated" value={d.reports.total}                   icon={FileText}     color="green"  delay={0.4} />
          <KPICard title="Audit Log Entries" value={d.audit.total}                     icon={ScrollText}   color="amber"  delay={0.45} />
        </div>
      </div>

      {/* KPI Grid — Row 3: Tech */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">System Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Recon: Completed"  value={d.reconciliations.completed} icon={CheckCircle2}  color="green"  delay={0.5} />
          <KPICard title="Recon: Failed"     value={d.reconciliations.failed}    icon={XCircle}       color="red"    delay={0.55} />
          <KPICard title="Gemini Requests"   value={d.ai.total_requests}         icon={BrainCircuit}  color="purple" delay={0.6} />
          <KPICard title="API Requests"      value={d.api.total_requests}        icon={Activity}      delay={0.65} color="cyan"
                   subtitle={`DB: ${d.database.size_mb} MB`} />
        </div>
      </div>

      {/* Charts — Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="User Growth Trend (30 days)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={d.trends.user_growth}>
              <defs>
                <linearGradient id="uG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.blue}   stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.blue}   stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke={CHART_COLORS.blue} fill="url(#uG)" strokeWidth={2} dot={false} name="New Users" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Reconciliation Trend (30 days)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.trends.recon_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={CHART_COLORS.purple} radius={[4,4,0,0]} name="Reconciliations" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="AI Usage Trend (30 days)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={d.trends.ai_trend}>
              <defs>
                <linearGradient id="aiG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.purple} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke={CHART_COLORS.purple} fill="url(#aiG)" strokeWidth={2} dot={false} name="Gemini Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Platform Activity — Uploads & Reports (30 days)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={d.trends.upload_trend}>
              <defs>
                <linearGradient id="upG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke={CHART_COLORS.green} fill="url(#upG)" strokeWidth={2} dot={false} name="Uploads" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* API Trend */}
      <ChartCard title="API Request Volume (30 days)">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={d.trends.api_trend}>
            <defs>
              <linearGradient id="apiG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CHART_COLORS.amber} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="count" stroke={CHART_COLORS.amber} fill="url(#apiG)" strokeWidth={2} dot={false} name="API Requests" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
