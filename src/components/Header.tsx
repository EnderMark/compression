import { Cpu, Download, FileJson, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import type { BenchmarkResult } from '../types/benchmark';

interface HeaderProps {
  results: BenchmarkResult[];
  isRunning: boolean;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export function Header({ results, isRunning, onExportJson, onExportCsv }: HeaderProps) {
  const hasResults = results.length > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-[#232b3b] bg-[#0b0e14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
                enwik9 Bench
              </h1>
              <span className="hidden rounded border border-[#2a3447] bg-[#141a26] px-2 py-0.5 font-mono text-[11px] font-medium text-slate-400 sm:inline-block">
                Hutter Prize · Lossless Suite
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Benchmark client-side con Web Workers dedicati e verifica integrità byte-per-byte
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-md border border-[#232b3b] bg-[#111620] px-2.5 py-1.5 text-xs text-slate-400 md:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>100% Locale · Zero Upload</span>
          </div>

          <button
            id="btn-export-json"
            type="button"
            disabled={!hasResults || isRunning}
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2a3447] bg-[#141a26] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#3b4863] hover:bg-[#1a2233] disabled:cursor-not-allowed disabled:opacity-40"
            title="Esporta risultati in JSON"
          >
            <FileJson className="h-3.5 w-3.5 text-sky-400" />
            <span>JSON</span>
          </button>

          <button
            id="btn-export-csv"
            type="button"
            disabled={!hasResults || isRunning}
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2a3447] bg-[#141a26] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#3b4863] hover:bg-[#1a2233] disabled:cursor-not-allowed disabled:opacity-40"
            title="Esporta risultati in CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>CSV</span>
            <Download className="h-3 w-3 opacity-60" />
          </button>
        </div>
      </div>
    </header>
  );
}
