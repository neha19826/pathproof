import React, { useState } from 'react';
import { FraudRing, SuspiciousAccount } from '@/types';
import { ChevronDown, ChevronUp, Users, AlertTriangle, Layers, GitBranch } from 'lucide-react';

interface FraudRingTableProps {
  rings: FraudRing[];
  suspiciousAccounts: SuspiciousAccount[];
}

const PATTERN_LABELS: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  cycle:       { label: 'Circular Routing', icon: <GitBranch className="w-3.5 h-3.5" />, className: 'pattern-tag-cycle' },
  fan_in:      { label: 'Smurfing (Fan-In)', icon: <AlertTriangle className="w-3.5 h-3.5" />, className: 'pattern-tag-fanin' },
  fan_out:     { label: 'Smurfing (Fan-Out)', icon: <AlertTriangle className="w-3.5 h-3.5" />, className: 'pattern-tag-fanout' },
  shell_chain: { label: 'Shell Network', icon: <Layers className="w-3.5 h-3.5" />, className: 'pattern-tag-shell' },
};

function riskBarClass(score: number): string {
  if (score >= 60) return 'risk-bar-fill-high';
  if (score >= 30) return 'risk-bar-fill-medium';
  return 'risk-bar-fill-low';
}

function scoreTextClass(score: number): string {
  if (score >= 60) return 'score-high';
  if (score >= 30) return 'score-medium';
  return 'score-low';
}

export function FraudRingTable({ rings, suspiciousAccounts }: FraudRingTableProps) {
  const [expandedRing, setExpandedRing] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'risk_score' | 'member_count'>('risk_score');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sorted = [...rings].sort((a, b) => {
    const va = sortField === 'risk_score' ? a.risk_score : a.member_accounts.length;
    const vb = sortField === 'risk_score' ? b.risk_score : b.member_accounts.length;
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const toggleSort = (field: 'risk_score' | 'member_count') => {
    if (sortField === field) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  if (rings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted-foreground">No fraud rings detected.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-left">Ring ID</th>
            <th className="text-left">Pattern Type</th>
            <th
              className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
              onClick={() => toggleSort('member_count')}
            >
              <span className="flex items-center justify-end gap-1">
                Members
                {sortField === 'member_count' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
              </span>
            </th>
            <th
              className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
              onClick={() => toggleSort('risk_score')}
            >
              <span className="flex items-center justify-end gap-1">
                Risk Score
                {sortField === 'risk_score' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
              </span>
            </th>
            <th className="text-left">Members</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ring) => {
            const meta = PATTERN_LABELS[ring.pattern_type] ?? { label: ring.pattern_type, className: 'pattern-tag-shell', icon: null };
            const isExpanded = expandedRing === ring.ring_id;
            return (
              <React.Fragment key={ring.ring_id}>
                <tr
                  className="cursor-pointer"
                  onClick={() => setExpandedRing(isExpanded ? null : ring.ring_id)}
                >
                  <td>
                    <span className="font-mono text-xs" style={{ color: 'hsl(38 95% 55%)' }}>
                      {ring.ring_id}
                    </span>
                  </td>
                  <td>
                    <span className={`pattern-tag ${meta.className} flex items-center gap-1 w-fit`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="flex items-center justify-end gap-1 text-sm">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      {ring.member_accounts.length}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="risk-bar-track w-16 hidden sm:block">
                        <div
                          className={`risk-bar-fill-${ring.risk_score >= 60 ? 'high' : ring.risk_score >= 30 ? 'medium' : 'low'}`}
                          style={{ width: `${ring.risk_score}%`, height: '100%', borderRadius: '9999px' }}
                        />
                      </div>
                      <span className={`font-mono text-sm font-bold ${scoreTextClass(ring.risk_score)}`}>
                        {ring.risk_score.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-48">
                        {ring.member_accounts.slice(0, 3).join(', ')}{ring.member_accounts.length > 3 ? ` +${ring.member_accounts.length - 3}` : ''}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">All Member Accounts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ring.member_accounts.map((acc) => {
                          const accData = suspiciousAccounts.find((s) => s.account_id === acc);
                          return (
                            <span
                              key={acc}
                              className="font-mono text-xs px-2 py-1 rounded-md"
                              style={{
                                background: accData
                                  ? `hsl(${accData.suspicion_score >= 60 ? '0 84% 58%' : '38 95% 55%'} / 0.12)`
                                  : 'hsl(var(--muted))',
                                color: accData
                                  ? accData.suspicion_score >= 60
                                    ? 'hsl(var(--destructive))'
                                    : 'hsl(var(--warning))'
                                  : 'hsl(var(--muted-foreground))',
                                border: `1px solid ${accData ? (accData.suspicion_score >= 60 ? 'hsl(0 84% 58% / 0.3)' : 'hsl(38 95% 55% / 0.3)') : 'hsl(var(--border))'}`,
                              }}
                            >
                              {acc}
                              {accData && <span className="ml-1 opacity-70">({accData.suspicion_score})</span>}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
