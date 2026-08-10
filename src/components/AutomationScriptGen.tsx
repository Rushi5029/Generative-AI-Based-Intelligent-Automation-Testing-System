import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Copy, Check, ChevronDown, Download, Loader2, Terminal } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { generateExecutableAutomationScript } from '../lib/automation-codegen';
import { aiAPI } from '../lib/api';
import type { AutomationFramework, GeneratedScript, TestCase } from '../lib/types';
import { toast } from 'sonner';

const frameworks: { id: AutomationFramework; label: string; lang: string; color: string }[] = [
  { id: 'selenium-java', label: 'Selenium (Java)', lang: 'Java', color: '#f89820' },
  { id: 'selenium-python', label: 'Selenium (Python)', lang: 'Python', color: '#3776ab' },
  { id: 'cypress', label: 'Cypress (JS)', lang: 'JavaScript', color: '#69d3a7' },
  { id: 'playwright', label: 'Playwright (TS)', lang: 'TypeScript', color: '#2ead33' },
];

function normalizePreconditions(preconditions: TestCase['preconditions'] | string[] | string): string {
  if (Array.isArray(preconditions)) return preconditions.join('. ');
  return String(preconditions || '');
}

export default function AutomationScriptGen() {
  const { testCases, negativeTestCases } = useAppStore();
  const allCases = useMemo(() => [...testCases, ...negativeTestCases], [testCases, negativeTestCases]);
  const [selectedFramework, setSelectedFramework] = useState<AutomationFramework>('playwright');
  const [selectedTestCase, setSelectedTestCase] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState<'local' | 'ai'>('local');

  const selectedTc = useMemo(
    () => allCases.find((c) => c.testCaseId === selectedTestCase) || null,
    [allCases, selectedTestCase]
  );

  // Realtime: regenerate whenever framework or TC changes
  useEffect(() => {
    if (!selectedTc) {
      setGeneratedScript(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setGenerating(true);
      try {
        // Prefer AI-backed generation when backend is available; always fall back to local executable codegen
        let script: GeneratedScript | null = null;
        try {
          const res = await aiAPI.generateAutomationScript({
            framework: selectedFramework,
            testCase: {
              testCaseId: selectedTc.testCaseId,
              scenario: selectedTc.scenario,
              preconditions: typeof selectedTc.preconditions === 'string'
                ? [selectedTc.preconditions]
                : selectedTc.preconditions,
              steps: selectedTc.steps,
              expectedResults: selectedTc.expectedResults,
              priority: selectedTc.priority,
              category: selectedTc.category,
            },
          }) as { data?: { code?: string; language?: string; framework?: string } };

          if (res?.data?.code && res.data.code.length > 40) {
            script = {
              framework: selectedFramework,
              testCaseId: selectedTc.testCaseId,
              code: res.data.code,
              language: res.data.language || frameworks.find((f) => f.id === selectedFramework)?.lang.toLowerCase() || 'typescript',
              fileName: generateExecutableAutomationScript(selectedTc, selectedFramework).fileName,
              runHints: generateExecutableAutomationScript(selectedTc, selectedFramework).runHints,
            };
            if (!cancelled) setSource('ai');
          }
        } catch {
          // offline / mock — use local
        }

        if (!script) {
          script = generateExecutableAutomationScript(selectedTc, selectedFramework);
          if (!cancelled) setSource('local');
        }

        if (!cancelled) setGeneratedScript(script);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [selectedFramework, selectedTc]);

  const handleCopy = async () => {
    if (!generatedScript) return;
    await navigator.clipboard.writeText(generatedScript.code);
    setCopied(true);
    toast.success('Script copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedScript) return;
    const blob = new Blob([generatedScript.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedScript.fileName || `${selectedTestCase}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${generatedScript.fileName}`);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Code2 className="w-6 h-6 text-success" />
          Automation Script Generator
        </h2>
        <p className="text-sm text-muted mt-1">
          Select framework + test case to generate <span className="text-foreground font-medium">runnable</span> automation from that TC&apos;s steps (not a blank template)
        </p>
      </motion.div>

      {allCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Code2 className="w-16 h-16 text-border mb-4" />
          <p className="text-muted">Generate test cases first to create automation scripts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Framework</label>
              <div className="grid grid-cols-2 gap-2">
                {frameworks.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() => setSelectedFramework(fw.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      selectedFramework === fw.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-surface hover:border-border-bright'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: fw.color }} />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{fw.label}</p>
                      <p className="text-[10px] text-muted">{fw.lang}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Select Test Case</label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between p-3 bg-surface border border-border rounded-lg text-xs text-foreground hover:border-border-bright transition-colors"
                >
                  <span className={selectedTestCase ? 'text-foreground' : 'text-muted'}>
                    {selectedTc
                      ? `${selectedTc.testCaseId}: ${selectedTc.scenario.substring(0, 55)}${selectedTc.scenario.length > 55 ? '...' : ''}`
                      : 'Choose a test case...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted" />
                </button>
                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-[250px] overflow-y-auto">
                    {allCases.map((tc) => (
                      <button
                        key={tc.id}
                        onClick={() => { setSelectedTestCase(tc.testCaseId); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-surface-alt transition-colors border-b border-border/30 last:border-0"
                      >
                        <span className="font-mono text-primary font-bold">{tc.testCaseId}</span>
                        <span className="ml-2 text-[10px] uppercase text-muted">{tc.category}</span>
                        <span className="text-muted ml-2">{tc.scenario.substring(0, 55)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedTc && (
              <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted">Selected Test Case (source of script)</h4>
                  {generating && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                </div>
                <p className="text-xs text-foreground font-medium">{selectedTc.scenario}</p>
                <div>
                  <p className="text-[10px] uppercase text-muted mb-1">Preconditions</p>
                  <p className="text-[11px] text-foreground/80">{normalizePreconditions(selectedTc.preconditions)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted mb-1">Steps → code</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    {selectedTc.steps.map((s, i) => (
                      <li key={i} className="text-[11px] text-foreground/80">{s}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted mb-1">Expected</p>
                  <p className="text-[11px] text-foreground/80">{selectedTc.expectedResults}</p>
                </div>
              </div>
            )}

            {generatedScript?.runHints && (
              <div className="bg-surface-alt border border-border rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> How to run
                </p>
                {generatedScript.runHints.map((h) => (
                  <code key={h} className="block text-[11px] text-emerald-400 font-mono">{h}</code>
                ))}
                <p className="text-[10px] text-muted pt-1">
                  Generator: {source === 'ai' ? 'AI-refined' : 'Deterministic from TC steps'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                Generated Script {generatedScript?.fileName ? `• ${generatedScript.fileName}` : ''}
              </label>
              {generatedScript && (
                <div className="flex items-center gap-2">
                  <button onClick={handleDownload} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
                    <Download className="w-3 h-3" /> Download
                  </button>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-primary hover:text-primary-dim transition-colors">
                    {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Code</>}
                  </button>
                </div>
              )}
            </div>
            <div className="bg-[#0d1117] border border-border rounded-xl overflow-hidden min-h-[420px]">
              {generating && !generatedScript ? (
                <div className="flex items-center justify-center py-32 gap-2 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Generating executable script from TC steps...</span>
                </div>
              ) : generatedScript ? (
                <div className="relative">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-border">
                    <div className="w-3 h-3 rounded-full" style={{ background: frameworks.find((f) => f.id === generatedScript.framework)?.color }} />
                    <span className="text-[10px] text-muted font-mono">{generatedScript.language} • {generatedScript.framework}</span>
                    {generating && <Loader2 className="w-3 h-3 animate-spin text-muted ml-auto" />}
                  </div>
                  <pre className="p-4 text-xs font-mono text-foreground/90 overflow-auto max-h-[560px] leading-relaxed">
                    <code>{generatedScript.code}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center py-32">
                  <div className="text-center">
                    <Code2 className="w-10 h-10 text-border mx-auto mb-2" />
                    <p className="text-xs text-muted">Select a test case — script updates live by framework</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
