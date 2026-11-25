import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import type { BenchmarkResult } from '../types/benchmark';
import {
  formatBytes,
  formatDuration,
  formatRatio,
  formatSavings,
  formatThroughput,
} from '../utils/format';

interface BenchmarkChartsProps {
  results: BenchmarkResult[];
}

type ChartTab = 'size' | 'throughput' | 'time';

export function BenchmarkCharts({ results }: BenchmarkChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('size');

  const valid = results.filter((r) => !r.error && r.compressedBytes > 0);
  if (valid.length === 0) return null;

  const maxSize = Math.max(
    valid[0].originalBytes,
    ...valid.map((r) => r.compressedBytes),
  );
  const maxThroughput = Math.max(
    1,
    ...valid.map((r) => Math.max(r.compressThroughputMBs, r.decompressThroughputMBs)),
  );
  const maxTime = Math.max(
    1,
    ...valid.map((r) => Math.max(r.compressTimeMs, r.decompressTimeMs)),
  );

  return (
    <section className="rounded-xl border border-[#232b3b] bg-[#111620] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            Grafici Comparativi (Real-Time)
          </h2>
        </div>

        <div className="inline-flex rounded-lg border border-[#232b3b] bg-[#0d1119] p-0.5 text-xs">
          {(
            [
              { id: 'size', label: 'Dimensione & Ratio' },
              { id: 'throughput', label: 'Throughput (MB/s)' },
              { id: 'time', label: 'Tempi (ms)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              id={`chart-tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                activeTab === tab.id
                  ? 'bg-[#1c2436] text-slate-100 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'size' && (
        <div className="space-y-3.5">
          {/* Baseline 100% */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-400">
                Originale (non compresso)
              </span>
              <span className="font-mono text-slate-300 tabular-nums">
                {formatBytes(valid[0].originalBytes)} · 1.00x
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-[#1a2232]">
              <div
                className="h-full rounded bg-slate-600/70"
                style={{
                  width: `${(valid[0].originalBytes / maxSize) * 100}%`,
                }}
              />
            </div>
          </div>

          {valid.map((r) => {
            const pctOfMax = Math.max(1.5, (r.compressedBytes / maxSize) * 100);
            const expanded = r.compressedBytes > r.originalBytes;
            return (
              <div key={r.algorithmId}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {r.algorithmName}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                        expanded
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {formatRatio(r.compressionRatio)} ({formatSavings(r.savingsPercent)})
                    </span>
                  </div>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {formatBytes(r.compressedBytes)}
                  </span>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded bg-[#1a2232]">
                  <div
                    className={`h-full rounded transition-all duration-300 ${
                      expanded ? 'bg-amber-500/80' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pctOfMax}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'throughput' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-400" />
              Compressione (MB/s)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
              Decompressione (MB/s)
            </span>
          </div>

          {valid.map((r) => {
            const compPct = Math.max(
              1.5,
              (r.compressThroughputMBs / maxThroughput) * 100,
            );
            const decompPct = Math.max(
              1.5,
              (r.decompressThroughputMBs / maxThroughput) * 100,
            );
            return (
              <div key={r.algorithmId} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    {r.algorithmName}
                  </span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    Comp:{' '}
                    <span className="text-emerald-300">
                      {formatThroughput(r.compressThroughputMBs)}
                    </span>{' '}
                    · Decomp:{' '}
                    <span className="text-sky-300">
                      {formatThroughput(r.decompressThroughputMBs)}
                    </span>
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded bg-[#1a2232]">
                    <div
                      className="h-full rounded bg-emerald-400 transition-all duration-300"
                      style={{ width: `${compPct}%` }}
                    />
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded bg-[#1a2232]">
                    <div
                      className="h-full rounded bg-sky-400 transition-all duration-300"
                      style={{ width: `${decompPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'time' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" />
              Tempo Compressione
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
              Tempo Decompressione
            </span>
          </div>

          {valid.map((r) => {
            const compPct = Math.max(1.5, (r.compressTimeMs / maxTime) * 100);
            const decompPct = Math.max(1.5, (r.decompressTimeMs / maxTime) * 100);
            return (
              <div key={r.algorithmId} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    {r.algorithmName}
                  </span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    Comp:{' '}
                    <span className="text-amber-300">
                      {formatDuration(r.compressTimeMs)}
                    </span>{' '}
                    · Decomp:{' '}
                    <span className="text-sky-300">
                      {formatDuration(r.decompressTimeMs)}
                    </span>
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded bg-[#1a2232]">
                    <div
                      className="h-full rounded bg-amber-400 transition-all duration-300"
                      style={{ width: `${compPct}%` }}
                    />
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded bg-[#1a2232]">
                    <div
                      className="h-full rounded bg-sky-400 transition-all duration-300"
                      style={{ width: `${decompPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
