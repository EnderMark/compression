import {
  ArrowUpDown,
  CheckCircle2,
  Code2,
  MemoryStick,
  Table2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BenchmarkResult } from '../types/benchmark';
import {
  formatBytes,
  formatDuration,
  formatExactBytes,
  formatMB,
  formatRatio,
  formatSavings,
  formatThroughput,
} from '../utils/format';

interface ResultsTableProps {
  results: BenchmarkResult[];
  onInspectById: (algorithmId: string) => void;
}

type SortKey =
  | 'compressionRatio'
  | 'compressedBytes'
  | 'compressTimeMs'
  | 'decompressTimeMs'
  | 'compressThroughputMBs';

export function ResultsTable({ results, onInspectById }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('compressionRatio');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    return copy;
  }, [results, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === 'compressedBytes' || key === 'compressTimeMs' || key === 'decompressTimeMs');
    }
  };

  if (results.length === 0) {
    return (
      <section className="rounded-xl border border-[#232b3b] bg-[#111620] p-8 text-center">
        <Table2 className="mx-auto mb-2.5 h-8 w-8 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-300">
          Nessun risultato di benchmark
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Carica <code className="font-mono text-slate-400">enwik9</code> (o genera l&apos;estratto XML di esempio), seleziona gli algoritmi e premi{' '}
          <strong className="text-slate-300">Avvia Benchmark</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#232b3b] bg-[#111620]">
      <div className="flex items-center justify-between border-b border-[#232b3b] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            Tabella Comparativa Metriche
          </h2>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          Clicca sulle intestazioni per ordinare
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#232b3b] bg-[#0d1119] text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-medium">Algoritmo</th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort('compressedBytes')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Originale → Compressa</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort('compressionRatio')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Ratio / Risparmio</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Verifica Lossless</th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort('compressTimeMs')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Tempi (Comp / Decomp)</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort('compressThroughputMBs')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Throughput (MB/s)</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Picco RAM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2636]">
            {sorted.map((r) => {
              const expanded = r.compressedBytes > r.originalBytes;
              return (
                <tr
                  key={r.algorithmId}
                  className="transition hover:bg-[#151c29]"
                >
                  {/* Algoritmo */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-semibold text-slate-100">
                          {r.algorithmName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {r.category}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onInspectById(r.algorithmId)}
                        className="ml-auto rounded p-1 text-slate-500 transition hover:bg-[#1f293d] hover:text-sky-300"
                        title={`Ispeziona codice di ${r.algorithmName}`}
                      >
                        <Code2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Originale -> Compressa */}
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {r.error ? (
                      <span className="text-red-400">Errore</span>
                    ) : (
                      <>
                        <div className="text-slate-200">
                          <span className="text-slate-400">
                            {formatMB(r.originalBytes)}
                          </span>{' '}
                          →{' '}
                          <span className="font-semibold text-slate-100">
                            {formatMB(r.compressedBytes)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatExactBytes(r.compressedBytes)}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Ratio & Risparmio */}
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {r.error ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-100">
                            {formatRatio(r.compressionRatio)}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              expanded
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {formatSavings(r.savingsPercent)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.bitsPerByte.toFixed(2)} bit/byte
                        </div>
                      </>
                    )}
                  </td>

                  {/* Verifica */}
                  <td className="px-4 py-3">
                    {r.verified && !r.error ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        PASS - Lossless
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-[11px] font-semibold text-red-300">
                          <XCircle className="h-3.5 w-3.5" />
                          FAIL - Corrotto
                        </span>
                        {r.error && (
                          <div className="mt-1 max-w-[200px] truncate text-[11px] text-red-400" title={r.error}>
                            {r.error}
                          </div>
                        )}
                        {r.mismatchIndex !== null && (
                          <div className="mt-1 font-mono text-[11px] text-red-400">
                            Mismatch @ byte {r.mismatchIndex}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Tempi */}
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {r.error ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <>
                        <div className="text-amber-300">
                          C: {formatDuration(r.compressTimeMs)}
                        </div>
                        <div className="text-sky-300">
                          D: {formatDuration(r.decompressTimeMs)}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Throughput */}
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {r.error ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <>
                        <div className="text-emerald-300">
                          C: {formatThroughput(r.compressThroughputMBs)}
                        </div>
                        <div className="text-sky-300">
                          D: {formatThroughput(r.decompressThroughputMBs)}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Picco RAM */}
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {r.memory.supported && r.memory.peakHeapBytes !== null ? (
                      <>
                        <div className="flex items-center gap-1 text-slate-200">
                          <MemoryStick className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatBytes(r.memory.peakHeapBytes)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Buffer: ~{formatBytes(r.memory.estimatedBufferBytes)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="text-slate-400"
                          title="performance.memory è esposto solo nei browser basati su Chromium"
                        >
                          N/D (non supportato)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Buffer stimati: ~{formatBytes(r.memory.estimatedBufferBytes)}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
