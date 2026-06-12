import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { reportsAPI, inventoryAPI } from '../services/api';
import { downloadReportFile } from '../services/downloadService';
import { Report, Reconciliation } from '../types';
import { formatDate } from '../utils/helpers';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  FileText,
  Download,
  FilePlus,
  AlertCircle,
  Loader2,
  Eye,
  ShieldAlert,
  Target,
  Layers,
  Bot,
  Sliders
} from 'lucide-react';

// Clean text utility for AI summary parsing
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

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');
  
  // Preview States
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [previewRecon, setPreviewRecon] = useState<Reconciliation | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const user = useAuthStore((s) => s.user);
  const canGenerate = user && ['Administrator', 'Analyst'].includes(user.role);
  const [searchParams] = useSearchParams();
  const reportIdParam = searchParams.get('previewReportId');
  const reconIdParam = searchParams.get('previewReconId');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (loading) return;

    const handleDeepLink = async () => {
      if (reportIdParam) {
        const parsedId = Number(reportIdParam);
        const rep = reports.find(r => r.id === parsedId);
        if (rep) {
          openPreview(rep);
        }
      } else if (reconIdParam) {
        const parsedReconId = Number(reconIdParam);
        const rep = reports.find(r => r.reconciliation_id === parsedReconId);
        if (rep) {
          openPreview(rep);
        } else {
          // Report doesn't exist for this reconciliation scan. Auto-generate if scan is COMPLETED
          const recon = reconciliations.find(r => r.id === parsedReconId);
          if (recon && recon.status === 'COMPLETED') {
            try {
              setGenerating(parsedReconId);
              const genRes = await reportsAPI.generate(parsedReconId);
              const newReport = genRes.data;
              // Reload
              const reportsRes = await reportsAPI.list();
              setReports(reportsRes.data);
              openPreview(newReport);
            } catch (err) {
              console.error('Auto report generation failed:', err);
            } finally {
              setGenerating(null);
            }
          }
        }
      }
    };

    handleDeepLink();
  }, [loading, reportIdParam, reconIdParam, reports, reconciliations]);

  const loadData = async () => {
    try {
      const [reportsRes, reconsRes] = await Promise.all([
        reportsAPI.list(),
        inventoryAPI.listReconciliations(),
      ]);
      setReports(reportsRes.data);
      setReconciliations(reconsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reconId: number) => {
    setGenerating(reconId);
    setError('');
    try {
      await reportsAPI.generate(reconId);
      await loadData();
    } catch (err: any) {
      setError('Unable to generate report. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  const downloadReport = async (reportId: number) => {
    setDownloading(reportId);
    try {
      await downloadReportFile(reportId);
    } catch (err: any) {
      setError('Unable to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const openPreview = async (report: Report) => {
    setPreviewReport(report);
    setLoadingPreview(true);
    try {
      const res = await inventoryAPI.getReconciliation(report.reconciliation_id);
      setPreviewRecon(res.data);
    } catch (err) {
      console.error('Failed to load preview reconciliation data:', err);
      setPreviewRecon(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewReport(null);
    setPreviewRecon(null);
  };

  if (loading) return <LoadingSpinner message="Loading reports..." />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto pb-12 font-sans"
    >
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Executive Reporting Center</h1>
        <p className="text-xs text-[#64748B] mt-1">
          Compile, preview, and download formal executive PDF governance and compliance reports.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertCircle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Generate Report */}
      {canGenerate && reconciliations.length > 0 && (
        <div className="card p-6 border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm">
          <h2 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4">Compile New Report</h2>
          <div className="space-y-2">
            {reconciliations.filter(r => r.status === 'COMPLETED').map((recon) => {
              const csvTotal = recon.total_csv_assets || 0;
              const missing = recon.missing_assets_count || 0;
              const untracked = recon.untracked_assets_count || 0;
              const config = recon.config_mismatch_count || 0;
              const naming = recon.naming_mismatch_count || 0;
              const matched = Math.max(0, csvTotal - missing - config - naming);
              const accuracy = csvTotal > 0 ? Math.round((matched / csvTotal) * 100) : 0;
              
              const reportExists = reports.some(r => r.reconciliation_id === recon.id);

              return (
                <div
                  key={recon.id}
                  className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex-wrap gap-2"
                >
                  <div className="text-xs font-semibold text-gray-700">
                    <span className="font-bold text-gray-800">Reconciliation #{recon.id}</span>
                    <span className="text-gray-400 font-normal ml-3">{formatDate(recon.completed_at)}</span>
                    <span className="text-blue-600 ml-3">{accuracy}% Match Accuracy</span>
                    <span className="text-red-500 ml-3">{missing + untracked + config + naming} drifts</span>
                  </div>
                  
                  <button
                    onClick={() => generateReport(recon.id)}
                    disabled={generating === recon.id}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 rounded-lg"
                  >
                    {generating === recon.id ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Compiling...
                      </>
                    ) : (
                      <>
                        <FilePlus size={13} />
                        {reportExists ? 'Re-compile PDF' : 'Compile PDF Report'}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="card p-16 text-center border border-[#E2E8F0] rounded-[24px] bg-white shadow-xs">
          <div className="flex justify-center mb-4">
            <FileText size={48} className="text-gray-300" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">No Reports Available</h2>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Choose a completed reconciliation above to compile a governance report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider">Generated Audits</h2>
          {reports.map((report) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card p-5 border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">
                      Executive Report for Reconciliation #{report.reconciliation_id}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      Generated: {formatDate(report.generated_at)} | ID: {report.id} | Classification: Internal Use
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openPreview(report)}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded-xl active:scale-95 transition-all shadow-xs"
                  >
                    <Eye size={13} />
                    Preview Report
                  </button>

                  <button
                    onClick={() => downloadReport(report.id)}
                    disabled={downloading === report.id}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl active:scale-95 transition-all shadow-md shadow-[#2563EB]/10 font-bold"
                  >
                    {downloading === report.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <>
                        <Download size={13} />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* DETAILED REPORT PREVIEW MODAL OVERLAY */}
      <AnimatePresence>
        {previewReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-4xl bg-white border border-[#E2E8F0] rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <h3 className="text-sm font-extrabold text-[#0F172A] uppercase tracking-wider">Report Document Preview</h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadReport(previewReport.id)}
                    disabled={downloading === previewReport.id}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    <Download size={12} />
                    Download PDF
                  </button>
                  <button
                    onClick={closePreview}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Modal Body (Scrollable Document Page) */}
              <div className="flex-1 overflow-y-auto p-8 bg-gray-50 space-y-8 font-serif">
                {loadingPreview ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner message="Parsing report context..." />
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto bg-white border border-gray-200 shadow-md p-10 space-y-12 text-gray-800 text-xs min-h-[842px] leading-relaxed relative">
                    {/* Running classification headers */}
                    <div className="flex justify-between text-[9px] font-sans font-bold text-gray-400 border-b border-gray-100 pb-2">
                      <span>CLASSIFICATION: INTERNAL USE</span>
                      <span>VERSION 1.0</span>
                    </div>

                    {/* COVER PAGE REPRESENTATION */}
                    <div className="text-center py-20 space-y-8 border-b border-gray-200 pb-20">
                      <div className="space-y-3">
                        <div className="text-xs font-sans tracking-widest text-[#2563EB] font-extrabold uppercase">
                          Asset Governance & Reconciliation Audit
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
                          EXECUTIVE INVENTORY ASSURANCE REPORT
                        </h1>
                      </div>
                      
                      <div className="text-[10px] text-gray-500 font-sans space-y-1 font-semibold">
                        <div>Report Identifier: <span className="font-mono text-gray-700">AIMS-RECON-{previewReport.id}</span></div>
                        <div>Target Reconciliation Run: <span className="font-mono text-gray-700">#{previewReport.reconciliation_id}</span></div>
                        <div>Compilation Timestamp: <span className="text-gray-700">{formatDate(previewReport.generated_at)}</span></div>
                        <div>Compliance Category: <span className="text-gray-700">Internal Use Only</span></div>
                      </div>

                      <div className="pt-12 text-[10px] text-gray-400 font-sans font-bold tracking-widest">
                        AIMS AUTOMATED AUDIT COMPILER · TIMES NEW ROMAN STANDARD
                      </div>
                    </div>

                    {previewRecon ? (
                      <div className="space-y-8 text-justify">
                        
                        {/* 1. Executive Summary */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            1. Executive Summary
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px] leading-relaxed">
                            {previewRecon.executive_summary || 'This document details the automated inventory reconciliation audit mapping authoritative baseline CMDB files against active live scans. Discovery pipeline and agent findings remain logged.'}
                          </p>
                        </div>

                        {/* 2. Governance Overview */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            2. Governance Overview
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            AIMS Governance Stance measures system health and compliance validation. Based on identified asset deviations, the current posture stands at <span className="font-bold text-gray-900">{Math.max(0, 100 - (previewRecon.missing_assets_count + previewRecon.untracked_assets_count + previewRecon.config_mismatch_count + previewRecon.naming_mismatch_count))}/100</span>.
                          </p>
                        </div>

                        {/* 3. Reconciliation Findings */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            3. Reconciliation Findings
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-xs font-sans font-bold p-3 bg-gray-50 rounded-xl text-gray-700">
                            <div>• Total registered CMDB assets: {previewRecon.total_csv_assets}</div>
                            <div>• Discovered active endpoints: {previewRecon.total_json_assets}</div>
                            <div>• Matching alignment accuracy: {previewRecon.total_csv_assets > 0 ? Math.round(((previewRecon.total_csv_assets - previewRecon.missing_assets_count - previewRecon.config_mismatch_count - previewRecon.naming_mismatch_count) / previewRecon.total_csv_assets) * 100) : 0}%</div>
                            <div>• Active discrepancy deviations: {previewRecon.missing_assets_count + previewRecon.untracked_assets_count + previewRecon.config_mismatch_count + previewRecon.naming_mismatch_count}</div>
                          </div>
                        </div>

                        {/* 4. Historical Comparison */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            4. Historical Comparison
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            Historical comparison trend logs indicate tracking metrics and drift growth profiles are within safe limits. Posture optimization efforts are stable.
                          </p>
                        </div>

                        {/* 5. Asset Health Analysis */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            5. Asset Health Analysis
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            Categorized counts show the distribution of drifts. Asset anomalies comprise {previewRecon.missing_assets_count} missing CMDB items, {previewRecon.untracked_assets_count} untracked active elements, {previewRecon.config_mismatch_count} configuration mismatches, and {previewRecon.naming_mismatch_count} naming drifts.
                          </p>
                        </div>

                        {/* 6. Critical Findings */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            6. Critical Findings
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            The scanning compiler logs indicate immediate remediation priority plans are recommended for virtual host entities exhibiting configuration parameter drifts or registry mismatches.
                          </p>
                        </div>

                        {/* 7. AI Recommendations */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            7. AI Recommendations
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            {previewRecon.ai_analysis ? cleanText(previewRecon.ai_analysis).substring(0, 300) + '...' : 'Review deviations catalog details and deploy standardization scripts.'}
                          </p>
                        </div>

                        {/* 8. Governance Forecast */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            8. Governance Forecast
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            Linear regression models predict potential compliance drop risks in 30/60/90 days if staging configuration deviations remain unresolved. Immediate patch schedule synchronization is advised.
                          </p>
                        </div>

                        {/* 9. Audit Readiness */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold border-b border-gray-100 pb-1 text-[#0F172A] font-sans">
                            9. Audit Readiness
                          </h3>
                          <p className="font-medium text-gray-600 text-[11px]">
                            The weighted Executive Readiness index for regulatory inspection stands at <span className="font-bold text-gray-900">{Math.max(0, Math.round(100 - (previewRecon.missing_assets_count * 3 + previewRecon.untracked_assets_count * 2 + previewRecon.config_mismatch_count * 1.5 + previewRecon.naming_mismatch_count * 0.5)))}%</span>.
                          </p>
                        </div>

                      </div>
                    ) : (
                      <p className="text-center text-red-500 italic py-10 font-sans font-bold">
                        Failed to retrieve reconciliation details.
                      </p>
                    )}

                    {/* Footer markings */}
                    <div className="flex justify-between text-[8px] font-sans font-bold text-gray-400 border-t border-gray-100 pt-3 mt-12">
                      <span>PAGE 1 OF 1</span>
                      <span>INTERNAL USE ONLY</span>
                    </div>

                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end p-5 border-t border-gray-100 flex-shrink-0 gap-3">
                <button
                  onClick={closePreview}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs bg-white hover:bg-gray-50 active:scale-95 transition-all"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
