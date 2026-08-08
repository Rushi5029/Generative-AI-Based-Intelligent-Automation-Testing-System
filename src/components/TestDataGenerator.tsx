import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, ShieldAlert, CheckCircle2, XCircle,
  Diff, Cpu, History, Clock, Loader2, Copy, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiAPI } from '../lib/api';
import { useAppStore } from '../lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TestDataResult {
  _id: string;
  requirement: string;
  valid: string[];
  invalid: string[];
  boundary: string[];
  edge: string[];
  security: string[];
  createdAt: string;
}

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'valid' as keyof TestDataResult,
    label: 'Valid Inputs',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    pill: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    key: 'invalid' as keyof TestDataResult,
    label: 'Invalid Inputs',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    pill: 'bg-red-500/20 text-red-300',
  },
  {
    key: 'boundary' as keyof TestDataResult,
    label: 'Boundary Values',
    icon: Diff,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    pill: 'bg-blue-500/20 text-blue-300',
  },
  {
    key: 'edge' as keyof TestDataResult,
    label: 'Edge Cases',
    icon: Cpu,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    pill: 'bg-amber-500/20 text-amber-300',
  },
  {
    key: 'security' as keyof TestDataResult,
    label: 'Security Payloads',
    icon: ShieldAlert,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    pill: 'bg-purple-500/20 text-purple-300',
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function TestDataGenerator() {
  const { projectId } = useAppStore();

  const SAMPLE_REQUIREMENT =
    'Users must be able to register with a valid email address and a password of at least 8 characters, containing at least one uppercase letter, one lowercase letter, one digit, and one special character. The system should reject duplicate email addresses and lock the account after 5 failed login attempts.';

  const [requirement, setRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestDataResult | null>(null);
  const [history, setHistory] = useState<TestDataResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Load history on mount / project change
  useEffect(() => {
    setHistoryLoading(true);
    aiAPI
      .getTestDataHistory(projectId || 'default')
      .then((res: any) => setHistory(res?.data || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [projectId]);

  const handleGenerate = async () => {
    if (!requirement.trim()) {
      toast.error('Please enter a requirement first.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res: any = await aiAPI.generateTestData({
        requirement: requirement.trim(),
        projectId,
      });
      const data: TestDataResult = res?.data;
      setResult(data);
      setHistory((prev) => [data, ...prev]);
      const total =
        data.valid.length + data.invalid.length + data.boundary.length +
        data.edge.length + data.security.length;
      toast.success(`Generated ${total} test data values across 5 categories`);
    } catch (err: any) {
      toast.error(err?.message || 'Test data generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyAll = (items: string[], label: string) => {
    navigator.clipboard.writeText(items.join('\n')).then(() => {
      toast.success(`Copied ${items.length} ${label} values`);
    });
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-cyan-400" />
          AI Test Data Generator
        </h2>
        <p className="text-sm text-muted mt-1">
          Automatically generate categorised test data (valid, invalid, boundary, edge, security) from any requirement using AI.
        </p>
      </motion.div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Requirement</h3>
          <button
            onClick={() => setRequirement(SAMPLE_REQUIREMENT)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Load Sample
          </button>
        </div>
        <textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder={`Paste or type a requirement here…\n\nExample:\n"Users must be able to register with a valid email address and a password of at least 8 characters containing uppercase, lowercase, digit, and special character."`}
          rows={6}
          className="w-full bg-surface-alt border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors resize-none placeholder:text-muted/60 font-mono leading-relaxed"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating with AI…
              </>
            ) : (
              <>
                <FlaskConical className="w-4 h-4" />
                Generate Test Data
              </>
            )}
          </button>
          {requirement && (
            <button
              onClick={() => { setRequirement(''); setResult(null); }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
          {result && (
            <span className="text-xs text-muted ml-auto">
              ✓ {result.valid.length + result.invalid.length + result.boundary.length +
               result.edge.length + result.security.length} values generated
            </span>
          )}
        </div>
      </motion.div>


      {/* Result Grid */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="result-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {CATEGORIES.map((cat, i) => {
              const items = result[cat.key] as string[];
              const Icon = cat.icon;
              return (
                <motion.div
                  key={cat.key}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className={`bg-surface border ${cat.border} rounded-xl p-4 space-y-3`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg}`}>
                        <Icon className={`w-4 h-4 ${cat.color}`} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.pill}`}>
                        {items.length}
                      </span>
                      {items.length > 0 && (
                        <button
                          onClick={() => copyAll(items, cat.label)}
                          className="p-1 hover:bg-surface-alt rounded transition-colors"
                          title="Copy all"
                        >
                          <Copy className="w-3.5 h-3.5 text-muted hover:text-foreground" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted italic">No data generated.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-[11px] text-foreground/80 bg-surface-alt rounded-md px-2.5 py-1.5 font-mono leading-relaxed"
                        >
                          <span className={`text-[10px] font-semibold ${cat.color} shrink-0 mt-0.5`}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {(history.length > 0 || historyLoading) && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4" />
            Past Generations
          </h3>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const total =
                  h.valid.length + h.invalid.length + h.boundary.length +
                  h.edge.length + h.security.length;
                const isOpen = expandedHistoryId === h._id;
                return (
                  <div
                    key={h._id}
                    className="bg-surface border border-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedHistoryId(isOpen ? null : h._id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-alt transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span className="text-xs text-muted">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                      <span className="flex-1 text-xs text-foreground/70 truncate">
                        {h.requirement.substring(0, 60)}{h.requirement.length > 60 ? '…' : ''}
                      </span>
                      <span className="text-[11px] text-cyan-400 font-semibold">
                        {total} values
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="border-t border-border px-4 pb-4 pt-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {CATEGORIES.map((cat) => {
                            const items = h[cat.key] as string[];
                            const Icon = cat.icon;
                            return (
                              <div key={cat.key} className={`rounded-lg p-2 ${cat.bg} border ${cat.border}`}>
                                <div className="flex items-center gap-1 mb-1">
                                  <Icon className={`w-3 h-3 ${cat.color}`} />
                                  <span className={`text-[10px] font-semibold ${cat.color}`}>
                                    {cat.label} ({items.length})
                                  </span>
                                </div>
                                <ul className="space-y-0.5">
                                  {items.map((item, idx) => (
                                    <li key={idx} className="text-[10px] text-foreground/70 font-mono truncate">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
