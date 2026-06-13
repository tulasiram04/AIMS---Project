import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, Package, GitMerge, FileText,
  ScrollText, BrainCircuit, Activity, Database, HeartPulse, ShieldAlert,
  TrendingUp, Settings, LogOut, Zap, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const nav = [
  { to: '/',                   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users',              icon: Users,           label: 'User Management' },
  { to: '/user-analytics',     icon: BarChart3,       label: 'User Analytics' },
  { to: '/inventory',          icon: Package,         label: 'Inventory' },
  { to: '/reconciliations',    icon: GitMerge,        label: 'Reconciliations' },
  { to: '/reports',            icon: FileText,        label: 'Reports' },
  { to: '/audit',              icon: ScrollText,      label: 'Audit & Compliance' },
  { to: '/ai-operations',      icon: BrainCircuit,    label: 'AI Operations' },
  { to: '/api-monitoring',     icon: Activity,        label: 'API Monitoring' },
  { to: '/database',           icon: Database,        label: 'Database' },
  { to: '/system-health',      icon: HeartPulse,      label: 'System Health' },
  { to: '/security',           icon: ShieldAlert,     label: 'Security' },
  { to: '/business-intelligence', icon: TrendingUp,  label: 'Business Intel.' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-screen bg-sidebar-gradient border-r border-white/[0.06] sticky top-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-glow-blue">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">AIMS Admin</p>
            <p className="text-[10px] text-slate-500 leading-tight">Control Center</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              <Icon size={16} className={active ? 'text-blue-400' : ''} />
              <span className="flex-1 text-[13px]">{label}</span>
              {active && <ChevronRight size={12} className="text-blue-400" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
        <NavLink to="/settings" className="nav-item">
          <Settings size={16} />
          <span className="text-[13px]">Settings</span>
        </NavLink>

        <div className="mt-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold uppercase">
              {user?.username?.[0] ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name ?? 'Admin'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-2.5 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg
                       text-red-400 hover:text-red-300 hover:bg-red-500/10
                       text-xs font-medium transition-all duration-150"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
