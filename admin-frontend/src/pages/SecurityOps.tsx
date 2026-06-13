import { useEffect, useState } from 'react';
import { ShieldAlert, KeyRound, UserX, AlertTriangle, Lock } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { type SecurityData } from '../types';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import { motion } from 'framer-motion';

export default function SecurityOps() {
  const [data, setData]     = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]     = useState(30);

  useEffect(() => {
    setLoading(true);
    adminApi.getSecurity(days).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingSpinner text="Loading security data…" />;
  if (!data)   return <p className="text-slate-400">No data</p>;

  const score = data.security_score;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const scoreBg    = score >= 80 ? 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20'
                  : score >= 60 ? 'from-amber-500/20 to-amber-500/5 border-amber-500/20'
                  :               'from-red-500/20 to-red-500/5 border-red-500/20';

  const ACTION_LABELS: Record<string, string> = {
    PASSWORD_RESET: 'Password Reset',
    STATUS_CHANGE:  'Account Status Change',
    USER_CREATED:   'User Created',
    USER_DELETED:   'User Deleted',
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Operations Center</h1>
          <p className="page-subtitle">Threat monitoring, access events, and security posture</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="admin-select w-36">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Security Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass-card p-6 bg-gradient-to-br border ${scoreBg}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Security Score</p>
            <div className="flex items-end gap-3 mt-2">
              <span className={`text-6xl font-black ${scoreColor}`}>{score}</span>
              <span className="text-2xl text-slate-500 mb-1">/100</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {score >= 80 ? 'Good posture — no critical issues detected' :
               score >= 60 ? 'Moderate risk — review flagged items' :
               'High risk — immediate attention required'}
            </p>
          </div>
          <ShieldAlert size={64} className={`${scoreColor} opacity-20`} />
        </div>
        {/* Score bar */}
        <div className="mt-4 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
          />
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Password Resets"    value={data.summary.password_resets}    icon={KeyRound}    color="amber"  delay={0}    />
        <KPICard title="Account Changes"    value={data.summary.account_changes}    icon={UserX}       color="amber"  delay={0.05} />
        <KPICard title="Disabled Accounts"  value={data.summary.disabled_accounts}  icon={Lock}        color="red"    delay={0.1}  />
        <KPICard title="User Deletions"     value={data.summary.user_deletions}     icon={UserX}       color="red"    delay={0.15} />
        <KPICard title="Auth Errors (4xx)"  value={data.summary.auth_errors}        icon={AlertTriangle} color="red" delay={0.2}  />
        <KPICard title="Total API Requests" value={data.summary.total_api_requests} icon={ShieldAlert} color="blue"   delay={0.25} />
      </div>

      {/* Security Events Timeline */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <ShieldAlert size={16} className="text-red-400" />
          <p className="text-sm font-semibold text-white">Recent Security Events</p>
          <span className="ml-auto text-xs text-slate-500">{data.recent_events.length} events in period</span>
        </div>
        {data.recent_events.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldAlert size={40} className="mx-auto text-emerald-500/30 mb-3" />
            <p className="text-emerald-400 font-semibold text-sm">No security events in this period</p>
            <p className="text-slate-500 text-xs mt-1">Platform is operating normally</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.recent_events.map((ev, i) => {
              const isHighSeverity = ['USER_DELETED', 'STATUS_CHANGE'].includes(ev.action);
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isHighSeverity ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${isHighSeverity ? 'text-red-400' : 'text-amber-400'}`}>
                        {ACTION_LABELS[ev.action] ?? ev.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500">by</span>
                      <span className="text-xs font-medium text-white">{ev.username}</span>
                    </div>
                    {ev.details && <p className="text-xs text-slate-500 mt-0.5 truncate">{ev.details}</p>}
                  </div>
                  <span className="text-[10px] text-slate-600 whitespace-nowrap flex-shrink-0">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
