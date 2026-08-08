import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, Loader2, History, TrendingUp, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAPI, requirementAPI } from '../lib/api';
import { useAppStore } from '../lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AffectedTC {
  testCaseId: string;
  scenario: string;
  impact: 'High' | 'Medium' | 'Low';
  reason: string;
  regressionPriority: 'Immediate' | 'Next Sprint' | 'Low Priority';
}

interface ImpactResult {
  _id: string;
  impactLevel: 'High' | 'Medium' | 'Low' | 'None';
  reason: string;
  totalAffected: number;
  affectedTestCases: AffectedTC[];
  oldRequirement: string;
  newRequirement: string;
  createdAt: string;
}

interface Requirement {
  _id: string;
  requirementId: string;
  title: string;
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const impactColors: Record<string, string> = {
  High:   'text-red-400 bg-red-500/10 border-red-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  None:   'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

const priorityColors: Record<string, string> = {
  Immediate:     'text-red-400',
  'Next Sprint': 'text-amber-400',
  'Low Priority':'text-emerald-400',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RequirementChangeImpact() {
  const { projectId } = useAppStore();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [oldRequirement, setOldRequirement] = useState('');
  const [newRequirement, setNewRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [history, setHistory] = useState<ImpactResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Try to fetch requirements for the dropdown (best-effort, not required)
  useEffect(() => {
    requirementAPI
      .getAll({ projectId })
      .then((res: any) => setRequirements(res?.data || []))
      .catch(() => setRequirements([]));
  }, [projectId]);

  // Fetch history
  useEffect(() => {
    setHistoryLoading(true);
    aiAPI
      .getChangeImpactHistory(projectId || 'default')
      .then((res: any) => setHistory(res?.data || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [projectId]);

  const handleSelectReq = (reqId: string) => {
    const found = requirements.find((r) => r._id === reqId);
    if (found) {
      setOldRequirement(found.description);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!oldRequirement.trim()) {
      toast.error('Please enter the original (old) requirement text.');
      return;
    }
    if (!newRequirement.trim()) {
      toast.error('Please enter the updated (new) requirement text.');
      return;
    }
    if (newRequirement.trim() === oldRequirement.trim()) {
      toast.warning('Old and new requirements are identical — nothing to analyze.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res: any = await aiAPI.analyzeChangeImpact({
        projectId,
        oldRequirement: oldRequirement.trim(),
        newRequirement: newRequirement.trim(),
      });
      const data: ImpactResult = res?.data;
      setResult(data);
      setHistory((prev) => [data, ...prev]);
      toast.success(`Analysis complete — ${data.totalAffected} test case(s) affected`);
    } catch (err: any) {
      toast.error(err?.message || 'Impact analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setOldRequirement('');
    setNewRequirement('');
    setResult(null);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-violet-400" />
          Requirement Change Impact Predictor
        </h2>
        <p className="text-sm text-muted mt-1">
          Compare old vs. updated requirements and predict which test cases are affected using AI.
        </p>
      </motion.div>

      {/* Input Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — Old Requirement */}
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-surface border border-border rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-[11px] font-bold flex items-center justify-center">1</span>
              Original Requirement
            </h3>
          </div>

          {/* Optional: load from saved requirements */}
          {requirements.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] text-muted uppercase tracking-wider font-semibold">
                Load from saved requirements (optional)
              </label>
              <select
                onChange={(e) => handleSelectReq(e.target.value)}
                className="w-full bg-surface-alt border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="">-- Select to auto-fill --</option>
                {requirements.map((r) => (
                  <option key={r._id} value={r._id}>
                    [{r.requirementId}] {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-muted uppercase tracking-wider font-semibold flex items-center gap-1">
              <FileText className="w-3 h-3" /> Old / Original Text
            </label>
            <textarea
              value={oldRequirement}
              onChange={(e) => setOldRequirement(e.target.value)}
              placeholder="Paste or type the original requirement text here…&#10;&#10;e.g. The system shall allow users to register with an email and password of at least 6 characters."
              rows={7}
              className="w-full bg-surface-alt border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none placeholder:text-muted/60 font-mono leading-relaxed"
            />
          </div>
        </motion.div>

        {/* Right — New Requirement + Analyze */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-surface border border-border rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-[11px] font-bold flex items-center justify-center">2</span>
            Updated Requirement
          </h3>
          <div className="space-y-1">
            <label className="text-[11px] text-muted uppercase tracking-wider font-semibold flex items-center gap-1">
              <FileText className="w-3 h-3" /> New / Updated Text
            </label>
            <textarea
              value={newRequirement}
              onChange={(e) => setNewRequirement(e.target.value)}
              placeholder="Paste or type the updated requirement text here…&#10;&#10;e.g. The system shall allow users to register with an email and password of at least 10 characters including uppercase, lowercase, numbers, and special characters."
              rows={7}
              className="w-full bg-surface-alt border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none placeholder:text-muted/60 font-mono leading-relaxed"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing with AI…
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4" />
                  Analyze Impact
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted hover:text-foreground hover:border-border-bright transition-colors"
            >
              Clear
            </button>
          </div>
        </motion.div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface border border-border rounded-xl p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Analysis Result</h3>

            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${impactColors[result.impactLevel]}`}>
                {result.impactLevel === 'None' ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                {result.impactLevel} Impact
              </div>
              <span className="text-sm text-muted flex-1">{result.reason}</span>
              <span className="text-xs font-mono text-muted">
                {result.totalAffected} test case{result.totalAffected !== 1 ? 's' : ''} affected
              </span>
            </div>

            {result.affectedTestCases.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <CheckCircle className="w-4 h-4 shrink-0" />
                No existing test cases require immediate attention for this change.
              </div>
            ) : (
              <div className="space-y-2">
                {result.affectedTestCases.map((tc, i) => (
                  <motion.div
                    key={tc.testCaseId + i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-surface-alt border border-border rounded-lg p-4"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="text-[11px] font-mono text-muted bg-border/30 px-2 py-0.5 rounded">
                        {tc.testCaseId}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${impactColors[tc.impact]}`}>
                        {tc.impact} Impact
                      </span>
                      <span className={`text-[11px] font-semibold ml-auto flex items-center gap-1 ${priorityColors[tc.regressionPriority]}`}>
                        <TrendingUp className="w-3 h-3" />
                        {tc.regressionPriority}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium mt-2">{tc.scenario}</p>
                    <p className="text-[11px] text-muted mt-1">{tc.reason}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {(history.length > 0 || historyLoading) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4" />
            Past Analyses
          </h3>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h._id}
                  className="bg-surface border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(expandedId === h._id ? null : h._id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-alt transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="text-xs text-muted">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                    <span className="flex-1 text-xs text-foreground/70 truncate">
                      {h.oldRequirement?.substring(0, 50)}{(h.oldRequirement?.length ?? 0) > 50 ? '…' : ''}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${impactColors[h.impactLevel]}`}>
                      {h.impactLevel}
                    </span>
                    <span className="text-[11px] text-muted">{h.totalAffected} affected</span>
                    {expandedId === h._id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted" />
                    )}
                  </button>
                  {expandedId === h._id && (
                    <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                      <p className="text-[11px] text-muted">{h.reason}</p>
                      {h.affectedTestCases.map((tc, i) => (
                        <div key={tc.testCaseId + i} className="bg-surface-alt rounded p-2 flex gap-2 items-start">
                          <span className="text-[10px] font-mono text-muted shrink-0">{tc.testCaseId}</span>
                          <span className="text-[11px] text-foreground/80 flex-1">{tc.scenario}</span>
                          <span className={`text-[10px] font-semibold shrink-0 ${impactColors[tc.impact]}`}>{tc.impact}</span>
                        </div>
                      ))}
                      {h.affectedTestCases.length === 0 && (
                        <p className="text-[11px] text-emerald-400">No test cases were affected.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
