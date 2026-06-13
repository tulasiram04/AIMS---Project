import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'purple' | 'green' | 'amber' | 'red' | 'cyan' | 'pink';
  subtitle?: string;
  trend?: { value: number; label: string };
  delay?: number;
}

const colorMap: Record<string, { icon: string; glow: string; bg: string; border: string; text: string }> = {
  blue:   { icon: 'text-blue-400',   glow: 'shadow-glow-blue',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-300' },
  purple: { icon: 'text-purple-400', glow: 'shadow-glow-purple', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-300' },
  green:  { icon: 'text-emerald-400',glow: 'shadow-glow-green',  bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-300' },
  amber:  { icon: 'text-amber-400',  glow: 'shadow-glow-amber',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-300' },
  red:    { icon: 'text-red-400',    glow: 'shadow-glow-red',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    text: 'text-red-300' },
  cyan:   { icon: 'text-cyan-400',   glow: '',                   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-300' },
  pink:   { icon: 'text-pink-400',   glow: '',                   bg: 'bg-pink-500/10',   border: 'border-pink-500/20',   text: 'text-pink-300' },
};

export default function KPICard({
  title, value, icon: Icon, color, subtitle, trend, delay = 0
}: KPICardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="kpi-card group"
    >
      {/* Background glow */}
      <div className={`absolute -top-8 -right-8 w-28 h-28 ${c.bg} rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{title}</p>
          <p className="text-3xl font-bold text-white tabular-nums leading-none">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1.5 mt-2`}>
              <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0 ml-3`}>
          <Icon size={20} className={c.icon} />
        </div>
      </div>
    </motion.div>
  );
}
