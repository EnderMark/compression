import { Award, CheckCircle2, Gauge, HardDriveDownload } from 'lucide-react';
import type { BenchmarkResult } from '../types/benchmark';
import {
  formatBytes,
  formatRatio,
  formatSavings,
  formatThroughput,
} from '../utils/format';

interface SummaryStripProps {
  results: BenchmarkResult[];
}

export function SummaryStrip({ results }: SummaryStripProps) {
  const validResults = results.filter((r) => !r.error && r.compressedBytes > 0);
  if (results.length === 0) return null;

  const bestHutter = validResults.reduce<BenchmarkResult | null>(
    (best, cur) => (!best || cur.totalHutterBytes < best.totalHutterBytes ? cur : best),
    null,
  );

  const fastestComp = validResults.reduce<BenchmarkResult | null>(
    (best, cur) =>
      !best || cur.compressThroughputMBs > best.compressThroughputMBs ? cur : best,
    null,
  );

  const passCount = results.filter((r) => r.verified && !r.error).length;
  const allPass = passCount === results.length;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-[#232b3b] bg-[#111620] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Miglior Hutter Ratio (Dati+Codice)</span>
          <Award className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-slate-100 tabular-nums">
            {bestHutter ? formatRatio(bestHutter.effectiveRatio) : '—'}
          </span>
          {bestHutter && (
            <span className="font-mono text-xs font-medium text-emerald-400 tabular-nums">
              {formatSavings(bestHutter.effectiveSavingsPercent)}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {bestHutter ? bestHutter.algorithmName : 'Nessun risultato valido'}
        </div>
      </div>

      <div className="rounded-xl border border-[#232b3b] bg-[#111620] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Compressione più veloce</span>
          <Gauge className="h-4 w-4 text-sky-400" />
        </div>
        <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
          {fastestComp ? formatThroughput(fastestComp.compressThroughputMBs) : '—'}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {fastestComp ? fastestComp.algorithmName : '—'}
        </div>
      </div>

      <div className="rounded-xl border border-[#232b3b] bg-[#111620] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Miglior Hutter Score Totale</span>
          <HardDriveDownload className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
          {bestHutter ? formatBytes(bestHutter.totalHutterBytes) : '—'}
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
          {bestHutter
            ? `${formatBytes(bestHutter.compressedBytes)} dati + ${formatBytes(bestHutter.algorithmCodeBytes, 1)} codice`
            : '—'}
        </div>
      </div>

      <div className="rounded-xl border border-[#232b3b] bg-[#111620] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Verifica Lossless</span>
          <CheckCircle2
            className={`h-4 w-4 ${allPass ? 'text-emerald-400' : 'text-red-400'}`}
          />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${
              allPass ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {passCount}/{results.length}
          </span>
          <span className="text-xs font-medium text-slate-400">PASS</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {allPass
            ? 'Tutti i byte decompressi coincidono'
            : 'Rilevato almeno un errore di integrità'}
        </div>
      </div>
    </div>
  );
}
