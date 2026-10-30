import React, { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

export interface PodSpendRow {
  label: string;
  amount: number; // INR
  count: number;
  muted?: boolean; // e.g. "Unidentified": drawn in gray and kept last
}

interface Props {
  title: string;
  subtitle: string;
  rows: PodSpendRow[];
  countLabel: string; // e.g. "transactions", "subscriptions"
  emptyText: string;
}

const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const formatCompact = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `₹${Math.round(n)}`;

// Horizontal bars, largest first, one hue. Hover a row for the exact amount, share and count.
export default function PodSpendChart({ title, subtitle, rows, countLabel, emptyText }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...rows].sort((a, b) => Number(!!a.muted) - Number(!!b.muted) || b.amount - a.amount);
  const total = sorted.reduce((sum, r) => sum + r.amount, 0);
  const max = Math.max(...sorted.map(r => r.amount), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-start gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</div>
            <div className="text-lg font-bold text-slate-900">{formatINR(total)}</div>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Chart or table view">
            <button onClick={() => setView('chart')} aria-pressed={view === 'chart'} title="Chart" className={`p-1.5 rounded-md ${view === 'chart' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}>
              <BarChart3 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('table')} aria-pressed={view === 'table'} title="Table" className={`p-1.5 rounded-md ${view === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}>
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400">{emptyText}</div>
      ) : view === 'table' ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Pod</th>
              <th className="px-6 py-3 font-medium text-right">Amount</th>
              <th className="px-6 py-3 font-medium text-right">Share</th>
              <th className="px-6 py-3 font-medium text-right capitalize">{countLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map(r => (
              <tr key={r.label}>
                <td className="px-6 py-2.5 text-slate-900">{r.label}</td>
                <td className="px-6 py-2.5 text-right font-medium text-slate-900">{formatINR(r.amount)}</td>
                <td className="px-6 py-2.5 text-right text-slate-600">{total ? ((r.amount / total) * 100).toFixed(1) : 0}%</td>
                <td className="px-6 py-2.5 text-right text-slate-600">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-6 py-4 space-y-0.5" onMouseLeave={() => setHovered(null)}>
          {sorted.map(r => {
            const pct = (r.amount / max) * 100;
            const share = total ? (r.amount / total) * 100 : 0;
            const active = hovered === r.label;
            return (
              <div
                key={r.label}
                onMouseEnter={() => setHovered(r.label)}
                className={`relative grid grid-cols-[170px_1fr] items-center gap-3 py-1.5 px-2 -mx-2 rounded-md cursor-default ${active ? 'bg-slate-50' : ''}`}
              >
                <div className="text-sm text-slate-700 truncate" title={r.label}>{r.label}</div>
                {/* mr-14 keeps room for the value label past the longest bar */}
                <div className="relative h-5 mr-14">
                  <div
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-3.5 rounded-r ${r.muted ? 'bg-slate-300' : 'bg-blue-600'} ${hovered && !active ? 'opacity-50' : 'opacity-100'} transition-opacity`}
                    style={{ width: `max(${pct}%, 2px)` }}
                  />
                  <span className="absolute top-1/2 -translate-y-1/2 text-xs font-medium text-slate-600 whitespace-nowrap" style={{ left: `calc(${pct}% + 6px)` }}>
                    {formatCompact(r.amount)}
                  </span>
                </div>
                {active && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap">
                    <div className="font-semibold">{r.label}</div>
                    <div>{formatINR(r.amount)} · {share.toFixed(1)}% of total</div>
                    <div className="text-slate-300">{r.count} {r.count === 1 ? countLabel.replace(/s$/, '') : countLabel}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
