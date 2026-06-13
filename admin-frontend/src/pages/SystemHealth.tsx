import { useEffect, useState } from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { type SystemHealth } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { motion } from 'framer-motion';

function ServiceCard({ name, status, details, delay }: { name: string; status: string; details: string; delay: number }) {
  const isHealthy = status === 'healthy';
  const isWarning = status === 'warning';
  const Icon = isHealthy ? CheckCircle2 : isWarning ? AlertTriangle : XCircle;
  const color = isHealthy ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-red-400';
  const bg    = isHealthy ? 'bg-emerald-500/10 border-emerald-500/20' : isWarning ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
  const pulse = isHealthy ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`glass-card p-5 border ${bg}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className={`w-3 h-3 rounded-full ${pulse} block`} />
            {isHealthy && <span className={`w-3 h-3 rounded-full ${pulse} block absolute inset-0 animate-ping opacity-40`} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{details}</p>
          </div>
        </div>
        <Icon size={20} className={color} />
      </div>
      <div className="mt-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{status}</span>
      </div>
    </motion.div>
  );
}

export default function SystemHealth() {
  const [data, setData]     = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getSystemHealth().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Checking system health…" />;
  if (!data) return <p className="text-slate-400">No data</p>;

  const allHealthy = data.services.every(s => s.status === 'healthy');
  const hasWarning = data.services.some(s => s.status === 'warning');

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Health Center</h1>
          <p className="page-subtitle">Real-time service status and operational metrics</p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-semibold border ${allHealthy ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : hasWarning ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {allHealthy ? '● All Systems Operational' : hasWarning ? '⚠ Degraded' : '✕ Critical'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.services.map((s, i) => (
          <ServiceCard key={s.name} name={s.name} status={s.status} details={s.details} delay={i * 0.08} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Sessions',  value: data.metrics.active_sessions, color: 'blue' },
          { label: 'Total Users',      value: data.metrics.total_users,      color: 'green' },
          { label: 'Audit Log Entries',value: data.metrics.total_audit_logs, color: 'purple' },
        ].map((m) => (
          <div key={m.label} className="glass-card p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider">{m.label}</p>
            <p className="text-3xl font-bold text-white mt-2">{m.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <p className="text-sm font-semibold text-white mb-4">Health Check Legend</p>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-slate-400">Healthy — All systems normal</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-slate-400">Warning — Degraded or missing config</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-slate-400">Critical — Service unavailable</span></div>
        </div>
      </div>
    </div>
  );
}
