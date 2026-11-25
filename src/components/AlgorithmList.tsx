import {
  CheckSquare,
  Code2,
  Layers,
  Play,
  Square,
  OctagonX,
} from 'lucide-react';
import type {
  CompressionAlgorithm,
  ExecutionProgress,
} from '../types/benchmark';

interface AlgorithmListProps {
  algorithms: CompressionAlgorithm[];
  selectedIds: Set<string>;
  canRun: boolean;
  isRunning: boolean;
  progress: ExecutionProgress;
  onToggleAlgorithm: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onInspectCode: (algo: CompressionAlgorithm) => void;
  onRunBenchmark: () => void;
  onAbortBenchmark: () => void;
}

import { formatBytes } from '../utils/format';

const CATEGORY_STYLE: Record<string, string> = {
  'Run-Length': 'border-slate-600/60 bg-slate-800/70 text-slate-300',
  Entropy: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Dictionary: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Block-Sorting': 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  Semantic: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300',
  'Native Stream': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const TEXT_ENCODER = new TextEncoder();

export function AlgorithmList({
  algorithms,
  selectedIds,
  canRun,
  isRunning,
  progress,
  onToggleAlgorithm,
  onSelectAll,
  onSelectNone,
  onInspectCode,
  onRunBenchmark,
  onAbortBenchmark,
}: AlgorithmListProps) {
  const selectedCount = selectedIds.size;

  return (
    <section className="rounded-xl border border-[#232b3b] bg-[#111620] p-4 sm:p-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            2. Pipeline Algoritmi ({selectedCount}/{algorithms.length} selezionati)
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            disabled={isRunning}
            onClick={onSelectAll}
            className="text-slate-400 transition hover:text-slate-200 disabled:opacity-40"
          >
            Tutti
          </button>
          <span className="text-slate-600">·</span>
          <button
            type="button"
            disabled={isRunning}
            onClick={onSelectNone}
            className="text-slate-400 transition hover:text-slate-200 disabled:opacity-40"
          >
            Nessuno
          </button>
        </div>
      </div>

      {/* Algorithm Cards */}
      <div className="space-y-2">
        {algorithms.map((algo) => {
          const checked = selectedIds.has(algo.id);
          const isActive = isRunning && progress.currentAlgorithmId === algo.id;
          const badgeStyle =
            CATEGORY_STYLE[algo.category] ??
            'border-slate-700 bg-slate-800 text-slate-300';
          const codeBytes = TEXT_ENCODER.encode(algo.sourceCode).byteLength;

          return (
            <div
              key={algo.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 transition sm:flex-row sm:items-center sm:justify-between ${
                isActive
                  ? 'border-emerald-500/60 bg-emerald-500/8'
                  : checked
                    ? 'border-[#2d384d] bg-[#151b27]'
                    : 'border-[#1d2433] bg-[#0e131c] opacity-75'
              }`}
            >
              <label className="flex flex-1 cursor-pointer items-start gap-3">
                <input
                  id={`algo-checkbox-${algo.id}`}
                  type="checkbox"
                  checked={checked}
                  disabled={isRunning}
                  onChange={() => onToggleAlgorithm(algo.id)}
                  className="sr-only"
                />
                <span className="mt-0.5 shrink-0 text-emerald-400">
                  {checked ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-500" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">
                      {algo.name}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${badgeStyle}`}
                    >
                      {algo.category}
                    </span>
                    <span
                      className="rounded border border-[#232b3b] bg-[#0e131d] px-1.5 py-0.5 font-mono text-[10px] text-slate-400 tabular-nums"
                      title={
                        algo.isNativeEngine
                          ? 'Dimensione wrapper TS (+ engine zlib nativo del browser)'
                          : 'Dimensione codice sorgente incluso nell’Hutter Score'
                      }
                    >
                      Codice: {formatBytes(codeBytes, 1)}
                      {algo.isNativeEngine ? ' + nativo' : ''}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {algo.complexity}
                    </span>
                    {isActive && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                        IN ESECUZIONE
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {algo.description}
                  </p>
                </div>
              </label>

              <div className="flex shrink-0 items-center justify-end pl-7 sm:pl-2">
                <button
                  id={`btn-inspect-${algo.id}`}
                  type="button"
                  onClick={() => onInspectCode(algo)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2a3447] bg-[#1a2232] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-500/40 hover:bg-[#202a3d] hover:text-sky-200"
                >
                  <Code2 className="h-3.5 w-3.5 text-sky-400" />
                  <span>Ispeziona codice</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Bar & Live Progress */}
      <div className="mt-4 flex flex-col gap-3 border-t border-[#1e2636] pt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {!isRunning ? (
            <button
              id="btn-run-benchmark"
              type="button"
              disabled={!canRun}
              onClick={onRunBenchmark}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-[#1e2636] disabled:text-slate-500"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Avvia Benchmark ({selectedCount} algoritmi)</span>
            </button>
          ) : (
            <button
              id="btn-abort-benchmark"
              type="button"
              onClick={onAbortBenchmark}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/25"
            >
              <OctagonX className="h-4 w-4" />
              <span>Interrompi Benchmark (Abort Worker)</span>
            </button>
          )}
        </div>

        {(isRunning || progress.phase === 'completed' || progress.phase === 'aborted' || progress.phase === 'error') && (
          <div className="rounded-lg border border-[#232b3b] bg-[#0d1119] p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono text-slate-200">
                {progress.statusMessage}
              </span>
              <span className="shrink-0 font-mono font-semibold text-emerald-400 tabular-nums">
                {Math.round(progress.overallProgress * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a2232]">
              <div
                className={`h-full transition-all duration-150 ${
                  progress.phase === 'aborted' || progress.phase === 'error'
                    ? 'bg-red-500'
                    : progress.phase === 'completed'
                      ? 'bg-emerald-400'
                      : 'bg-sky-400'
                }`}
                style={{ width: `${Math.max(2, Math.round(progress.overallProgress * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
