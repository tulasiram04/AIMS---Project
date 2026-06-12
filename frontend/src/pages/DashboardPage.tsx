import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { inventoryAPI } from '../services/api';
import { Reconciliation, Discrepancy, Upload } from '../types';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  FolderUp,
  GitCompareArrows,
  FileText,
  Bot,
  Server,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  Lightbulb,
  ScanSearch,
  CircleDot,
  AlertTriangle,
  Target,
  Layers,
  Activity,
  ShieldAlert,
  Play,
  ArrowUpRight,
  TrendingDown,
  Info,
  Calendar,
  Zap,
} from 'lucide-react';

// ─── Animation Hook for Count-up ─────────────────────────────────────────────
function AnimatedMetric({ value, suffix = '', decimals = 0 }: { value: string | number; suffix?: string; decimals?: number }) {
  const numericStr = String(value).replace(/[^0-9.]/g, '');
  const numericVal = parseFloat(numericStr);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (isNaN(numericVal) || numericVal <= 0) {
      setCurrent(0);
      return;
    }
    let startTimestamp: number | null = null;
    const duration = 800; // ms
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
      
      setCurrent(easeProgress * numericVal);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCurrent(numericVal);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [numericVal]);

  if (isNaN(numericVal)) {
    return <span>{value}</span>;
  }

  return (
    <span>
      {decimals === 0 ? Math.round(current).toLocaleString() : current.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

function severityBadge(s: string | null) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20',
    HIGH:     'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20',
    MEDIUM:   'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20',
    LOW:      'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20',
  };
  const key = (s ?? '').toUpperCase();
  return `inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider ${map[key] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`;
}

function getDiscrepancyLabel(type: string): string {
  const labels: Record<string, string> = {
    MISSING_ASSET: 'Missing Asset',
    UNTRACKED_ASSET: 'Untracked Asset',
    CONFIG_MISMATCH: 'Config Mismatch',
    NAMING_MISMATCH: 'Naming Mismatch',
  };
  return labels[type] || type;
}

function getGovernanceGrade(score: number): { grade: string; color: string; bg: string; border: string; desc: string } {
  if (score >= 95) return { grade: 'A+', color: 'text-[#10B981]', bg: 'bg-[#10B981]/5', border: 'border-[#10B981]/25', desc: 'Outstanding Governance' };
  if (score >= 90) return { grade: 'A', color: 'text-[#10B981]', bg: 'bg-[#10B981]/5', border: 'border-[#10B981]/15', desc: 'High Compliance' };
  if (score >= 80) return { grade: 'B+', color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/5', border: 'border-[#2563EB]/25', desc: 'Good Governance' };
  if (score >= 70) return { grade: 'B', color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/5', border: 'border-[#2563EB]/15', desc: 'Satisfactory Compliance' };
  if (score >= 55) return { grade: 'C', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/5', border: 'border-[#F59E0B]/25', desc: 'Needs Improvement' };
  return { grade: 'D', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/5', border: 'border-[#EF4444]/25', desc: 'Critical Risk Profile' };
}

function extractAssetName(d: Discrepancy): string {
  try {
    const data = d.csv_data || d.json_data || {};
    const name = data.name || data.asset_name || data.hostname || data.title || data.label || '';
    if (name) return String(name);
  } catch (e) {
    // ignore
  }
  const idVal = d.csv_asset_id || d.json_asset_id || '';
  if (idVal) {
    return idVal.split('-').slice(1).join(' ') || idVal;
  }
  return 'Unnamed Asset';
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-5 mt-2">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-[#2563EB]/5 flex items-center justify-center text-[#2563EB]">
          <Icon size={20} />
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 h-px bg-[#E2E8F0] ml-4" />
    </div>
  );
}

// ─── Premium Onboarding Dashboard State ──────────────────────────────────────
function LandingDashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const steps = [
    {
      num: 1,
      title: 'Upload Inventory CSV',
      desc: 'Provide your recorded inventory or asset catalog baseline CSV.',
      icon: FolderUp,
      color: 'from-blue-500/10 to-sky-500/10 border-blue-100 text-[#2563EB]',
    },
    {
      num: 2,
      title: 'Upload Live JSON',
      desc: 'Provide the live infrastructure scan configuration snapshot file.',
      icon: Server,
      color: 'from-[#8B5CF6]/10 to-purple-500/10 border-purple-100 text-[#8B5CF6]',
    },
    {
      num: 3,
      title: 'Run Reconciliation',
      desc: 'Let AI agents reconcile assets and calculate governance drifts.',
      icon: GitCompareArrows,
      color: 'from-[#10B981]/10 to-emerald-500/10 border-emerald-100 text-[#10B981]',
    },
    {
      num: 4,
      title: 'Review Insights',
      desc: 'Inspect executive scorecards, business impact, and findings.',
      icon: Bot,
      color: 'from-[#F59E0B]/10 to-amber-500/10 border-amber-100 text-[#F59E0B]',
    },
    {
      num: 5,
      title: 'Generate Reports',
      desc: 'Export board-ready summaries and compliance reviews.',
      icon: FileText,
      color: 'from-[#EF4444]/10 to-red-500/10 border-red-100 text-[#EF4444]',
    },
  ];

  const statusChecks = [
    { name: 'Inventory Repository Database', info: 'PostgreSQL 15 Connected', active: true },
    { name: 'Multi-Agent Orchestrator', info: 'LangGraph Engine Ready', active: true },
    { name: 'AI Language Core Service', info: 'Gemini 2.5 Flash Online', active: true },
    { name: 'Enterprise Report Compiler', info: 'PDF Generation Engine Idle', active: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#0EA5E9] p-8 md:p-12 text-white shadow-[0_10px_30px_rgba(37,99,235,0.15)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full translate-x-24 -translate-y-24 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-24 translate-y-24 blur-xl" />
        
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Zap size={12} className="animate-pulse text-yellow-300" />
            Executive Governance Platform
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Welcome to AIMS
          </h1>
          <p className="text-white/80 text-sm md:text-base font-medium leading-relaxed max-w-2xl">
            Redefining enterprise governance with an AI-powered multi-agent pipeline. Reconcile asset registers, audit discrepancies, and detect compliance drifts instantly.
          </p>
          <div className="pt-4 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/upload')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#2563EB] font-bold text-sm hover:bg-white/95 active:scale-95 transition-all shadow-[0_4px_14px_rgba(255,255,255,0.25)]"
            >
              <FolderUp size={16} />
              Upload Inventory Files
            </button>
            <button
              onClick={() => onNavigate('/reconciliation')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/15 border border-white/20 text-white font-bold text-sm hover:bg-white/25 active:scale-95 transition-all backdrop-blur-md"
            >
              <GitCompareArrows size={16} />
              Reconciliation Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader title="Governance Onboarding Path" subtitle="Five steps to complete asset governance reconciliation" icon={Zap} />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((s, i) => {
            const { icon: StepIcon } = s;
            return (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.03)] hover:shadow-[0_15px_35px_rgba(15,23,42,0.06)] hover:-translate-y-1 transition-all duration-300 relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 rounded-full translate-x-6 -translate-y-6" />
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${s.color} border flex items-center justify-center`}>
                    <StepIcon size={20} />
                  </div>
                  <span className="text-3xl font-extrabold text-[#E2E8F0] group-hover:text-[#2563EB]/20 transition-colors">
                    0{s.num}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1.5">{s.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">{s.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4 flex items-center gap-2">
            <Info size={16} className="text-[#2563EB]" />
            Asset Governance Command Platform Capabilities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#64748B] leading-relaxed">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
              <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" /> Automated Policy Alignment
              </div>
              <p>Ensures database inventory profiles align perfectly with live cloud setups using automated agent triggers.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
              <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" /> Configuration Drift Scanning
              </div>
              <p>Locates assets that deviate from approved configuration baselines and reports operational vulnerabilities.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
              <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" /> Cost Penalty Prevention
              </div>
              <p>Estimates and flags idle untracked assets to secure potential compliance savings and optimize server efficiency.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
              <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" /> AI Resolution Recommendations
              </div>
              <p>Generates prioritised action plans using LangGraph multi-agents to resolve identified discrepancy categories.</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">AIMS Pipeline Status</h3>
            <div className="space-y-3">
              {statusChecks.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-[#E2E8F0]/50 last:border-0">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-[#0F172A]">{item.name}</div>
                    <div className="text-[10px] text-[#64748B]">{item.info}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-semibold">
                    <CircleDot size={12} className="text-[#10B981] animate-pulse" />
                    Online
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-[#E2E8F0]/50 mt-4 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#64748B]">Platform Version</span>
            <span className="text-xs font-mono font-semibold bg-[#2563EB]/5 text-[#2563EB] px-2 py-0.5 rounded-md border border-[#2563EB]/10">
              v1.0.5-LATEST
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Ready For Analysis State ────────────────────────────────────────────────
function ReadyForAnalysis({ uploads, onNavigate }: { uploads: Upload[]; onNavigate: (p: string) => void }) {
  const csvUploads = uploads.filter(u => u.upload_type === 'csv');
  const jsonUploads = uploads.filter(u => u.upload_type === 'json');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#0EA5E9] p-8 md:p-12 text-white shadow-[0_10px_30px_rgba(37,99,235,0.15)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full translate-x-24 -translate-y-24 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-24 translate-y-24 blur-xl" />
        
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Zap size={12} className="text-yellow-300 animate-pulse" />
            System Posture: Ready for Analysis
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Inventory Data Uploaded
          </h1>
          <p className="text-white/80 text-sm md:text-base font-medium leading-relaxed max-w-2xl">
            Your asset register baseline CSV files and live infrastructure JSON files are successfully uploaded and parsed. Start the reconciliation scan now to compare configurations and discover drifts.
          </p>
          <div className="pt-4 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/reconciliation')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#2563EB] font-bold text-sm hover:bg-white/95 active:scale-95 transition-all shadow-[0_4px_14px_rgba(255,255,255,0.25)]"
            >
              <Play size={16} />
              Run Reconciliation Scan
            </button>
            <button
              onClick={() => onNavigate('/upload')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/15 border border-white/20 text-white font-bold text-sm hover:bg-white/25 active:scale-95 transition-all backdrop-blur-md"
            >
              <FolderUp size={16} />
              Upload Additional Files
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4 flex items-center gap-2">
            <FolderUp size={16} className="text-[#2563EB]" />
            CSV Baseline Records ({csvUploads.length})
          </h3>
          <div className="space-y-3">
            {csvUploads.map((u, i) => (
              <div key={i} className="flex justify-between items-center p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <span className="font-semibold text-[#0F172A] truncate max-w-xs">{u.filename}</span>
                <span className="text-[#64748B] font-bold bg-[#E2E8F0]/50 px-2 py-0.5 rounded-full">{u.total_records} records</span>
              </div>
            ))}
            {csvUploads.length === 0 && (
              <p className="text-xs text-[#64748B] italic">No CSV inventory baseline files uploaded.</p>
            )}
          </div>
        </div>

        <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4 flex items-center gap-2">
            <Server size={16} className="text-[#2563EB]" />
            JSON Live Snapshots ({jsonUploads.length})
          </h3>
          <div className="space-y-3">
            {jsonUploads.map((u, i) => (
              <div key={i} className="flex justify-between items-center p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <span className="font-semibold text-[#0F172A] truncate max-w-xs">{u.filename}</span>
                <span className="text-[#64748B] font-bold bg-[#E2E8F0]/50 px-2 py-0.5 rounded-full">{u.total_records} records</span>
              </div>
            ))}
            {jsonUploads.length === 0 && (
              <p className="text-xs text-[#64748B] italic">No JSON live scans uploaded.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Post-reconciliation Executive View ──────────────────────────────────────
function PostReconDashboard({ latest, all }: { latest: Reconciliation; all: Reconciliation[] }) {
  if (!latest) return null;
  const safeAll = all ?? [];
  const navigate = useNavigate();

  // 1. Calculate dynamic indicators
  const totalDisc = (latest.missing_assets_count || 0) + (latest.untracked_assets_count || 0)
    + (latest.config_mismatch_count || 0) + (latest.naming_mismatch_count || 0);

  const matchedCount = Math.max(0,
    latest.total_csv_assets - (latest.missing_assets_count || 0) - (latest.config_mismatch_count || 0) - (latest.naming_mismatch_count || 0)
  );
  
  const matchRate = latest.total_csv_assets > 0
    ? clamp(Math.round((matchedCount / latest.total_csv_assets) * 100))
    : 0;

  // Governance score computation (Start at 100 and subtract mismatch violations)
  const governanceScore = Math.max(0, 
    100 
    - (latest.missing_assets_count || 0) 
    - (latest.naming_mismatch_count || 0) 
    - (latest.config_mismatch_count || 0) 
    - (latest.untracked_assets_count || 0)
  );

  const govGrade = getGovernanceGrade(governanceScore);

  // Risk exposure score calculation based on discrepancy severities
  const criticalCount = latest.discrepancies?.filter(d => d.severity?.toUpperCase() === 'CRITICAL').length || 0;
  const highCount = latest.discrepancies?.filter(d => d.severity?.toUpperCase() === 'HIGH').length || 0;
  const mediumCount = latest.discrepancies?.filter(d => d.severity?.toUpperCase() === 'MEDIUM').length || 0;
  const lowCount = latest.discrepancies?.filter(d => d.severity?.toUpperCase() === 'LOW').length || 0;

  const riskScore = Math.min(100, (criticalCount * 25) + (highCount * 15) + (mediumCount * 8) + (lowCount * 3));

  // Comparison logic for trends
  const getTrend = (current: number, prev: number, isLowerBetter = false) => {
    if (current === prev) return { label: '→ Stable', color: 'text-[#64748B]', icon: CircleDot };
    const isBetter = isLowerBetter ? current < prev : current > prev;
    return {
      label: isBetter ? '↑ Improved' : '↓ Degraded',
      color: isBetter ? 'text-[#10B981]' : 'text-[#EF4444]',
      icon: isBetter ? ArrowUpRight : TrendingDown
    };
  };

  const prevRun = safeAll.length > 1 ? safeAll[1] : null;

  const prevMatchedCount = prevRun ? Math.max(0, prevRun.total_csv_assets - (prevRun.missing_assets_count || 0) - (prevRun.config_mismatch_count || 0) - (prevRun.naming_mismatch_count || 0)) : 0;
  const prevMatchRate = prevRun && prevRun.total_csv_assets > 0 ? clamp(Math.round((prevMatchedCount / prevRun.total_csv_assets) * 100)) : 0;
  const prevGovScore = prevRun ? Math.max(0, 100 - (prevRun.missing_assets_count || 0) - (prevRun.naming_mismatch_count || 0) - (prevRun.config_mismatch_count || 0) - (prevRun.untracked_assets_count || 0)) : 100;
  const prevDisc = prevRun ? (prevRun.missing_assets_count || 0) + (prevRun.untracked_assets_count || 0) + (prevRun.config_mismatch_count || 0) + (prevRun.naming_mismatch_count || 0) : 0;

  const assetTrendInfo = prevRun ? getTrend(latest.total_csv_assets, prevRun.total_csv_assets) : { label: '→ Stable', color: 'text-[#64748B]', icon: CircleDot };
  const accuracyTrendInfo = prevRun ? getTrend(matchRate, prevMatchRate) : { label: '→ Stable', color: 'text-[#64748B]', icon: CircleDot };
  const govTrendInfo = prevRun ? getTrend(governanceScore, prevGovScore) : { label: '→ Stable', color: 'text-[#64748B]', icon: CircleDot };
  const discTrendInfo = prevRun ? getTrend(totalDisc, prevDisc, true) : { label: '→ Stable', color: 'text-[#64748B]', icon: CircleDot };

  // Historical score trends for charts
  const trendChartData = safeAll.slice().reverse().map(r => {
    const score = Math.max(0, 100 - (r.missing_assets_count || 0) - (r.naming_mismatch_count || 0) - (r.config_mismatch_count || 0) - (r.untracked_assets_count || 0));
    return {
      name: `Run #${r.id}`,
      Score: score,
      date: r.completed_at ? new Date(r.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Run #${r.id}`
    };
  });

  // Chart 1: Donut Chart - Asset Health Distribution (Healthy, Missing, Untracked, Drifted)
  const healthyCount = Math.max(0, latest.total_csv_assets - (latest.missing_assets_count || 0) - (latest.config_mismatch_count || 0) - (latest.naming_mismatch_count || 0));
  const missingCount = latest.missing_assets_count || 0;
  const untrackedCount = latest.untracked_assets_count || 0;
  const driftedCount = (latest.config_mismatch_count || 0) + (latest.naming_mismatch_count || 0);

  const healthChartData = [
    { name: 'Healthy Assets', value: healthyCount, color: '#10B981' },
    { name: 'Missing Assets', value: missingCount, color: '#EF4444' },
    { name: 'Untracked Assets', value: untrackedCount, color: '#F59E0B' },
    { name: 'Drifted Assets', value: driftedCount, color: '#8B5CF6' }
  ].filter(d => d.value > 0);

  if (healthChartData.length === 0) {
    healthChartData.push({ name: 'Healthy Assets', value: 1, color: '#10B981' });
  }

  // Chart 2: Bar Chart - Drift Categories Classification
  const discrepancyBreakdown = [
    { name: 'Missing Assets', count: latest.missing_assets_count || 0, fill: '#EF4444' },
    { name: 'Untracked Assets', count: latest.untracked_assets_count || 0, fill: '#F59E0B' },
    { name: 'Naming Mismatches', count: latest.naming_mismatch_count || 0, fill: '#2563EB' },
    { name: 'Configuration Drift', count: latest.config_mismatch_count || 0, fill: '#8B5CF6' }
  ];

  // State for searchable/sortable Critical Findings Register
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'id' | 'name' | 'type' | 'severity'>('severity');
  const [sortAsc, setSortAsc] = useState(false);

  const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  const filteredDiscrepancies = (latest.discrepancies ?? []).filter(d => {
    const assetId = (d.csv_asset_id || d.json_asset_id || '').toLowerCase();
    const assetName = extractAssetName(d).toLowerCase();
    const typeLabel = getDiscrepancyLabel(d.discrepancy_type).toLowerCase();
    const severity = (d.severity || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return assetId.includes(query) || assetName.includes(query) || typeLabel.includes(query) || severity.includes(query);
  });

  const sortedDiscrepancies = filteredDiscrepancies.slice().sort((a, b) => {
    let fieldA: any = '';
    let fieldB: any = '';

    if (sortField === 'id') {
      fieldA = a.csv_asset_id || a.json_asset_id || '';
      fieldB = b.csv_asset_id || b.json_asset_id || '';
    } else if (sortField === 'name') {
      fieldA = extractAssetName(a);
      fieldB = extractAssetName(b);
    } else if (sortField === 'type') {
      fieldA = getDiscrepancyLabel(a.discrepancy_type);
      fieldB = getDiscrepancyLabel(b.discrepancy_type);
    } else if (sortField === 'severity') {
      fieldA = severityRank[(a.severity ?? '').toUpperCase()] ?? 0;
      fieldB = severityRank[(b.severity ?? '').toUpperCase()] ?? 0;
      return sortAsc ? fieldA - fieldB : fieldB - fieldA;
    }

    if (typeof fieldA === 'string' && typeof fieldB === 'string') {
      return sortAsc ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
    }
    return 0;
  });

  // AI Recommendation Center mapping (max 5)
  const recommendationsList = (latest.discrepancies ?? [])
    .slice()
    .sort((a, b) => (severityRank[(b.severity ?? '').toUpperCase()] ?? 0) - (severityRank[(a.severity ?? '').toUpperCase()] ?? 0))
    .slice(0, 5)
    .map((d) => {
      const assetId = d.csv_asset_id || d.json_asset_id || 'Unknown';
      const name = extractAssetName(d);
      
      let priority = 'P4 (Low)';
      let riskReduction = '5% Risk Reduction';
      let effort = '1 Hour';
      let recommendation = '';

      const sev = (d.severity ?? '').toUpperCase();
      if (sev === 'CRITICAL') {
        priority = 'P1 (Critical)';
        riskReduction = '25% Risk Reduction';
        effort = '4 Hours';
      } else if (sev === 'HIGH') {
        priority = 'P2 (High)';
        riskReduction = '18% Risk Reduction';
        effort = '3 Hours';
      } else if (sev === 'MEDIUM') {
        priority = 'P3 (Medium)';
        riskReduction = '12% Risk Reduction';
        effort = '2 Hours';
      }

      if (d.discrepancy_type === 'MISSING_ASSET') {
        recommendation = `Add missing asset '${name}' (${assetId}) back to active tracking registries or decommission it to resolve baseline compliance drift.`;
      } else if (d.discrepancy_type === 'UNTRACKED_ASSET') {
        recommendation = `Register active discovered untracked system '${name}' (${assetId}) into the CMDB baseline directory to secure complete inventory alignment.`;
      } else if (d.discrepancy_type === 'NAMING_MISMATCH') {
        recommendation = `Correct host naming mismatch on '${name}' (${assetId}) to enforce system catalog standardization protocols.`;
      } else if (d.discrepancy_type === 'CONFIG_MISMATCH') {
        recommendation = `Standardize VM/server configuration settings on '${name}' (${assetId}) to eliminate host parameters drift.`;
      } else {
        recommendation = `Review operational alignment settings on asset '${name}' (${assetId}) to resolve outstanding deviations.`;
      }

      return {
        priority,
        recommendation,
        riskReduction,
        effort
      };
    });

  if (recommendationsList.length === 0) {
    recommendationsList.push({
      priority: 'P4 (Low)',
      recommendation: 'Maintain current operational posture: all registered inventory baselines are fully aligned with live endpoints.',
      riskReduction: '0% Risk Exposure',
      effort: '0 Hours'
    });
  }

  // Executive Summary Card Calculations
  const totalAssetsProcessed = (latest.total_csv_assets || 0) + (latest.total_json_assets || 0);
  const urgentDiscrepancy = (latest.discrepancies ?? []).find(d => d.severity?.toUpperCase() === 'CRITICAL' || d.severity?.toUpperCase() === 'HIGH');
  const immediateNextAction = urgentDiscrepancy
    ? `P1 Action Required: Resolve critical ${getDiscrepancyLabel(urgentDiscrepancy.discrepancy_type).toLowerCase()} drift on asset: ${urgentDiscrepancy.csv_asset_id || urgentDiscrepancy.json_asset_id}.`
    : 'No critical discrepancies outstanding. Continue automatic directory cron jobs to audit config templates.';

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-50px)] bg-[#F8FAFC] text-[#0F172A] flex flex-col gap-6 font-sans">
      
      {/* SECTION 1: EXECUTIVE HERO BANNER */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#0EA5E9] p-8 text-white shadow-[0_10px_30px_rgba(37,99,235,0.12)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-24 -translate-y-24 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-24 translate-y-24 blur-2xl" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <Activity size={12} className="text-[#10B981] animate-pulse" />
              Governance System Live
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
              Executive Governance Command Center
            </h1>
            <p className="text-white/80 text-xs md:text-sm font-medium leading-relaxed">
              AI-Powered Multi-Agent Inventory Governance Platform · Active Reconciliation #{latest.id}
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} /> 
                Last Scan Time: {latest.completed_at ? formatDate(latest.completed_at) : 'No Scan Performed'}
              </span>
              <span className="flex items-center gap-1.5">
                <Layers size={13} />
                Assets Processed: {totalAssetsProcessed}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldAlert size={13} />
                Open Findings: {totalDisc}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-col xl:flex-row gap-3">
            <button
              id="btn-scan-findings"
              onClick={() => {
                const element = document.getElementById('critical-findings');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#2563EB] font-bold text-xs hover:bg-white/95 active:scale-95 transition-all shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
            >
              <ScanSearch size={14} />
              View Findings
            </button>
            <button
              id="btn-scan-report"
              onClick={() => navigate('/reports')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md"
            >
              <FileText size={14} />
              Generate Report
            </button>
            <button
              id="btn-scan-run"
              onClick={() => navigate('/reconciliation')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md"
            >
              <GitCompareArrows size={14} />
              Run New Scan
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Assets',
            val: latest.total_csv_assets,
            badge: 'Baseline',
            badgeColor: 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/10',
            trend: assetTrendInfo.label,
            trendColor: assetTrendInfo.color,
            TrendIcon: assetTrendInfo.icon,
            icon: Layers,
            iconColor: 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/10'
          },
          {
            title: 'Match Accuracy',
            val: matchRate,
            suffix: '%',
            badge: matchRate >= 80 ? 'Optimal' : 'Attention',
            badgeColor: matchRate >= 80 ? 'bg-[#10B981]/5 text-[#10B981] border-[#10B981]/10' : 'bg-[#F59E0B]/5 text-[#F59E0B] border-[#F59E0B]/10',
            trend: accuracyTrendInfo.label,
            trendColor: accuracyTrendInfo.color,
            TrendIcon: accuracyTrendInfo.icon,
            icon: Target,
            iconColor: 'bg-[#10B981]/5 text-[#10B981] border-[#10B981]/10'
          },
          {
            title: 'Governance Score',
            val: governanceScore,
            suffix: '/100',
            badge: govGrade.grade,
            badgeColor: govGrade.bg + ' ' + govGrade.color + ' ' + govGrade.border,
            trend: govTrendInfo.label,
            trendColor: govTrendInfo.color,
            TrendIcon: govTrendInfo.icon,
            icon: ShieldCheck,
            iconColor: 'bg-[#8B5CF6]/5 text-[#8B5CF6] border-[#8B5CF6]/10'
          },
          {
            title: 'Open Discrepancies',
            val: totalDisc,
            badge: totalDisc === 0 ? 'Optimal' : 'Unresolved',
            badgeColor: totalDisc === 0 ? 'bg-[#10B981]/5 text-[#10B981] border-[#10B981]/10' : 'bg-[#F59E0B]/5 text-[#F59E0B] border-[#F59E0B]/10',
            trend: discTrendInfo.label,
            trendColor: discTrendInfo.color,
            TrendIcon: discTrendInfo.icon,
            icon: AlertTriangle,
            iconColor: 'bg-[#F59E0B]/5 text-[#F59E0B] border-[#F59E0B]/10'
          }
        ].map((card) => {
          const { icon: CardIcon, TrendIcon } = card;
          return (
            <motion.div
              key={card.title}
              className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_15px_35px_rgba(15,23,42,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-36 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br opacity-5 rounded-full translate-x-4 -translate-y-4" />
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl border ${card.iconColor} flex items-center justify-center`}>
                  <CardIcon size={16} />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.badgeColor}`}>
                  {card.badge}
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#0F172A] mt-2 tracking-tight">
                  <AnimatedMetric value={card.val} suffix={card.suffix} />
                </div>
                <div className="text-[10px] font-semibold text-[#64748B] mt-0.5">{card.title}</div>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-bold mt-2 pt-2 border-t border-[#E2E8F0]/40">
                <TrendIcon size={10} className={card.trendColor} />
                <span className={card.trendColor}>{card.trend}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* SECTION 3: EXECUTIVE FOCUS GRID (EXECUTIVE SUMMARY CARD & AI RECOMMENDATION CENTER) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Executive Summary Card */}
        <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-5 flex items-center gap-2">
              <Lightbulb size={16} className="text-[#2563EB]" />
              Executive Summary Card
            </h3>
            
            <div className="space-y-4">
              {[
                { label: 'Total Assets Analysed', val: totalAssetsProcessed.toLocaleString() },
                { label: 'Match Accuracy', val: `${matchRate}%`, color: matchRate >= 80 ? 'text-[#10B981]' : 'text-[#F59E0B]' },
                { label: 'Governance Score', val: `${governanceScore}/100`, color: governanceScore >= 80 ? 'text-[#2563EB]' : 'text-[#EF4444]' },
                { label: 'Risk Exposure', val: `${riskScore}%`, color: riskScore <= 30 ? 'text-[#10B981]' : 'text-[#EF4444]' },
                { label: 'Critical Issues Count', val: criticalCount.toString(), color: criticalCount > 0 ? 'text-[#EF4444]' : 'text-[#64748B]' }
              ].map((row, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]/40 last:border-0 text-xs">
                  <span className="font-semibold text-gray-500">{row.label}</span>
                  <span className={`font-extrabold ${row.color || 'text-[#0F172A]'}`}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-150 text-xs font-semibold">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Immediate Next Action</span>
            <p className="text-[#0F172A] leading-relaxed">{immediateNextAction}</p>
          </div>
        </div>

        {/* AI Recommendation Center */}
        <div className="lg:col-span-2 p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <Bot size={16} className="text-[#2563EB]" />
            AI Recommendation Center
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendationsList.map((rec, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-colors duration-200"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="inline-flex items-center text-[9px] font-bold text-[#2563EB] bg-[#2563EB]/5 px-2 py-0.5 rounded border border-[#2563EB]/10">
                      Priority: {rec.priority}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">Recommendation #{i + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-semibold leading-relaxed">
                    {rec.recommendation}
                  </p>
                </div>
                
                <div className="pt-3 border-t border-gray-200/50 mt-3 flex justify-between items-center text-[9px] font-bold">
                  <span className="text-emerald-600">{rec.riskReduction}</span>
                  <span className="text-gray-400">Estimated Effort: {rec.effort}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: THREE EXECUTIVE CHARTS */}
      <div className="space-y-4">
        <SectionHeader title="Analytics & Trends" subtitle="Governance scoring, risk index tracking, and asset register comparisons" icon={BarChart3} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart 1: Asset Health Distribution (Donut Chart) */}
          <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">Asset Health Distribution</h4>
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {healthChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-center text-[10px] font-semibold">
                  {healthChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-150 rounded-lg">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-500">{item.name}:</span>
                      <span className="font-extrabold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Drift Categories Classification (Bar Chart) */}
          <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">Drift Categories Classification</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={discrepancyBreakdown} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {discrepancyBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 3: Governance Score Trend (Line/Area Chart, Conditionally visible) */}
          <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">Governance Score Trend</h4>
              <div className="h-64">
                {safeAll.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <defs>
                        <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748B' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748B' }} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                      <Area type="monotone" dataKey="Score" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreColor)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <Info size={24} className="text-[#2563EB] mb-2" />
                    <div className="text-xs font-bold text-slate-800">Initial Reconciliation Run</div>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      Historical trends will appear after additional reconciliation scans.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 5: CRITICAL FINDINGS REGISTER */}
      <div id="critical-findings" className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#EF4444]" />
              Critical Findings Register
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Filter and inspect configuration or registry drifts.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by ID, Name, Type, Severity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs w-64 focus:outline-none focus:border-[#2563EB] bg-white text-gray-850 font-semibold"
            />
            
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-gray-400">Sort:</span>
              {[
                { field: 'id', label: 'ID' },
                { field: 'name', label: 'Name' },
                { field: 'type', label: 'Type' },
                { field: 'severity', label: 'Severity' }
              ].map((opt) => (
                <button
                  key={opt.field}
                  onClick={() => {
                    if (sortField === opt.field) setSortAsc(!sortAsc);
                    else {
                      setSortField(opt.field as any);
                      setSortAsc(false);
                    }
                  }}
                  className={`px-2 py-1 rounded-lg border font-bold text-[10px] transition-colors ${sortField === opt.field ? 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/25' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                  {opt.label} {sortField === opt.field && (sortAsc ? '↑' : '↓')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sortedDiscrepancies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-[#0F172A] border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B] text-left font-semibold">
                  <th className="pb-3 pr-4 font-bold">Asset ID</th>
                  <th className="pb-3 pr-4 font-bold">Asset Name</th>
                  <th className="pb-3 pr-4 font-bold">Issue Type</th>
                  <th className="pb-3 pr-4 text-center font-bold">Severity</th>
                  <th className="pb-3 pr-4 font-bold">Status</th>
                  <th className="pb-3 pr-4 font-bold">Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedDiscrepancies.map((d, i) => {
                  const assetName = extractAssetName(d);
                  const displayId = d.csv_asset_id || d.json_asset_id || '—';
                  
                  return (
                    <tr key={d.id ?? i} className="border-b border-[#E2E8F0]/40 hover:bg-[#F8FAFC] transition-colors duration-200">
                      <td className="py-3.5 pr-4 font-mono font-bold text-[#2563EB] max-w-[100px] truncate" title={displayId}>
                        {displayId}
                      </td>
                      <td className="py-3.5 pr-4 font-semibold text-[#0F172A] max-w-[140px] truncate" title={assetName}>
                        {assetName}
                      </td>
                      <td className="py-3.5 pr-4 text-[#64748B] font-medium">
                        {getDiscrepancyLabel(d.discrepancy_type)}
                      </td>
                      <td className="py-3.5 pr-4 text-center">
                        <span className={severityBadge(d.severity)}>{d.severity ?? 'LOW'}</span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F59E0B]">
                          <CircleDot size={10} className="text-[#F59E0B] animate-pulse" />
                          Unresolved
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-medium text-[#64748B] max-w-[280px] truncate" title={d.recommended_action || 'Review configuration parameters.'}>
                        {d.recommended_action || 'Review configuration parameters.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#10B981] text-sm font-semibold">
            <CheckCircle2 size={40} className="text-[#10B981] animate-bounce" />
            No discrepancies matching your search or register criteria.
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = () => {
      Promise.all([
        inventoryAPI.listUploads(),
        inventoryAPI.listReconciliations()
      ])
        .then(([uploadsRes, reconsRes]) => {
          if (isMounted) {
            setUploads(uploadsRes.data);
            setReconciliations(reconsRes.data);
          }
        })
        .catch(err => {
          console.warn('Dashboard fetch caught:', err.message);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    };

    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) return <LoadingSpinner message="Loading governance dashboard..." />;

  const isReset = localStorage.getItem('aims_workspace_reset') === 'true' || localStorage.getItem('aims_dashboard_reset') === 'true';
  const hasUploads = uploads.length > 0 && !isReset;
  const hasReconciliation = reconciliations.length > 0 && !isReset;

  if (!hasUploads && !hasReconciliation) {
    return <LandingDashboard onNavigate={navigate} />;
  }

  if (hasUploads && !hasReconciliation) {
    return <ReadyForAnalysis uploads={uploads} onNavigate={navigate} />;
  }

  const latest = reconciliations[0];

  return <PostReconDashboard latest={latest} all={reconciliations} />;
}
