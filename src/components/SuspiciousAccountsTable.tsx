import React, { useState } from 'react';
import { SuspiciousAccount, PatternType } from '@/types';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface SuspiciousAccountsTableProps {
  accounts: SuspiciousAccount[];
}

const PATTERN_META: Record<PatternType, { label: string; className: string }> = {
  cycle_length_3: { label: 'Cycle-3',  className: 'pattern-tag-cycle' },
  cycle_length_4: { label: 'Cycle-4',  className: 'pattern-tag-cycle' },
  cycle_length_5: { label: 'Cycle-5',  className: 'pattern-tag-cycle' },
  fan_in:         { label: 'Fan-In',   className: 'pattern-tag-fanin' },
  fan_out:        { label: 'Fan-Out',  className: 'pattern-tag-fanout' },
  shell_chain:    { label: 'Shell',    className: 'pattern-tag-shell' },
  high_velocity:  { label: 'Velocity', className: 'pattern-tag-velocity' },
};

function ScoreBar({ score }: { score: number }) {
  const cls = score >= 60 ? 'risk-bar-fill-high' : score >= 30 ? 'risk-bar-fill-medium' : 'risk-bar-fill-low';
  const textCls = score >= 60 ? 'score-high' : score >= 30 ? 'score-medium' : 'score-low';
  return (
    <div className="flex items-center gap-2">
      <div className="risk-bar-track flex-1 min-w-16">
        <div className={cls} style={{ width: `${score}%`, height: '100%', borderRadius: '9999px' }} />
      </div>
      <span className={`font-mono text-sm font-bold w-10 text-right ${textCls}`}>{score.toFixed(1)}</span>
    </div>
  );
}

export function SuspiciousAccountsTable({ accounts }: SuspiciousAccountsTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const filtered = accounts.filter(
    (a) =>
      a.account_id.toLowerCase().includes(search.toLowerCase()) ||
      (a.ring_id?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by account ID or ring ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          style={{ background: 'hsl(var(--input))' }}
        />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Account ID</th>
              <th className="text-left">Ring ID</th>
              <th className="text-left min-w-48">Suspicion Score</th>
              <th className="text-left">Detected Patterns</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground py-8">
                  No matching accounts
                </td>
              </tr>
            ) : (
              paginated.map((acc, i) => (
                <tr key={acc.account_id}>
                  <td className="font-mono text-xs text-muted-foreground">
                    {page * PAGE_SIZE + i + 1}
                  </td>
                  <td>
                    <span className="font-mono text-sm text-foreground">{acc.account_id}</span>
                  </td>
                  <td>
                    {acc.ring_id ? (
                      <span className="font-mono text-xs" style={{ color: 'hsl(38 95% 55%)' }}>{acc.ring_id}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td>
                    <ScoreBar score={acc.suspicion_score} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {acc.detected_patterns.map((p) => {
                        const meta = PATTERN_META[p];
                        return meta ? (
                          <span key={p} className={`pattern-tag ${meta.className}`}>{meta.label}</span>
                        ) : null;
                      })}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-xs glass-card hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${i === page ? 'bg-primary text-primary-foreground' : 'glass-card hover:border-primary/50'}`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs glass-card hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
