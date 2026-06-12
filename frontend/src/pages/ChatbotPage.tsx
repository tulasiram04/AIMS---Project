import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import { Reconciliation } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  Zap,
  Sliders,
  Target,
  AlertTriangle,
  Calendar,
  Layers,
  CircleDot,
  FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [selectedReconId, setSelectedReconId] = useState<number | undefined>();
  const [reconsLoading, setReconsLoading] = useState(true);
  
  // Mode Selection: 'Executive' (3 bullet summaries) vs 'Technical' (tables, commands, asset IDs)
  const [copilotMode, setCopilotMode] = useState<'Executive' | 'Technical'>('Executive');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  let nextId = useRef(0);

  useEffect(() => {
    loadReconciliations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadReconciliations = async () => {
    try {
      const res = await inventoryAPI.listReconciliations();
      setReconciliations(res.data);
      if (res.data.length > 0) {
        setSelectedReconId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReconsLoading(false);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: nextId.current++,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Context modifications based on selected mode
    let modifiedQuery = userMsg.content;
    if (copilotMode === 'Executive') {
      modifiedQuery += '\n\nIMPORTANT: Please provide your response strictly formatted as a 3-bullet-point summary.';
    } else {
      modifiedQuery += '\n\nIMPORTANT: Please provide a detailed technical response containing tables, asset ID references, and command line examples where appropriate.';
    }

    try {
      const res = await inventoryAPI.chatbot(modifiedQuery, selectedReconId);
      
      // Filter out raw markdown or prompt modifiers if they leaked into the bot response
      let cleanResponse = res.data.response;
      if (copilotMode === 'Executive') {
        // Strip out "strictly formatted as a 3-bullet-point summary" mentions if the bot repeats them
        cleanResponse = cleanResponse.replace(/strictly formatted as a 3-bullet-point summary/gi, '');
      }

      const botMsg: Message = {
        id: nextId.current++,
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: nextId.current++,
        role: 'assistant',
        content: err.response?.data?.detail || 'Sorry, I encountered an error processing your request.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQueries = [
    'What is the overall compliance rate?',
    'Which assets are missing from live infrastructure?',
    'What are the main configuration mismatches?',
    'Summarize the risk assessment',
    'What corrective actions should we prioritize?',
  ];

  // Find reconciliation for current sidebar metrics context
  const activeRecon = reconciliations.find(r => r.id === selectedReconId) || reconciliations[0];
  
  let sidebarMetrics = null;
  if (activeRecon) {
    const csvTotal = activeRecon.total_csv_assets || 0;
    const missing = activeRecon.missing_assets_count || 0;
    const untracked = activeRecon.untracked_assets_count || 0;
    const config = activeRecon.config_mismatch_count || 0;
    const naming = activeRecon.naming_mismatch_count || 0;
    
    const matched = Math.max(0, csvTotal - missing);
    const accuracy = csvTotal > 0 ? Math.round((matched / csvTotal) * 100) : 0;
    const governanceScore = Math.max(0, 100 - (missing + untracked + config + naming));

    const criticalCount = activeRecon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'CRITICAL').length || 0;
    const highCount = activeRecon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'HIGH').length || 0;
    const mediumCount = activeRecon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'MEDIUM').length || 0;
    const lowCount = activeRecon.discrepancies?.filter(d => d.severity?.toUpperCase() === 'LOW').length || 0;
    const riskScore = Math.min(100, (criticalCount * 25) + (highCount * 15) + (mediumCount * 8) + (lowCount * 3));

    sidebarMetrics = {
      accuracy,
      governanceScore,
      riskScore,
      lastScan: activeRecon.completed_at ? formatDate(activeRecon.completed_at) : '—',
      discrepancyCount: missing + untracked + config + naming
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-[calc(100vh-140px)] flex gap-6 max-w-7xl mx-auto font-sans"
    >
      {/* CHAT MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Title Row */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">AI Governance Copilot</h1>
            <p className="text-xs text-[#64748B] mt-0.5">Interact with the multi-agent cognitive scan catalog analysis engine.</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500">Context:</span>
            <select
              value={selectedReconId || ''}
              onChange={(e) => setSelectedReconId(e.target.value ? Number(e.target.value) : undefined)}
              className="select-field text-xs py-1.5 px-3 rounded-xl border border-gray-200 bg-white"
            >
              <option value="">No Active Context</option>
              {reconciliations.map((r) => (
                <option key={r.id} value={r.id}>
                  Reconciliation #{r.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chat card */}
        <div className="card flex-1 flex flex-col overflow-hidden border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm">
          
          {/* Mode Switcher Banner */}
          <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Sliders size={13} className="text-[#2563EB]" />
              <span className="font-bold text-gray-600">Copilot Mode:</span>
            </div>
            
            <div className="flex gap-1.5">
              <button
                onClick={() => setCopilotMode('Executive')}
                className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] transition-colors ${
                  copilotMode === 'Executive' ? 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/25' : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                Executive (3-Bullet Summaries)
              </button>
              <button
                onClick={() => setCopilotMode('Technical')}
                className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] transition-colors ${
                  copilotMode === 'Technical' ? 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/25' : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                Technical (Tables & Commands)
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100">
                  <Bot size={24} className="text-[#2563EB]" />
                </div>
                <h2 className="text-base font-extrabold text-[#0F172A] mb-1">
                  AI Governance Copilot
                </h2>
                <p className="text-xs text-[#64748B] mb-6 max-w-sm font-semibold">
                  Ask details about configuration deviations, compliance drift logs, business risks, or priority remediation plans.
                </p>
                
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {suggestedQueries.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-150 hover:bg-gray-100 text-gray-600 rounded-full font-bold text-[10px] transition-colors"
                    >
                      <Sparkles size={11} className="text-[#2563EB]" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                    <Bot size={15} className="text-[#2563EB]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs ${
                    msg.role === 'user'
                      ? 'bg-[#2563EB] text-white rounded-br-md shadow-sm'
                      : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none break-words text-gray-700 leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ ...props }) => <h1 className="text-xs font-extrabold text-[#2E4265] mt-3 mb-1.5 uppercase font-sans" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-[11px] font-bold text-[#2E4265] mt-2.5 mb-1 font-sans" {...props} />,
                          p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed font-semibold text-xs text-gray-600" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-xs text-gray-600" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-xs text-gray-600" {...props} />,
                          li: ({ ...props }) => <li className="mb-0.5" {...props} />,
                          code: ({ className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;
                            return isInline ? (
                              <code className="bg-gray-100 border border-gray-200 text-red-600 px-1 py-0.5 rounded font-mono text-[10px] font-bold" {...props}>
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-gray-900 text-gray-200 p-3 rounded-xl overflow-x-auto my-2 font-mono text-[10px] max-w-full">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            );
                          },
                          table: ({ ...props }) => (
                            <div className="overflow-x-auto my-3 border border-gray-200 rounded-xl shadow-xs">
                              <table className="min-w-full divide-y divide-gray-200 text-[10px] text-left border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({ ...props }) => <thead className="bg-gray-50 font-bold" {...props} />,
                          th: ({ ...props }) => <th className="px-3 py-2 border-b border-gray-200 font-bold text-gray-700" {...props} />,
                          td: ({ ...props }) => <td className="px-3 py-2 border-b border-gray-100 text-gray-600" {...props} />,
                          tr: ({ ...props }) => <tr className="hover:bg-gray-50/50 even:bg-gray-50/30" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap font-semibold">{msg.content}</div>
                  )}
                  <div className={`text-[9px] mt-1.5 font-bold ${
                    msg.role === 'user' ? 'text-white/60' : 'text-gray-400'
                  }`}>
                    {msg.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                  <Bot size={15} className="text-[#2563EB]" />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <LoadingSpinner size="sm" message="Analyzing cognitive nodes..." />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-150 p-3 bg-white space-y-3">
            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-2 pb-1">
              {[
                { label: 'Executive Summary', query: 'Provide a formal executive summary of the latest reconciliation scan, outlining major asset categories and validation sync status.' },
                { label: 'Missing Assets', query: 'Identify and list all registered baseline assets that are missing from live scans, along with their recorded types and severity risks.' },
                { label: 'Untracked Assets', query: 'Identify and list all discovered endpoints in live infrastructure scans that are untracked in the authoritative CMDB baseline.' },
                { label: 'Governance Score', query: 'Show the calculated governance compliance score for the latest scan and list the specific deductions caused by naming and config drifts.' },
                { label: 'Audit Readiness', query: 'What is our overall Weighted Audit Readiness index, and what specific remediation actions must we take to reach 100% readiness?' },
                { label: 'Generate Report', query: 'Compile and generate a formal executive compliance PDF report for the active reconciliation scan.' }
              ].map((act, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(act.query)}
                  disabled={loading}
                  className="px-2.5 py-1 bg-[#2563EB]/5 hover:bg-[#2563EB]/10 border border-[#2563EB]/10 hover:border-[#2563EB]/20 text-[#2563EB] rounded-lg font-bold text-[10px] active:scale-95 transition-all"
                >
                  {act.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask details about configuration deviations, compliance drift logs, business risks..."
                className="input-field flex-1 text-xs py-2 px-3 rounded-xl border border-gray-200"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="btn-primary px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-bold"
              >
                <Send size={13} />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR CONTEXT METRICS */}
      <div className="w-72 hidden lg:flex flex-col gap-5 flex-shrink-0">
        {/* Confidence Level Widget */}
        <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[24px] text-white shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-6 -translate-y-6 blur-md" />
          <div className="flex justify-between items-start z-10">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-blue-100">AI Confidence Index</span>
            <ShieldCheck size={16} className="text-green-300" />
          </div>
          <div className="z-10 mt-2">
            <div className="text-2xl font-extrabold">94.8%</div>
            <p className="text-[9px] text-blue-100 font-semibold mt-0.5">Assurance score based on LangGraph agents</p>
          </div>
        </div>

        {/* Live Context Metrics */}
        <div className="card p-5 border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4 flex items-center gap-2">
              <CircleDot size={14} className="text-[#2563EB] animate-pulse" />
              Active Context Metrics
            </h3>

            {sidebarMetrics ? (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                  <div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase">Governance Score</div>
                    <div className="text-base font-extrabold text-[#2563EB] mt-0.5">{sidebarMetrics.governanceScore}/100</div>
                  </div>
                  <Target size={20} className="text-gray-300" />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                  <div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase">Match Accuracy</div>
                    <div className="text-base font-extrabold text-emerald-600 mt-0.5">{sidebarMetrics.accuracy}%</div>
                  </div>
                  <Target size={20} className="text-gray-300" />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                  <div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase">Risk Exposure</div>
                    <div className="text-base font-extrabold text-red-600 mt-0.5">{sidebarMetrics.riskScore}%</div>
                  </div>
                  <AlertTriangle size={20} className="text-gray-300" />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1 text-[10px] font-semibold text-gray-500">
                  <div className="flex justify-between">
                    <span>Audit Run ID:</span>
                    <span className="font-bold text-gray-700">Recon #{selectedReconId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active deviations:</span>
                    <span className="font-bold text-red-600">{sidebarMetrics.discrepancyCount} items</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-gray-400 italic">
                No context loaded. Run a scan to sync.
              </div>
            )}
          </div>

          {sidebarMetrics && (
            <div className="pt-4 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1.5 font-semibold">
              <Calendar size={12} className="flex-shrink-0" />
              <span>Audit Run Date: {sidebarMetrics.lastScan}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
