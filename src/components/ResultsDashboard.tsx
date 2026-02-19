import React, { useState } from 'react';
import { AnalysisResult } from '@/types';
import { GraphVisualization } from './GraphVisualization';
import { FraudRingTable } from './FraudRingTable';
import { SuspiciousAccountsTable } from './SuspiciousAccountsTable';
import { downloadJSON } from '@/lib/exportJson';
import {
  Download,
  Network,
  AlertTriangle,
  Shield,
  Clock,
  Users,
  Activity,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

interface ResultsDashboardProps {
  result: AnalysisResult;
  fileName: string;
  onReset: () => void;
}

type Tab = 'graph' | 'rings' | 'accounts';

export function ResultsDashboard({ result, fileName, onReset }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('graph');

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'graph',    label: 'Graph View',          icon: <Network className="w-4 h-4" /> },
    { id: 'rings',    label: 'Fraud Rings',          icon: <AlertTriangle className="w-4 h-4" />, count: result.fraud_rings.length },
    { id: 'accounts', label: 'Suspicious Accounts',  icon: <Users className="w-4 h-4" />, count: result.suspicious_accounts.length },
  ];

  const stats = [
    {
      label: 'Accounts Analyzed',
      value: result.summary.total_accounts_analyzed.toLocaleString(),
      icon: <Activity className="w-5 h-5" />,
      color: 'hsl(var(--primary))',
    },
    {
      label: 'Suspicious Flagged',
      value: result.summary.suspicious_accounts_flagged.toLocaleString(),
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'hsl(var(--destructive))',
    },
    {
      label: 'Fraud Rings',
      value: result.summary.fraud_rings_detected.toLocaleString(),
      icon: <Shield className="w-5 h-5" />,
      color: 'hsl(38 95% 55%)',
    },
    {
      label: 'Processing Time',
      value: `${result.summary.processing_time_seconds}s`,
      icon: <Clock className="w-5 h-5" />,
      color: 'hsl(var(--accent))',
    },
  ];

  const suspicionRate = result.summary.total_accounts_analyzed > 0
    ? ((result.summary.suspicious_accounts_flagged / result.summary.total_accounts_analyzed) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <button onClick={onReset} className="hover:text-primary transition-colors">Upload</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-mono">{fileName}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Analysis Report</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suspicion rate: <span className="font-mono" style={{ color: parseFloat(suspicionRate) > 10 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}>{suspicionRate}%</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm glass-card hover:border-primary/50 transition-all flex items-center gap-2"
          >
            ↑ New File
          </button>
          <button
            onClick={() => downloadJSON(result)}
            className="px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold font-mono text-foreground">{stat.value}</p>
              </div>
              <div className="mt-1" style={{ color: stat.color }}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pattern breakdown */}
      {result.suspicious_accounts.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Pattern Distribution</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Cycle Participation', key: 'cycle', color: 'hsl(var(--destructive))' },
              { label: 'Fan-In (Smurfing)', key: 'fan_in', color: 'hsl(38 95% 55%)' },
              { label: 'Fan-Out (Smurfing)', key: 'fan_out', color: 'hsl(38 95% 55%)' },
              { label: 'Shell Chains', key: 'shell_chain', color: 'hsl(var(--accent))' },
              { label: 'High Velocity', key: 'high_velocity', color: 'hsl(var(--primary))' },
            ].map((pt) => {
              const count = result.suspicious_accounts.filter((a) =>
                a.detected_patterns.some((p) => p.includes(pt.key))
              ).length;
              return (
                <div key={pt.key} className="bg-muted rounded-lg p-3">
                  <p className="text-2xl font-bold font-mono" style={{ color: pt.color }}>{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pt.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tab.id === 'rings' ? 'hsl(38 95% 55% / 0.2)' : 'hsl(var(--destructive) / 0.2)',
                    color: tab.id === 'rings' ? 'hsl(38 95% 55%)' : 'hsl(var(--destructive))',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'graph' && (
          <GraphVisualization nodes={result.nodes} edges={result.edges} />
        )}
        {activeTab === 'rings' && (
          <FraudRingTable rings={result.fraud_rings} suspiciousAccounts={result.suspicious_accounts} />
        )}
        {activeTab === 'accounts' && (
          <SuspiciousAccountsTable accounts={result.suspicious_accounts} />
        )}
      </div>

      {/* Download CTA */}
      <div className="glass-card p-5 flex items-center justify-between gap-4 flex-wrap border-primary/20">
        <div>
          <p className="font-semibold text-foreground">Ready to Export</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Download the full structured JSON report with all suspicious accounts, fraud rings, and summary statistics.
          </p>
        </div>
        <button
          onClick={() => downloadJSON(result)}
          className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all hover:opacity-90 flex-shrink-0 animate-pulse-primary"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          <Download className="w-4 h-4" />
          Download JSON Report
        </button>
      </div>
    </div>
  );
}
