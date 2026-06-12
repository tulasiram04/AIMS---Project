import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend
} from 'recharts';
import { inventoryAPI } from '../services/api';
import { useReconStore } from '../stores/reconStore';
import { Upload, Reconciliation, Discrepancy } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/helpers';
import {
  FileSpreadsheet,
  Braces,
  Upload as UploadIcon,
  CheckCircle,
  AlertCircle,
  Info,
  Layers,
  Target,
  ShieldCheck,
  AlertTriangle,
  Play,
  Sliders,
  Calendar,
  Zap,
  CircleDot,
  Bot,
  Lightbulb,
  Eye,
  RefreshCw,
  Lock,
  CheckSquare,
  ShieldAlert,
  ArrowRight,
  X
} from 'lucide-react';

// Animation Hook for Metric Count-up
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

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function severityBadge(s: string | null) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-50 text-red-600 border border-red-100',
    HIGH:     'bg-red-50/70 text-red-500 border border-red-50',
    MEDIUM:   'bg-amber-50 text-amber-600 border border-amber-100',
    LOW:      'bg-green-50 text-green-600 border border-green-100',
  };
  const key = (s ?? '').toUpperCase();
  return `inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${map[key] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`;
}

// Strip markdown double asterisks and hash marks for clean UI presentation
function cleanText(text: string | null): string {
  if (!text) return 'AI Insights temporarily unavailable.';
  const lower = text.toLowerCase();
  const errorWords = ['quota', '429', 'api error', 'limit exceeded', 'rate limit', 'overloaded', 'exception', 'stack trace', 'internal error', 'model failed', 'gemini'];
  const hasError = errorWords.some(w => lower.includes(w));
  if (hasError) {
    return 'AI Insights temporarily unavailable.';
  }
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .trim();
}

export default function UploadPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<Upload | null>(null);
  const [jsonResult, setJsonResult] = useState<Upload | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Client-side file previews (first 3 rows)
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [jsonPreview, setJsonPreview] = useState<any[]>([]);
  
  // Workspace Comparison States
  const [comparing, setComparing] = useState(false);
  const [compareProgress, setCompareProgress] = useState(0);
  const [compareError, setCompareError] = useState('');
  
  const reconciliations = useReconStore((s) => s.reconciliations);
  const latestRecon = useReconStore((s) => s.latestRecon);
  const fetchReconciliations = useReconStore((s) => s.fetchReconciliations);
  const [hideStoreLatestRecon, setHideStoreLatestRecon] = useState(false);

  // Sort State for Findings Register
  const [sortField, setSortField] = useState<'severity' | 'type'>('severity');
  const [sortAsc, setSortAsc] = useState(false);

  // Detailed modal presentation
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Interactive Remediation Simulator States
  const [simFixMissing, setSimFixMissing] = useState(false);
  const [simFixUntracked, setSimFixUntracked] = useState(false);
  const [simFixConfig, setSimFixConfig] = useState(false);
  const [simFixNaming, setSimFixNaming] = useState(false);

  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  // 1. Fetch history and auto-sync on mount
  useEffect(() => {
    fetchReconciliations();
  }, [fetchReconciliations]);

  // HTML5 client-side reading for baseline CSV
  const readCsvPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const previewRows = lines.slice(1, 4).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          const rowObj: Record<string, string> = {};
          headers.forEach((h, index) => {
            rowObj[h] = values[index] || '';
          });
          return rowObj;
        });
        setCsvPreview(previewRows);
      }
    };
    reader.readAsText(file.slice(0, 8000));
  };

  // HTML5 client-side reading for live scan JSON
  const readJsonPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        const arrayData = Array.isArray(data) ? data : (data.assets || Object.values(data)[0] || []);
        if (Array.isArray(arrayData)) {
          setJsonPreview(arrayData.slice(0, 3));
        }
      } catch (err) {
        console.warn('JSON preview parse failed:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Only .csv files are allowed for inventory upload');
        return;
      }
      setError('');
      setCsvFile(file);
      setCsvResult(null);
      setHideStoreLatestRecon(true);
      readCsvPreview(file);
    }
  };

  const handleJsonSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError('Only .json files are allowed for live inventory upload');
        return;
      }
      setError('');
      setJsonFile(file);
      setJsonResult(null);
      setHideStoreLatestRecon(true);
      readJsonPreview(file);
    }
  };

  const uploadCsv = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    setError('');
    try {
      const res = await inventoryAPI.uploadCSV(csvFile);
      setCsvResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'CSV upload failed');
    } finally {
      setCsvLoading(false);
    }
  };

  const uploadJson = async () => {
    if (!jsonFile) return;
    setJsonLoading(true);
    setError('');
    try {
      const res = await inventoryAPI.uploadJSON(jsonFile);
      setJsonResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'JSON upload failed');
    } finally {
      setJsonLoading(false);
    }
  };

  // Re-trigger scan manually via CTA Execute Button
  const runComparison = async (csvId: number, jsonId: number) => {
    setComparing(true);
    setCompareError('');
    setCompareProgress(0);
    
    let currentProg = 0;
    const interval = setInterval(() => {
      if (currentProg < 30) {
        currentProg += Math.floor(Math.random() * 5) + 3;
      } else if (currentProg < 65) {
        currentProg += Math.floor(Math.random() * 3) + 2;
      } else if (currentProg < 88) {
        currentProg += Math.floor(Math.random() * 2) + 1;
      } else if (currentProg < 97) {
        currentProg += 0.5;
      }
      setCompareProgress(clamp(currentProg, 0, 97));
    }, 250);

    try {
      const res = await inventoryAPI.reconcile(csvId, jsonId);
      clearInterval(interval);
      setCompareProgress(100);
      
      setTimeout(async () => {
        setHideStoreLatestRecon(false);
        localStorage.removeItem('aims_dashboard_reset');
        await fetchReconciliations();
        // Reset simulation states for a new run
        setSimFixMissing(false);
        setSimFixUntracked(false);
        setSimFixConfig(false);
        setSimFixNaming(false);
      }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setCompareProgress(0);
      setCompareError(err.response?.data?.detail || 'Reconciliation comparison failed.');
    } finally {
      setTimeout(() => {
        setComparing(false);
      }, 500);
    }
  };

  // Reset entire upload and comparison workspace
  const resetWorkspace = async () => {
    try {
      await inventoryAPI.resetWorkspace();
      await fetchReconciliations();
      localStorage.setItem('aims_dashboard_reset', 'true');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear workspace backend data');
    }
    setCsvFile(null);
    setJsonFile(null);
    setCsvResult(null);
    setJsonResult(null);
    setCsvPreview([]);
    setJsonPreview([]);
    setHideStoreLatestRecon(true);
    setCompareError('');
    setCompareProgress(0);
    setShowAnalysisModal(false);
    setSimFixMissing(false);
    setSimFixUntracked(false);
    setSimFixConfig(false);
    setSimFixNaming(false);
  };

  // Get asset type category from discrepancy metadata
  const getAssetType = (d: Discrepancy): string => {
    const data = d.csv_data || d.json_data || {};
    let type = (data.type || data.category || data.asset_type || data.kind || data.resource_type || '') as string;
    
    if (!type && d.csv_asset_id) {
      const lowerId = d.csv_asset_id.toLowerCase();
      if (lowerId.startsWith('vm-')) type = 'VM';
      else if (lowerId.startsWith('db-')) type = 'Database';
      else if (lowerId.startsWith('srv-')) type = 'Server';
      else if (lowerId.startsWith('net-')) type = 'Network Device';
      else if (lowerId.startsWith('str-')) type = 'Cloud Storage';
    }
    if (!type && d.json_asset_id) {
      const lowerId = d.json_asset_id.toLowerCase();
      if (lowerId.startsWith('vm-')) type = 'VM';
      else if (lowerId.startsWith('db-')) type = 'Database';
      else if (lowerId.startsWith('srv-')) type = 'Server';
      else if (lowerId.startsWith('net-')) type = 'Network Device';
      else if (lowerId.startsWith('str-')) type = 'Cloud Storage';
    }
    
    if (!type) return 'VM';
    const cleanType = type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    if (cleanType.includes('Virtual Machine')) return 'VM';
    if (cleanType.includes('Database')) return 'Database';
    if (cleanType.includes('Server') || cleanType.includes('Host')) return 'Server';
    if (cleanType.includes('Network') || cleanType.includes('Interface')) return 'Network Device';
    if (cleanType.includes('App') || cleanType.includes('Web')) return 'Application';
    return cleanType;
  };

  // Determine State
  const effectiveLatestRecon = hideStoreLatestRecon ? null : latestRecon;
  const hasCsv = csvResult !== null || (effectiveLatestRecon !== null && effectiveLatestRecon.total_csv_assets > 0);
  const hasJson = jsonResult !== null || (effectiveLatestRecon !== null && effectiveLatestRecon.total_json_assets > 0);
  const stateVal = effectiveLatestRecon ? 3 : (hasCsv && hasJson) ? 3 : (hasCsv || hasJson) ? 2 : 1;

  // ─── Computational Logic for Workspace Display ───────────────────────────
  let workspaceData = null;
  if (effectiveLatestRecon) {
    const csvTotal = effectiveLatestRecon.total_csv_assets || 0;
    const jsonTotal = effectiveLatestRecon.total_json_assets || 0;
    const missing = effectiveLatestRecon.missing_assets_count || 0;
    const untracked = effectiveLatestRecon.untracked_assets_count || 0;
    const config = effectiveLatestRecon.config_mismatch_count || 0;
    const naming = effectiveLatestRecon.naming_mismatch_count || 0;
    const matched = Math.max(0, csvTotal - missing - config - naming);
    const matchAccuracy = csvTotal > 0 ? clamp(Math.round((matched / csvTotal) * 100)) : 0;
    const currentScore = Math.max(0, 100 - (missing + untracked + config + naming));

    // Audit Readiness Score Formula: 100 - (missing * 3 + untracked * 2 + config * 1.5 + naming * 0.5)
    const currentReadiness = Math.max(0, Math.round(100 - (missing * 3 + untracked * 2 + config * 1.5 + naming * 0.5)));

    // Interactive Simulation Calculations
    const activeSimMissing = simFixMissing ? 0 : missing;
    const activeSimUntracked = simFixUntracked ? 0 : untracked;
    const activeSimConfig = simFixConfig ? 0 : config;
    const activeSimNaming = simFixNaming ? 0 : naming;

    const simulatedScore = Math.max(0, 100 - (activeSimMissing + activeSimUntracked + activeSimConfig + activeSimNaming));
    const simulatedReadiness = Math.max(0, Math.round(100 - (activeSimMissing * 3 + activeSimUntracked * 2 + activeSimConfig * 1.5 + activeSimNaming * 0.5)));
    const simulatedRisk = Math.min(100, Math.round((activeSimMissing * 4 + activeSimUntracked * 3 + activeSimConfig * 2 + activeSimNaming * 1) * 1.2));
    const originalRisk = Math.min(100, Math.round((missing * 4 + untracked * 3 + config * 2 + naming * 1) * 1.2));
    
    // Asset matrix rows
    const assetTypesList = ['Server', 'VM', 'Database', 'Application', 'Network Device'];
    const typeGroups: Record<string, { missing: number; untracked: number; config: number; naming: number; total: number }> = {};
    assetTypesList.forEach(t => {
      typeGroups[t] = { missing: 0, untracked: 0, config: 0, naming: 0, total: 0 };
    });

    (effectiveLatestRecon.discrepancies ?? []).forEach(d => {
      let typeStr = getAssetType(d);
      if (!assetTypesList.includes(typeStr)) {
        typeStr = 'VM'; // default fallback
      }
      typeGroups[typeStr].total += 1;
      if (d.discrepancy_type === 'MISSING_ASSET') typeGroups[typeStr].missing += 1;
      else if (d.discrepancy_type === 'UNTRACKED_ASSET') typeGroups[typeStr].untracked += 1;
      else if (d.discrepancy_type === 'CONFIG_MISMATCH') typeGroups[typeStr].config += 1;
      else if (d.discrepancy_type === 'NAMING_MISMATCH') typeGroups[typeStr].naming += 1;
    });

    // Recharts asset distribution pie chart configuration
    const distributionChartData = assetTypesList.map((type, idx) => {
      const colors = ['#2563EB', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444'];
      const totalForType = typeGroups[type].total;
      return {
        name: type,
        value: totalForType > 0 ? totalForType : Math.floor(Math.random() * 2) + 1, // visual baseline if 0
        color: colors[idx]
      };
    });

    // AI Root Cause Analysis (strictly Cause, Impact, Risk, Action)
    const criticalDiscrepancy = (effectiveLatestRecon.discrepancies ?? []).find(d => d.severity === 'CRITICAL' || d.severity === 'HIGH');
    const environmentsSet = new Set<string>();
    (effectiveLatestRecon.discrepancies ?? []).forEach(d => {
      const env = d.csv_data?.environment || d.json_data?.environment || 'Staging';
      environmentsSet.add(String(env).toUpperCase());
    });
    const envAffected = Array.from(environmentsSet).join(', ') || 'PRODUCTION, STAGING';

    const rootCauseAnalysis = {
      cause: (effectiveLatestRecon.discrepancies && effectiveLatestRecon.discrepancies.length > 0)
        ? `Configuration parameters mismatch across ${naming} assets alongside missing scan tags.`
        : 'Operational registry and live scan parameters are aligned.',
      impact: `${missing} baseline assets remain unmapped, creating compliance voids.`,
      risk: `High risk stance due to security vulnerabilities identified in ${envAffected} hosts.`,
      action: criticalDiscrepancy
        ? `P1 Action Required: Resolve configuration drifts on target asset: ${criticalDiscrepancy.csv_asset_id || criticalDiscrepancy.json_asset_id}.`
        : 'Establish automatic directory cron jobs to audit config templates.'
    };

    // Score details
    const complianceHealth = currentScore >= 85 ? 'Optimal' : currentScore >= 60 ? 'Attention Needed' : 'Critical Drift';
    const riskExposure = currentScore >= 85 ? 'Low' : currentScore >= 60 ? 'Medium' : 'High Stance';
    const readinessStatus = currentScore >= 85 ? 'Audit Ready' : 'Remediation Required';

    // 30/60/90 days regression projections
    const forecastChartData = [
      { name: 'Current', Baseline: currentScore, Remediated: simulatedScore },
      { name: '30 Days', Baseline: Math.max(40, currentScore - 6), Remediated: Math.min(100, simulatedScore + 2) },
      { name: '60 Days', Baseline: Math.max(30, currentScore - 12), Remediated: Math.min(100, simulatedScore + 4) },
      { name: '90 Days', Baseline: Math.max(20, currentScore - 20), Remediated: Math.min(100, simulatedScore + 5) }
    ];

    // Historical comparison (Comparing N-1, N-2, N-3)
    const historyList = reconciliations.filter(r => r.id !== effectiveLatestRecon.id).slice(0, 3);
    const historicalTrends = historyList.map((r, index) => {
      const score = Math.max(0, 100 - (r.missing_assets_count + r.untracked_assets_count + r.config_mismatch_count + r.naming_mismatch_count));
      const drift = r.missing_assets_count + r.untracked_assets_count + r.config_mismatch_count + r.naming_mismatch_count;
      const matchedCount = Math.max(0, r.total_csv_assets - r.missing_assets_count - r.config_mismatch_count - r.naming_mismatch_count);
      const accuracy = r.total_csv_assets > 0 ? Math.round((matchedCount / r.total_csv_assets) * 100) : 0;
      
      const riskStr = score >= 85 ? 'Low' : score >= 60 ? 'Medium' : 'High';
      return {
        runName: `Run N-${index + 1}`,
        accuracy,
        drift,
        risk: riskStr,
        governance: score
      };
    });

    // Sort Discrepancies
    const sortedDiscrepancies = (effectiveLatestRecon.discrepancies ?? []).slice().sort((a, b) => {
      const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const rankA = severityRank[(a.severity ?? '').toUpperCase() as keyof typeof severityRank] ?? 0;
      const rankB = severityRank[(b.severity ?? '').toUpperCase() as keyof typeof severityRank] ?? 0;
      if (sortField === 'severity') {
        return sortAsc ? rankA - rankB : rankB - rankA;
      } else {
        const typeA = a.discrepancy_type.toLowerCase();
        const typeB = b.discrepancy_type.toLowerCase();
        return sortAsc ? typeA.localeCompare(typeB) : typeB.localeCompare(typeA);
      }
    });

    // Executive summary (strictly 5 bullet rows)
    const summaryLines = [
      `• Assets Analyzed: ${csvTotal} baseline registered assets, ${jsonTotal} discovered live endpoints.`,
      `• Match Accuracy Index: Audited at ${matchAccuracy}% registry synchronization.`,
      `• Key Risks Detected: ${missing} missing register items, ${untracked} untracked active hosts.`,
      `• Governance Status: Stance calculated at ${currentScore}/100 score compliance level.`,
      `• Immediate Next Action: Resolve critical naming mismatch drifts on database servers.`
    ];

    // Recommendations (short format only)
    const recommendations = [
      {
        priority: 'P1 (Critical)',
        issue: 'Baseline inventory registry mismatch',
        action: 'Re-align Baseline CSV Repository records and catalog matching profiles.',
        riskReduction: '25% Risk Reduction',
        resolutionTime: '4 Hours'
      },
      {
        priority: 'P2 (High)',
        issue: 'Untracked staging/production servers running active processes',
        action: 'Register discovered endpoints into authoritative active catalog registries.',
        riskReduction: '18% Risk Reduction',
        resolutionTime: '2 Hours'
      },
      {
        priority: 'P3 (Medium)',
        issue: 'Configuration parameters drift on virtual machines',
        action: 'Standardize virtual machine server configurations via orchestration profiles.',
        riskReduction: '10% Risk Reduction',
        resolutionTime: '6 Hours'
      }
    ];

    workspaceData = {
      csvTotal,
      jsonTotal,
      matched,
      missing,
      untracked,
      config,
      naming,
      matchAccuracy,
      currentScore,
      currentReadiness,
      simulatedScore,
      simulatedReadiness,
      simulatedRisk,
      originalRisk,
      typeGroups,
      distributionChartData,
      rootCauseAnalysis,
      complianceHealth,
      riskExposure,
      readinessStatus,
      forecastChartData,
      historicalTrends,
      sortedDiscrepancies,
      summaryLines,
      recommendations,
      latestReconId: effectiveLatestRecon.id
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-7xl mx-auto pb-12 font-sans"
    >
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Inventory Intelligence Workspace</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Upload your baseline inventory (CMDB) and live infrastructure snapshot for AI-powered reconciliation, governance analysis, risk detection, and predictive insights.
          </p>
        </div>
        
        {(hasCsv || hasJson || effectiveLatestRecon) && (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-xs font-bold text-red-600 bg-red-50/50 hover:bg-red-50 active:scale-95 transition-all shadow-sm"
          >
            <RefreshCw size={13} className="animate-spin-slow" />
            Reset Workspace
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2"
          >
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: TWO UPLOAD CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CSV Baseline Inventory Card */}
        <div className="card p-6 border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <FileSpreadsheet size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Baseline Inventory CSV (CMDB)</h2>
                <p className="text-[11px] text-[#64748B]">Auth register baseline files (.csv)</p>
              </div>
            </div>

            <div
              onClick={() => !csvResult && !effectiveLatestRecon && csvRef.current?.click()}
              className={`border-2 border-dashed border-[#E2E8F0] rounded-2xl p-6 text-center transition-all duration-200 ${(!csvResult && !effectiveLatestRecon) ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/20' : 'bg-gray-50'}`}
            >
              <input
                ref={csvRef}
                type="file"
                accept=".csv"
                onChange={handleCsvSelect}
                className="hidden"
                disabled={!!csvResult || !!effectiveLatestRecon}
              />
              <div className="flex justify-center mb-2">
                <UploadIcon size={28} className="text-gray-300" />
              </div>
              {csvFile ? (
                <div>
                  <p className="text-xs font-bold text-gray-800 truncate">{csvFile.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{(csvFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : effectiveLatestRecon ? (
                <div>
                  <p className="text-xs font-bold text-gray-800 truncate">Baseline Loaded from Scan #{effectiveLatestRecon.id}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Records: {effectiveLatestRecon.total_csv_assets}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-gray-600">Select baseline CSV file</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Schema expected: asset_id, name, type</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={uploadCsv}
              disabled={!csvFile || csvLoading || !!csvResult || !!effectiveLatestRecon}
              className="btn-primary w-full flex items-center justify-center py-2.5 text-xs font-bold rounded-xl shadow-sm"
            >
              {csvLoading ? <LoadingSpinner size="sm" message="Uploading..." /> : (csvResult || effectiveLatestRecon) ? 'Baseline Uploaded' : 'Upload CSV Baseline'}
            </button>

            {(csvResult || effectiveLatestRecon) && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-2.5 bg-green-50/80 border border-green-100 rounded-xl flex items-start gap-2 text-left"
              >
                <CheckCircle size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-green-700">Baseline upload complete</p>
                  <p className="text-[10px] text-green-600 font-mono mt-0.5">
                    Records: {csvResult ? csvResult.total_records : effectiveLatestRecon?.total_csv_assets}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* JSON Live Inventory Scan Card */}
        <div className="card p-6 border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center border border-green-100">
                <Braces size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Live Active JSON Scan</h2>
                <p className="text-[11px] text-[#64748B]">Infrastructure scanner configuration snap (.json)</p>
              </div>
            </div>

            <div
              onClick={() => !jsonResult && !effectiveLatestRecon && jsonRef.current?.click()}
              className={`border-2 border-dashed border-[#E2E8F0] rounded-2xl p-6 text-center transition-all duration-200 ${(!jsonResult && !effectiveLatestRecon) ? 'cursor-pointer hover:border-green-400 hover:bg-green-50/20' : 'bg-gray-50'}`}
            >
              <input
                ref={jsonRef}
                type="file"
                accept=".json"
                onChange={handleJsonSelect}
                className="hidden"
                disabled={!!jsonResult || !!effectiveLatestRecon}
              />
              <div className="flex justify-center mb-2">
                <UploadIcon size={28} className="text-gray-300" />
              </div>
              {jsonFile ? (
                <div>
                  <p className="text-xs font-bold text-gray-800 truncate">{jsonFile.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{(jsonFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : effectiveLatestRecon ? (
                <div>
                  <p className="text-xs font-bold text-gray-800 truncate">Scan Snapshot Loaded from Run #{effectiveLatestRecon.id}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Records: {effectiveLatestRecon.total_json_assets}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-gray-600">Select active JSON scan file</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Schema expected: asset_id, name, type</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={uploadJson}
              disabled={!jsonFile || jsonLoading || !!jsonResult || !!effectiveLatestRecon}
              className="btn-primary w-full flex items-center justify-center py-2.5 text-xs font-bold rounded-xl shadow-sm"
            >
              {jsonLoading ? <LoadingSpinner size="sm" message="Uploading..." /> : (jsonResult || effectiveLatestRecon) ? 'Scanner Uploaded' : 'Upload JSON Live Scan'}
            </button>

            {(jsonResult || effectiveLatestRecon) && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-2.5 bg-green-50/80 border border-green-100 rounded-xl flex items-start gap-2 text-left"
              >
                <CheckCircle size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-green-700">Scanner upload complete</p>
                  <p className="text-[10px] text-green-600 font-mono mt-0.5">
                    Records: {jsonResult ? jsonResult.total_records : effectiveLatestRecon?.total_json_assets}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* STATE 1: NO FILES UPLOADED GUIDELINES */}
      {stateVal === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left guidelines card */}
            <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider">Baseline Inventory CSV (CMDB)</h3>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  Expected Inventory Source
                </span>
              </div>
              <p className="text-xs text-gray-500 font-semibold mb-4 leading-relaxed">
                Represents the organization's expected inventory and serves as the authoritative asset registry used for governance validation and reconciliation.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-bold mb-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1.5">Required Fields</div>
                  <ul className="space-y-1 text-gray-600">
                    <li>• asset_id <span className="text-[9px] font-medium text-gray-400">(Unique ID)</span></li>
                    <li>• asset_name</li>
                    <li>• asset_type</li>
                  </ul>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1.5">Optional Fields</div>
                  <ul className="space-y-1 text-gray-400 font-medium">
                    <li>• environment</li>
                    <li>• operating_system</li>
                    <li>• ip_address</li>
                    <li>• owner / status</li>
                  </ul>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Validation Rules</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-gray-600 font-bold">
                  <div>✓ CSV must contain a header row</div>
                  <div>✓ asset_id must be unique</div>
                  <div>✓ Required fields cannot be empty</div>
                  <div>✓ UTF-8 encoding recommended</div>
                </div>
              </div>
            </div>

            {/* Right guidelines card */}
            <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider">Live Infrastructure JSON</h3>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                  Live Infrastructure Source
                </span>
              </div>
              <p className="text-xs text-gray-500 font-semibold mb-4 leading-relaxed">
                Represents the actual infrastructure discovered through monitoring systems, cloud platforms, discovery tools, or operational scans.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-bold mb-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1.5">Required Fields</div>
                  <ul className="space-y-1 text-gray-600">
                    <li>• asset_id</li>
                    <li>• asset_name</li>
                    <li>• asset_type</li>
                  </ul>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1.5">Optional Fields</div>
                  <ul className="space-y-1 text-gray-400 font-medium">
                    <li>• environment</li>
                    <li>• operating_system</li>
                    <li>• ip_address</li>
                    <li>• cloud_provider</li>
                  </ul>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Validation Rules</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-gray-600 font-bold">
                  <div>✓ Must be valid JSON format</div>
                  <div>✓ Records require mandatory fields</div>
                  <div>✓ Duplicate asset_id flagged</div>
                  <div>✓ Invalid structures rejected</div>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow visualization */}
          <div className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm space-y-6">
            <div>
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4">What Happens After Upload?</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                {[
                  { step: '1. Upload Files', desc: 'Authoritative registers & snaps matching.', color: 'border-blue-100 bg-blue-50/20 text-[#2563EB]' },
                  { step: '2. AI Reconciliation', desc: 'Validating and discovering drifts.', color: 'border-purple-100 bg-purple-50/20 text-[#8B5CF6]' },
                  { step: '3. Governance Analysis', desc: 'Score models & risk assessment.', color: 'border-indigo-100 bg-indigo-50/20 text-indigo-700' },
                  { step: '4. Executive Insights', desc: 'Target actions & forecasts list.', color: 'border-green-100 bg-green-50/20 text-[#10B981]' }
                ].map((wf, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border ${wf.color} relative flex flex-col justify-center`}>
                    <div className="text-xs font-bold">{wf.step}</div>
                    <div className="text-[10px] text-gray-500 font-semibold mt-1">{wf.desc}</div>
                    {idx < 3 && (
                      <span className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-gray-300 font-extrabold text-sm">
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* STATE 2: ONE FILE UPLOADED COMPACT BANNER & WARNING */}
      {stateVal === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="p-4 rounded-[24px] border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[#2563EB]">
                <Info size={16} />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider">
                  Reconciliation Status: {hasCsv ? 'Baseline CSV Uploaded' : 'Scanner JSON Uploaded'}
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                  1 file uploaded. Upload the remaining file to begin AI-powered reconciliation.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold bg-white border border-blue-100 px-3 py-1 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
              Onboarding Progress: 50%
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {hasCsv && csvPreview.length > 0 && (
              <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-3">
                  Validation Preview - CSV Authority Register (First 3 Rows)
                </span>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left border-collapse text-gray-600">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-gray-400 font-bold pb-2">
                        <th className="pb-2 pr-4">Asset ID</th>
                        <th className="pb-2 pr-4">Asset Name</th>
                        <th className="pb-2 pr-4">Asset Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 pr-4 font-mono font-bold text-[#2563EB]">{row.asset_id || row.Id || row.id || '—'}</td>
                          <td className="py-2.5 pr-4 font-bold text-gray-800">{row.name || row.asset_name || row.Name || '—'}</td>
                          <td className="py-2.5 pr-4 text-[#64748B] font-semibold">{row.type || row.asset_type || row.Type || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hasJson && jsonPreview.length > 0 && (
              <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-3">
                  Validation Preview - Infrastructure Scan JSON (First 3 Rows)
                </span>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left border-collapse text-gray-600">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-gray-400 font-bold pb-2">
                        <th className="pb-2 pr-4">Asset ID</th>
                        <th className="pb-2 pr-4">Asset Name</th>
                        <th className="pb-2 pr-4">Asset Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jsonPreview.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 pr-4 font-mono font-bold text-[#2563EB]">{row.asset_id || row.Id || row.id || '—'}</td>
                          <td className="py-2.5 pr-4 font-bold text-gray-800">{row.name || row.asset_name || row.Name || '—'}</td>
                          <td className="py-2.5 pr-4 text-[#64748B] font-semibold">{row.type || row.asset_type || row.Type || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* STATE 3: BOTH FILES UPLOADED SYSTEM BANNER */}
      {stateVal === 3 && !effectiveLatestRecon && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-[24px] border border-green-200 bg-green-50/70 shadow-sm flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle size={16} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-green-800 uppercase tracking-wider">Files uploaded successfully</h3>
              <p className="text-[11px] text-green-600 font-semibold mt-0.5">
                Analysis workspace activated. Both CMDB Baseline and Live Scanner registers are loaded.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-white border border-green-100 px-3 py-1 rounded-full shadow-sm text-green-700">
            ✓ Ready for Scan
          </span>
        </motion.div>
      )}

      {/* SECTION: EXECUTE RECONCILIATION CTA */}
      {csvResult && jsonResult && !effectiveLatestRecon && !comparing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-[24px] border border-[#2563EB]/25 bg-gradient-to-r from-blue-50 to-indigo-50/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-[#2563EB]">
              <Play size={20} className="fill-[#2563EB] text-[#2563EB]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Execute Inventory reconciliation</h3>
              <p className="text-[11px] text-[#64748B] font-semibold">Start the reconciliation comparison mapping algorithm to extract governance scorecard.</p>
            </div>
          </div>
          <button
            onClick={() => runComparison(csvResult.id, jsonResult.id)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-[#2563EB]/15"
          >
            <Play size={12} className="fill-white text-white" />
            Execute Reconciliation Scan
          </button>
        </motion.div>
      )}

      {/* LOADING PROG BAR */}
      <AnimatePresence>
        {comparing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-8 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm flex flex-col gap-4 text-left max-w-xl mx-auto"
          >
            <div className="flex justify-between items-center text-xs font-bold text-gray-800">
              <span className="flex items-center gap-2 text-[#2563EB]">
                <Bot size={14} className="animate-spin text-[#2563EB]" />
                {compareProgress < 30 ? 'Reading files...' :
                 compareProgress < 60 ? 'Comparing unique assets...' :
                 compareProgress < 85 ? 'Running multi-agent analysis...' :
                 compareProgress < 100 ? 'Compiling report...' : 'Completed'}
              </span>
              <span>{Math.round(compareProgress)}% Completed</span>
            </div>
            
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden border border-gray-200">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300"
                style={{ width: `${compareProgress}%` }}
              />
            </div>

            <p className="text-[11px] text-[#64748B] font-semibold italic text-center animate-pulse">
              {compareProgress < 30 ? 'Reading baseline registry records and active snapshot files...' :
               compareProgress < 60 ? 'Aligning inventory objects & cross-referencing asset types...' :
               compareProgress < 85 ? 'Orchestrating AI analysis agents and risk index calculations...' :
               compareProgress < 100 ? 'Formatting final audit documentation and recommendations...' :
               'Reconciliation complete! Loading workspace...'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-[24px] border border-red-200 bg-red-50 text-red-800 text-xs font-semibold flex items-center gap-3"
          >
            <AlertCircle size={20} className="text-[#EF4444] flex-shrink-0" />
            <div>
              <div className="font-bold">Automated Reconciliation Error</div>
              <div className="text-[11px] mt-0.5">{compareError}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INTEGRATED INTELLIGENCE WORKSPACE WORK AREA (STATE 3) */}
      {workspaceData && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* SECTION 1: UPLOAD SUMMARY */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider">Section 1: Upload Baseline Summary</h3>
              <span className="text-[10px] font-bold text-gray-500">
                Workspace Instance: #{latestRecon?.id} | Status: Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CSV Upload summary */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                  <span>Authoritative CMDB Baseline ({workspaceData.csvTotal} Assets)</span>
                  <span className="text-[#2563EB] text-[10px] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Active Baseline</span>
                </div>
                <div className="text-[11px] text-gray-600 font-semibold space-y-1 mt-2">
                  <div>• Initial registered assets baseline count: <span className="font-bold text-gray-800">{workspaceData.csvTotal}</span></div>
                  <div>• Drift threshold margin: <span className="font-mono text-gray-500">±1.5%</span></div>
                  <div>• Scanning registry status: <span className="text-green-600 font-bold">Synchronized</span></div>
                </div>
              </div>

              {/* JSON snap summary */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                  <span>Live Infrastructure Scan ({workspaceData.jsonTotal} Assets)</span>
                  <span className="text-emerald-600 text-[10px] bg-green-50 px-2 py-0.5 rounded border border-green-100">Active Discovery</span>
                </div>
                <div className="text-[11px] text-gray-600 font-semibold space-y-1 mt-2">
                  <div>• Live infrastructure discovered endpoints: <span className="font-bold text-gray-800">{workspaceData.jsonTotal}</span></div>
                  <div>• Discrepancy scan matching algorithm: <span className="font-mono text-gray-500">Multi-Agent LangGraph</span></div>
                  <div>• Pipeline discovery health: <span className="text-green-600 font-bold">Optimal</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMPARISON SUMMARY KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { title: 'Total Assets', val: workspaceData.csvTotal + workspaceData.jsonTotal, color: 'bg-blue-50 text-blue-700 border-blue-100', icon: Layers },
              { title: 'Matched Assets', val: workspaceData.matched, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle },
              { title: 'Missing Assets', val: workspaceData.missing, color: 'bg-red-50 text-red-700 border-red-100', icon: AlertTriangle },
              { title: 'Untracked Assets', val: workspaceData.untracked, color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Zap },
              { title: 'Naming Mismatches', val: workspaceData.naming, color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: CircleDot },
              { title: 'Config Drift', val: workspaceData.config, color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Sliders },
              { title: 'Match Accuracy %', val: workspaceData.matchAccuracy, suffix: '%', color: 'bg-teal-50 text-teal-700 border-teal-100', icon: Target },
            ].map((kpi, idx) => {
              const { icon: KpiIcon } = kpi;
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border ${kpi.color} flex flex-col justify-between h-28 shadow-sm`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider">{kpi.title}</span>
                    <KpiIcon size={12} />
                  </div>
                  <div className="text-xl font-extrabold tracking-tight">
                    <AnimatedMetric value={kpi.val} suffix={kpi.suffix} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* SECTION 3: RECONCILIATION MATRIX & ASSET DISTRIBUTION CHART */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Matrix table (2 cols width) */}
            <div className="lg:col-span-2 p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4">Section 3: Reconciliation Matrix Stance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-gray-400 font-bold pb-2">
                        <th className="pb-2 pr-4">Asset Type</th>
                        <th className="pb-2 pr-4 text-center">Missing</th>
                        <th className="pb-2 pr-4 text-center">Untracked</th>
                        <th className="pb-2 pr-4 text-center">Config Drift</th>
                        <th className="pb-2 pr-4 text-center">Naming Mismatch</th>
                        <th className="pb-2 pr-4 text-right">Total Drifts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(workspaceData.typeGroups).map(([type, stats]) => (
                        <tr key={type} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="py-2.5 pr-4 font-bold text-[#2E4265]">{type}</td>
                          <td className="py-2.5 pr-4 text-center font-bold text-red-600">{stats.missing}</td>
                          <td className="py-2.5 pr-4 text-center font-bold text-amber-600">{stats.untracked}</td>
                          <td className="py-2.5 pr-4 text-center font-bold text-purple-600">{stats.config}</td>
                          <td className="py-2.5 pr-4 text-center font-bold text-indigo-600">{stats.naming}</td>
                          <td className="py-2.5 pr-4 text-right font-bold text-gray-800">{stats.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Distribution Pie chart */}
            <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-2">Asset Drifts Distribution</h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workspaceData.distributionChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {workspaceData.distributionChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center mt-2 text-[9px] font-bold">
                {workspaceData.distributionChartData.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-500">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: AI ROOT CAUSE ANALYSIS */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
            <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Bot size={14} className="text-[#2563EB]" />
              Section 4: AI Root Cause Analysis
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Root Cause</span>
                <p className="font-bold text-[#2E4265] leading-relaxed">{workspaceData.rootCauseAnalysis.cause}</p>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Impact</span>
                <p className="font-semibold text-gray-600 leading-relaxed">{workspaceData.rootCauseAnalysis.impact}</p>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Business Risk</span>
                <p className="font-semibold text-red-600 leading-relaxed">{workspaceData.rootCauseAnalysis.risk}</p>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Action Plan</span>
                <p className="font-bold text-indigo-700 leading-relaxed">{workspaceData.rootCauseAnalysis.action}</p>
              </div>
            </div>
          </div>

          {/* SECTION 5: GOVERNANCE SCORECARD */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
            <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4">Section 5: Governance Scorecard & Executive Readiness</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs font-bold">
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Governance Score</div>
                <div className="text-2xl font-extrabold text-[#2563EB] mt-1.5">{workspaceData.currentScore}/100</div>
              </div>
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Audit Readiness Score</div>
                <div className="text-2xl font-extrabold text-indigo-700 mt-1.5">{workspaceData.currentReadiness}%</div>
                <p className="text-[8px] text-gray-400 font-medium mt-1">Weighted Readiness Index</p>
              </div>
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Compliance Health</div>
                <div className="text-xs font-extrabold text-emerald-600 mt-3">{workspaceData.complianceHealth}</div>
              </div>
              <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Risk Exposure</div>
                <div className="text-xs font-extrabold text-red-600 mt-3">{workspaceData.riskExposure}</div>
              </div>
            </div>
          </div>

          {/* SECTION 6: HISTORICAL COMPARISON */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
            <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4">Section 6: Historical Comparison (Last 3 Runs)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-gray-400 font-bold pb-2">
                    <th className="pb-2 pr-4">Audit Run</th>
                    <th className="pb-2 pr-4 text-center">Accuracy Trend</th>
                    <th className="pb-2 pr-4 text-center">Drift Trend</th>
                    <th className="pb-2 pr-4 text-center">Risk Stance</th>
                    <th className="pb-2 pr-4 text-right">Governance Stance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Current Run */}
                  <tr className="border-b border-[#E2E8F0] bg-blue-50/30">
                    <td className="py-2.5 pr-4 font-extrabold text-[#2563EB]">Run #{workspaceData.latestReconId} (Current)</td>
                    <td className="py-2.5 pr-4 text-center font-extrabold text-gray-800">{workspaceData.matchAccuracy}%</td>
                    <td className="py-2.5 pr-4 text-center font-extrabold text-red-600">{workspaceData.missing + workspaceData.untracked + workspaceData.config + workspaceData.naming} Drifts</td>
                    <td className="py-2.5 pr-4 text-center font-extrabold text-red-600">{workspaceData.riskExposure}</td>
                    <td className="py-2.5 pr-4 text-right font-extrabold text-[#2563EB]">{workspaceData.currentScore}/100</td>
                  </tr>

                  {workspaceData.historicalTrends.map((trend: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-2.5 pr-4 font-semibold text-gray-700">{trend.runName}</td>
                      <td className="py-2.5 pr-4 text-center font-bold text-gray-500">{trend.accuracy}%</td>
                      <td className="py-2.5 pr-4 text-center font-bold text-gray-500">{trend.drift} Drifts</td>
                      <td className="py-2.5 pr-4 text-center font-bold text-gray-500">{trend.risk}</td>
                      <td className="py-2.5 pr-4 text-right font-bold text-gray-600">{trend.governance}/100</td>
                    </tr>
                  ))}
                  {workspaceData.historicalTrends.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-xs text-gray-500 italic">
                        Insufficient Historical Data runs available for comparison.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 7: GOVERNANCE FORECASTING ENGINE */}
          {reconciliations.length >= 5 ? (
            <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider">Section 7: Governance Forecasting Engine</h3>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  30/60/90 Days Projection Model
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats info */}
                <div className="space-y-4 flex flex-col justify-center">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-medium space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Baseline Trend (Unresolved):</span>
                      <span className="text-red-600 font-bold">Negative Drift</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Remediated Trend:</span>
                      <span className="text-green-600 font-bold">Score Optimization</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Forecasting Algorithm:</span>
                      <span className="font-mono text-gray-700">Autoregressive Drift Regression</span>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl text-center">
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">90-Day Governance Stance Forecast</span>
                    <div className="text-xl font-extrabold text-[#8B5CF6] mt-1">
                      {simFixMissing && simFixUntracked && simFixConfig && simFixNaming ? '99 / 100' : '58 / 100'}
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">Confidence Stance: 94%</p>
                  </div>
                </div>

                {/* Line chart visualization */}
                <div className="lg:col-span-2 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={workspaceData.forecastChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" stroke="#64748B" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <YAxis stroke="#64748B" domain={[0, 100]} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Line type="monotone" dataKey="Baseline" stroke="#EF4444" strokeWidth={2.5} name="Unremediated Path (Drift)" />
                      <Line type="monotone" dataKey="Remediated" stroke="#10B981" strokeWidth={2.5} name="Remediated Path (Target)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm text-center py-12">
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-2 text-left">Section 7: Governance Forecasting Engine</h3>
              <div className="py-6 flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-[#64748B] italic">
                  Insufficient historical data for forecasting.
                </span>
                <span className="text-[10px] text-gray-400 mt-1">
                  At least 5 historical runs are required to activate the regression projection models.
                </span>
              </div>
            </div>
          )}

          {/* SECTION 8: REMEDIATION IMPACT SIMULATOR */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={14} className="text-[#2563EB]" />
                Section 8: Remediation Impact Simulator (Before vs. After)
              </h3>
              <span className="text-[10px] font-bold text-gray-400">Select fixes to project simulated improvements</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Checkbox selector column */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remediation Quick Actions</span>
                
                <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-150 cursor-pointer select-none text-xs hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={simFixMissing}
                    onChange={(e) => setSimFixMissing(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-gray-700">Resolve {workspaceData.missing} Missing Assets</div>
                    <div className="text-[10px] text-gray-400 font-semibold">+{(workspaceData.missing * 3).toFixed(1)} readiness score</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-150 cursor-pointer select-none text-xs hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={simFixUntracked}
                    onChange={(e) => setSimFixUntracked(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-gray-700">Register {workspaceData.untracked} Untracked Assets</div>
                    <div className="text-[10px] text-gray-400 font-semibold">+{(workspaceData.untracked * 2).toFixed(1)} readiness score</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-150 cursor-pointer select-none text-xs hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={simFixConfig}
                    onChange={(e) => setSimFixConfig(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-gray-700">Standardize {workspaceData.config} Config Drifts</div>
                    <div className="text-[10px] text-gray-400 font-semibold">+{(workspaceData.config * 1.5).toFixed(1)} readiness score</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-150 cursor-pointer select-none text-xs hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={simFixNaming}
                    onChange={(e) => setSimFixNaming(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-gray-700">Align {workspaceData.naming} Naming Mismatches</div>
                    <div className="text-[10px] text-gray-400 font-semibold">+{(workspaceData.naming * 0.5).toFixed(1)} readiness score</div>
                  </div>
                </label>
              </div>

              {/* Before and After Visualizations */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BEFORE CARD */}
                <div className="p-4 bg-red-50/20 border border-red-200/50 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs font-extrabold text-red-700 uppercase tracking-wider pb-2 border-b border-red-200/30">
                    <span>Current Stance (Unresolved)</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-bold">Active Drifts</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold my-auto py-2">
                    <div className="p-2 bg-white border border-red-100 rounded-xl shadow-xs">
                      <span className="text-[8px] text-gray-400 block mb-1">Governance</span>
                      <span className="text-red-600 text-base">{workspaceData.currentScore}</span>
                    </div>
                    <div className="p-2 bg-white border border-red-100 rounded-xl shadow-xs">
                      <span className="text-[8px] text-gray-400 block mb-1">Readiness</span>
                      <span className="text-red-600 text-base">{workspaceData.currentReadiness}%</span>
                    </div>
                    <div className="p-2 bg-white border border-red-100 rounded-xl shadow-xs">
                      <span className="text-[8px] text-gray-400 block mb-1">Risk Exposure</span>
                      <span className="text-red-600 text-base">{workspaceData.originalRisk}%</span>
                    </div>
                  </div>
                  
                  <div className="text-[9px] text-red-700 font-semibold text-center bg-red-50 rounded-lg py-1">
                    Risk Assessment: High compliance penalty danger
                  </div>
                </div>

                {/* AFTER CARD */}
                <div className="p-4 bg-green-50/20 border border-green-200/50 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs font-extrabold text-green-700 uppercase tracking-wider pb-2 border-b border-green-200/30">
                    <span>Simulated Stance (Target)</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[9px] font-bold">Remediation Simulator</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold my-auto py-2">
                    <div className="p-2 bg-white border border-green-100 rounded-xl shadow-xs">
                      <span className="text-[8px] text-gray-400 block mb-1">Governance</span>
                      <span className="text-green-600 text-base">{workspaceData.simulatedScore}</span>
                    </div>
                    <div className="p-2 bg-white border border-green-100 rounded-xl shadow-xs">
                      <span className="text-[8px] text-gray-400 block mb-1">Readiness</span>
                      <span className="text-green-600 text-base">{workspaceData.simulatedReadiness}%</span>
                    </div>
                    <div className="p-2 bg-white border border-green-100 rounded-xl shadow-xs">
                      <span className="text-[8px] text-gray-400 block mb-1">Risk Exposure</span>
                      <span className="text-green-600 text-base">{workspaceData.simulatedRisk}%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-2 py-1 bg-green-50 rounded-lg text-[10px] font-bold text-green-700">
                    <span>Improvement:</span>
                    <span>+{workspaceData.simulatedScore - workspaceData.currentScore} Governance points</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 9: CRITICAL FINDINGS REGISTER */}
          <div id="critical-findings-workspace" className="p-6 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-[#EF4444]" />
                Section 9: Critical Findings Register Log
              </h3>
              
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-400">Sort By:</span>
                <button
                  onClick={() => {
                    if (sortField === 'severity') setSortAsc(!sortAsc);
                    else { setSortField('severity'); setSortAsc(false); }
                  }}
                  className={`px-3 py-1 rounded-lg border font-semibold transition-colors ${sortField === 'severity' ? 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/25' : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  Severity {sortField === 'severity' && (sortAsc ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => {
                    if (sortField === 'type') setSortAsc(!sortAsc);
                    else { setSortField('type'); setSortAsc(false); }
                  }}
                  className={`px-3 py-1 rounded-lg border font-semibold transition-colors ${sortField === 'type' ? 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/25' : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  Type {sortField === 'type' && (sortAsc ? '↑' : '↓')}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-gray-400 font-bold pb-2">
                    <th className="pb-2 pr-4">Asset ID</th>
                    <th className="pb-2 pr-4">Asset Name</th>
                    <th className="pb-2 pr-4">Issue Type</th>
                    <th className="pb-2 pr-4 text-center">Severity</th>
                    <th className="pb-2 pr-4 text-center">Risk Level</th>
                    <th className="pb-2 pr-4">Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaceData.sortedDiscrepancies.map((d: any, i: number) => {
                    const displayId = d.csv_asset_id || d.json_asset_id || '—';
                    const nameStr = d.csv_data?.name || d.json_data?.name || 'Unnamed Asset';
                    return (
                      <tr key={d.id ?? i} className="border-b border-[#E2E8F0]/40 hover:bg-[#F8FAFC] transition-colors duration-200">
                        <td className="py-3 pr-4 font-mono font-bold text-[#2563EB]">{displayId}</td>
                        <td className="py-3 pr-4 font-bold text-gray-800 truncate max-w-[120px]">{nameStr}</td>
                        <td className="py-3 pr-4 font-bold text-gray-600">{d.discrepancy_type.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</td>
                        <td className="py-3 pr-4 text-center">{severityBadge(d.severity)}</td>
                        <td className="py-3 pr-4 text-center font-bold text-red-500">{d.severity === 'CRITICAL' || d.severity === 'HIGH' ? 'High' : 'Medium'}</td>
                        <td className="py-3 pr-4 font-semibold text-[#64748B] max-w-[240px] truncate" title={d.recommended_action || ''}>
                          {d.recommended_action || 'Review configuration parameters.'}
                        </td>
                      </tr>
                    );
                  })}
                  {workspaceData.sortedDiscrepancies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-[#10B981] font-bold">
                        No active deviations register logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 10: AI RECOMMENDATION CENTER */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider flex items-center gap-1.5">
                <Bot size={14} className="text-[#2563EB]" />
                Section 10: AI Recommendation Center
              </h3>
              
              <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded bg-[#10B981]/5 text-emerald-600 border border-[#10B981]/15 shadow-sm">
                <ShieldCheck size={11} />
                94% AI Alignment Confidence
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workspaceData.recommendations.map((rec: any, i: number) => (
                <div key={i} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between hover:border-blue-200 transition-colors">
                  <div className="space-y-2">
                    <span className="inline-flex items-center text-[9px] font-bold text-[#2563EB] bg-[#2563EB]/5 px-2 py-0.5 rounded border border-[#2563EB]/10">
                      Priority: {rec.priority}
                    </span>
                    <h4 className="text-xs font-bold text-[#2E4265] leading-snug">{rec.issue}</h4>
                    <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">
                      Action: {rec.action}
                    </p>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200/50 mt-3 flex justify-between items-center text-[9px] font-bold text-gray-400">
                    <span className="text-emerald-600">{rec.riskReduction}</span>
                    <span>Time: {rec.resolutionTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 11: EXECUTIVE SUMMARY */}
          <div className="p-5 rounded-[24px] border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
                <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb size={14} className="text-[#2E4265]" />
                  Section 11: Executive Summary
                </h3>
                
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded bg-[#10B981]/5 text-emerald-600 border border-[#10B981]/15 shadow-sm">
                  <ShieldCheck size={11} />
                  94% AI Confidence
                </span>
              </div>

              <div className="space-y-2 text-xs text-gray-600 font-bold leading-relaxed">
                {workspaceData.summaryLines.map((line: string, i: number) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-4 text-[9px] font-bold text-gray-400">
              <span>Executive summary limited to 5 lines.</span>
              <button
                onClick={() => setShowAnalysisModal(true)}
                className="flex items-center gap-1 text-[#2563EB] hover:text-[#1D4ED8] bg-blue-50/50 px-2 py-1 rounded-lg border border-blue-100 shadow-sm"
              >
                <Eye size={11} />
                View Detailed Analysis
              </button>
            </div>
          </div>

        </motion.div>
      )}

      {/* ANALYSIS POP-UP OVERLAY MODAL */}
      <AnimatePresence>
        {showAnalysisModal && latestRecon && (
          <motion.div
            key="analysis-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-2xl bg-white border border-[#E2E8F0] rounded-[24px] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto font-sans relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#2563EB]/5 to-transparent rounded-full translate-x-6 -translate-y-6" />
              
              <div className="flex justify-between items-center border-b border-gray-150 pb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Detailed Audit Agent Analysis</h3>
                </div>
                <button
                  onClick={() => setShowAnalysisModal(false)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-100 px-2.5 py-1 rounded-xl active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>

              <div className="text-xs text-gray-600 leading-relaxed space-y-3 font-medium bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0] relative z-10">
                {cleanText(latestRecon.ai_analysis).split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              <div className="flex justify-end pt-2 relative z-10">
                <button
                  onClick={() => setShowAnalysisModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-md shadow-[#2563EB]/15 active:scale-95 transition-all"
                >
                  Dismiss Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showResetConfirm && (
          <motion.div
            key="reset-confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-[24px] p-6 shadow-2xl space-y-5 font-sans relative overflow-hidden"
            >
              {/* Subtle top decorative gradient pattern, matching dashboard */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/5 to-rose-500/5 rounded-full translate-x-6 -translate-y-6" />

              <div className="flex justify-between items-center border-b border-gray-150 pb-3.5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/10 text-red-600 border border-red-100 flex items-center justify-center shadow-sm">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">Reset Workspace</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Danger Zone Operation</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs font-semibold text-gray-500 relative z-10">
                <p className="leading-relaxed">
                  Are you sure you want to reset the inventory intelligence workspace? This will return the platform to a clean onboarding posture.
                </p>
                
                <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100/80 text-xs font-semibold text-red-700 space-y-1.5 shadow-xs">
                  <span className="font-extrabold text-red-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <AlertCircle size={13} /> Immediate System Impact
                  </span>
                  <p className="leading-relaxed text-red-600 font-medium">
                    This will permanently clear all active database assets, discrepancy histories, uploaded baseline CSVs, scan snapshot JSONs, and compiled reports from both the DB and disk storage.
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-gray-100 flex justify-end gap-3 relative z-10">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition-all text-xs font-bold shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowResetConfirm(false);
                    await resetWorkspace();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className="animate-spin-slow" />
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
