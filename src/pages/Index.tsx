import React, { useState, useCallback } from 'react';
import { Transaction, AnalysisResult } from '@/types';
import { CSVUpload } from '@/components/CSVUpload';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { analyzeTransactions } from '@/lib/graphAnalysis';
import { Shield, Zap, Network, FileJson, Loader2, AlertCircle } from 'lucide-react';

type AppState = 'upload' | 'processing' | 'results' | 'error';

export default function Index() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [processingError, setProcessingError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  const handleParsed = useCallback(
    async (transactions: Transaction[], name: string) => {
      setFileName(name);
      setAppState('processing');
      setProgressMsg('Building transaction graph…');

      // Yield to UI thread
      await new Promise((r) => setTimeout(r, 30));

      try {
        setProgressMsg(`Analyzing ${transactions.length.toLocaleString()} transactions…`);
        await new Promise((r) => setTimeout(r, 20));

        const res = analyzeTransactions(transactions);
        setResult(res);
        setAppState('results');
      } catch (err: any) {
        setProcessingError(err?.message ?? 'Unknown error during analysis.');
        setAppState('error');
      }
    },
    []
  );

  const handleCSVReady = useCallback(
    (transactions: Transaction[], name: string) => {
      handleParsed(transactions, name);
    },
    [handleParsed]
  );

  const reset = () => {
    setAppState('upload');
    setResult(null);
    setProcessingError('');
  };

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
      {/* Top navbar */}
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: 'hsl(228 28% 6% / 0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'hsl(var(--primary))' }}>
            <Shield className="w-4 h-4" style={{ color: 'hsl(var(--primary-foreground))' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">GCFDE</p>
            <p className="text-xs text-muted-foreground leading-none mt-0.5">Graph Crime Detection Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {appState === 'results' && result && (
            <span className="text-xs font-mono px-2 py-1 rounded-full"
              style={{ background: 'hsl(145 65% 45% / 0.15)', color: 'hsl(145 65% 45%)', border: '1px solid hsl(145 65% 45% / 0.3)' }}>
              ✓ Analysis Complete
            </span>
          )}
          <a
            href="https://github.com"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ── UPLOAD STATE ── */}
        {appState === 'upload' && (
          <div className="animate-fade-in-up">
            {/* Hero */}
            <div className="text-center mb-12 pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.25)' }}>
                <Zap className="w-3 h-3" />
                Hackathon-Grade · Production Ready · Deterministic
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                <span className="gradient-text">Graph-Based</span>
                <br />
                <span className="text-foreground">Financial Crime Detection</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Upload a transaction CSV. The engine builds a directed graph, detects money muling patterns —
                circular routing, smurfing, and shell networks — and scores every suspicious account.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {[
                { icon: <Network className="w-3.5 h-3.5" />, label: 'Force-Directed Graph Viz' },
                { icon: <Shield className="w-3.5 h-3.5" />, label: 'Cycle Detection (3–5 hops)' },
                { icon: <Zap className="w-3.5 h-3.5" />, label: 'Smurfing (Fan-in / Fan-out)' },
                { icon: <FileJson className="w-3.5 h-3.5" />, label: 'Downloadable JSON Report' },
              ].map((f) => (
                <div key={f.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-muted-foreground glass-card">
                  <span style={{ color: 'hsl(var(--primary))' }}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>

            {/* Upload */}
            <CSVUpload
              onParsed={handleCSVReady}
              onProcessing={(state) => { if (!state) {} }}
            />

            {/* How it works */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { step: '01', title: 'Upload CSV', desc: 'Drop your transaction file with sender, receiver, amount, and timestamp columns.' },
                { step: '02', title: 'Graph Analysis', desc: 'Builds a directed graph. Runs DFS cycle detection, smurfing detection, and shell chain analysis.' },
                { step: '03', title: 'Risk Scoring', desc: 'Each account is scored 0–100 based on pattern involvement. False positives are filtered.' },
                { step: '04', title: 'Export Report', desc: 'Download a structured JSON report with suspicious accounts, fraud rings, and summary.' },
              ].map((item) => (
                <div key={item.step} className="glass-card p-5">
                  <p className="font-mono text-3xl font-bold mb-3" style={{ color: 'hsl(var(--primary) / 0.3)' }}>{item.step}</p>
                  <p className="font-semibold text-foreground mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROCESSING STATE ── */}
        {appState === 'processing' && (
          <div className="flex flex-col items-center justify-center min-h-96 gap-6 animate-fade-in-up">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center"
                style={{ boxShadow: 'var(--glow-primary)' }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(var(--primary))' }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">Processing Transactions</p>
              <p className="text-sm text-muted-foreground mt-2 font-mono">{progressMsg}</p>
            </div>
            <div className="flex gap-8 text-center">
              {[
                { label: 'Cycle Detection', sublabel: 'DFS 3–5 hops' },
                { label: 'Smurfing Analysis', sublabel: '72h sliding window' },
                { label: 'Shell Networks', sublabel: 'BFS chain detection' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS STATE ── */}
        {appState === 'results' && result && (
          <ResultsDashboard result={result} fileName={fileName} onReset={reset} />
        )}

        {/* ── ERROR STATE ── */}
        {appState === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-96 gap-4 animate-fade-in-up">
            <AlertCircle className="w-12 h-12" style={{ color: 'hsl(var(--destructive))' }} />
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">Analysis Failed</p>
              <p className="text-sm text-muted-foreground mt-2 font-mono max-w-md">{processingError}</p>
            </div>
            <button
              onClick={reset}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Graph-Based Financial Crime Detection Engine · Built for hackathon-grade accuracy · All processing is client-side
        </p>
      </footer>
    </div>
  );
}
