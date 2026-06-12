import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI, reportsAPI } from '../services/api';
import { downloadReportFile } from '../services/downloadService';
import { useReconStore } from '../stores/reconStore';
import { Reconciliation, Report } from '../types';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  GitCompareArrows,
  ChevronDown,
  ChevronUp,
  Bot,
  ClipboardList,
  AlertTriangle,
  Clock,
  Loader2,
  Download,
  Eye,
  LayoutDashboard,
  CheckCircle2,
  Layers,
  ShieldAlert,
  Target
} from 'lucide-react';

export default function ReconciliationPage() {
  const reconciliations = useReconStore((s) => s.reconciliations);
  const fetchReconciliations = useReconStore((s) => s.fetchReconciliations);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await fetchReconciliations();
      const reportsRes = await reportsAPI.list();
      setReports(reportsRes.data);
    } catch (err) {
      console.error('Failed to load reconciliations or reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDiscrepancyLabel = (type: string) => {
    const labels: Record<string, string> = {
      MISSING_ASSET: 'Missing Asset',
      UNTRACKED_ASSET: 'Untracked Asset',
      CONFIG_MISMATCH: 'Config Mismatch',
      NAMING_MISMATCH: 'Naming Mismatch',
    };
    return labels[type] || type;
  };

  const getSeverityColor = (sev: string | null) => {
    const map: Record<string, string> = {
      CRITICAL: 'text-red-700 bg-red-50 border-red-200',
      HIGH: 'text-red-600 bg-red-50/50 border-red-100',
      MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
      LOW: 'text-green-700 bg-green-50 border-green-200',
    };
    return map[(sev ?? '').toUpperCase()] ?? 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const triggerDownload = async (reconId: number) => {
    setDownloadingId(reconId);
    setError('');
    try {
      // 1. Locate or generate report
      let matchingReport = reports.find(r => r.reconciliation_id === reconId);
      if (!matchingReport) {
        // Automatically compile report on demand
        const genRes = await reportsAPI.generate(reconId);
        matchingReport = genRes.data;
        // Reload report list
        const reportsRes = await reportsAPI.list();
        setReports(reportsRes.data);
      }

      if (!matchingReport) {
        throw new Error('Could not compile report context.');
      }

      // 2. Download the compiled PDF blob
      await downloadReportFile(matchingReport.id);
    } catch (err: any) {
      setError('Unable to generate report. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <LoadingSpinner message="Loading reconciliation history..." />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto pb-12 font-sans"
    >
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Reconciliation History</h1>
        <p className="text-xs text-[#64748B] mt-1">
          Review historical inventory alignment runs, discrepancies log, cost risk levels, and download PDF reports.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {reconciliations.length === 0 ? (
        <div className="card p-16 text-center border border-[#E2E8F0] rounded-[24px] bg-white shadow-xs">
          <div className="flex justify-center mb-4">
            <GitCompareArrows size={48} className="text-gray-300" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">No Historical Audits Logged</h2>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6">
            Upload baseline registers and scanner snaps on the workspace page to trigger automated reconciliation runs.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary text-xs py-2.5 px-4 font-bold rounded-xl shadow-md"
          >
            Go to Workspace
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reconciliations.map((recon) => {
            const isSelected = selectedId === recon.id;
            
            // Accuracies and scores
            const csvTotal = recon.total_csv_assets || 0;
            const missing = recon.missing_assets_count || 0;
            const untracked = recon.untracked_assets_count || 0;
            const config = recon.config_mismatch_count || 0;
            const naming = recon.naming_mismatch_count || 0;
            
            const matched = Math.max(0, csvTotal - missing - config - naming);
            const accuracy = csvTotal > 0 ? Math.round((matched / csvTotal) * 100) : 0;
            const governanceScore = Math.max(0, 100 - (missing + untracked + config + naming));
            const readinessScore = Math.max(0, Math.round(100 - (missing * 3 + untracked * 2 + config * 1.5 + naming * 0.5)));

            // Risk Exposure score mapping
            const criticalCount = recon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'CRITICAL').length || 0;
            const highCount = recon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'HIGH').length || 0;
            const mediumCount = recon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'MEDIUM').length || 0;
            const lowCount = recon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'LOW').length || 0;
            const riskScore = Math.min(100, (criticalCount * 25) + (highCount * 15) + (mediumCount * 8) + (lowCount * 3));

            return (
              <motion.div
                key={recon.id}
                layout
                className={`card p-6 border rounded-[24px] bg-white shadow-sm transition-all duration-200 ${
                  isSelected ? 'border-[#2563EB]/40 ring-1 ring-[#2563EB]/10' : 'border-[#E2E8F0] hover:shadow-md'
                }`}
              >
                {/* Header row */}
                <div
                  onClick={() => setSelectedId(isSelected ? null : recon.id)}
                  className="flex items-center justify-between flex-wrap gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-blue-50 text-blue-700 border border-blue-100`}>
                      #{recon.id}
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A]">Reconciliation Scan Run ID: #{recon.id}</p>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                        CSV: <span className="font-mono text-blue-600 font-bold">{recon.csv_filename || 'Unknown'}</span> | JSON: <span className="font-mono text-green-600 font-bold">{recon.json_filename || 'Unknown'}</span>
                      </p>
                      <p className="text-[9px] text-gray-400 font-semibold mt-0.5">Timestamp: {formatDate(recon.started_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                      <Target size={11} />
                      {accuracy}% Accuracy
                    </span>
                    <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">
                      Gov Score: {governanceScore}/100
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                      riskScore > 35 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                      Risk Score: {riskScore}%
                    </span>
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                      Readiness: {readinessScore}%
                    </span>
                    
                    {isSelected ? <ChevronUp size={16} className="text-gray-400 ml-2" /> : <ChevronDown size={16} className="text-gray-400 ml-2" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 pt-6 border-t border-gray-100 space-y-6"
                  >
                    {/* Metrics grid overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs font-bold">
                      <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl">
                        <div className="text-[9px] text-gray-400 uppercase tracking-widest">Missing Assets</div>
                        <div className="text-lg text-red-600 mt-1">{missing}</div>
                      </div>
                      <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                        <div className="text-[9px] text-gray-400 uppercase tracking-widest">Untracked Assets</div>
                        <div className="text-lg text-amber-600 mt-1">{untracked}</div>
                      </div>
                      <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
                        <div className="text-[9px] text-gray-400 uppercase tracking-widest">Config Mismatches</div>
                        <div className="text-lg text-purple-600 mt-1">{config}</div>
                      </div>
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                        <div className="text-[9px] text-gray-400 uppercase tracking-widest">Naming Drifts</div>
                        <div className="text-lg text-indigo-600 mt-1">{naming}</div>
                      </div>
                    </div>

                    {/* AI analysis excerpt */}
                    {recon.ai_analysis && (
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot size={15} className="text-[#2563EB]" />
                          <h4 className="text-xs font-bold text-[#2E4265]">AI Analysis Summary</h4>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed font-semibold">
                          {recon.ai_analysis.length > 300 ? `${recon.ai_analysis.substring(0, 300)}...` : recon.ai_analysis}
                        </div>
                      </div>
                    )}

                    {/* Discrepancies Table preview */}
                    {recon.discrepancies && recon.discrepancies.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={15} className="text-[#2563EB]" />
                          <h4 className="text-xs font-bold text-[#0F172A]">Discrepancies Log ({recon.discrepancies.length})</h4>
                        </div>
                        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                                <th className="px-4 py-2.5">Type</th>
                                <th className="px-4 py-2.5 font-mono">CSV Asset ID</th>
                                <th className="px-4 py-2.5 font-mono">Live Asset ID</th>
                                <th className="px-4 py-2.5 text-center">Severity</th>
                                <th className="px-4 py-2.5">Recommended Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recon.discrepancies.slice(0, 5).map((d) => (
                                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 text-gray-600">
                                  <td className="px-4 py-3 font-bold">{getDiscrepancyLabel(d.discrepancy_type)}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-[#2563EB]">{d.csv_asset_id || '—'}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-gray-500">{d.json_asset_id || '—'}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityColor(d.severity)}`}>
                                      {d.severity || 'LOW'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-semibold truncate max-w-xs">{d.recommended_action || 'Review alignment.'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {recon.discrepancies.length > 5 && (
                          <div className="text-[10px] text-gray-400 text-right pr-2">
                            * Displaying top 5 of {recon.discrepancies.length} discrepancy records.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions block */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
                      >
                        <LayoutDashboard size={13} />
                        Open Dashboard Snapshot
                      </button>

                      <button
                        onClick={() => navigate('/reports')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 text-xs font-bold text-[#2563EB] bg-[#2563EB]/5 hover:bg-[#2563EB]/10 active:scale-95 transition-all shadow-xs"
                      >
                        <Eye size={13} />
                        View Report
                      </button>

                      <button
                        onClick={() => triggerDownload(recon.id)}
                        disabled={downloadingId === recon.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold disabled:bg-gray-100 disabled:text-gray-400 active:scale-95 transition-all shadow-md shadow-[#2563EB]/10"
                      >
                        {downloadingId === recon.id ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Compiling PDF...
                          </>
                        ) : (
                          <>
                            <Download size={13} />
                            Download PDF Report
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
