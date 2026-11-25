import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  Fingerprint,
  HardDrive,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
  SLICE_OPTIONS,
  type InputFileMetadata,
  type SliceLimitId,
} from '../types/benchmark';
import {
  formatBytes,
  formatDuration,
  formatExactBytes,
  truncateHash,
} from '../utils/format';

interface InputPanelProps {
  file: File | null;
  metadata: InputFileMetadata | null;
  sliceLimitId: SliceLimitId;
  isHashing: boolean;
  hashProgress: number;
  isRunning: boolean;
  onSelectFile: (file: File, isSample?: boolean) => void;
  onChangeSlice: (sliceId: SliceLimitId) => void;
  onLoadSample: () => void;
  onDownloadSample: () => void;
}

export function InputPanel({
  file,
  metadata,
  sliceLimitId,
  isHashing,
  hashProgress,
  isRunning,
  onSelectFile,
  onChangeSlice,
  onLoadSample,
  onDownloadSample,
}: InputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isRunning) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onSelectFile(dropped, false);
    }
  };

  const handleCopySha = async () => {
    if (!metadata?.sha256) return;
    try {
      await navigator.clipboard.writeText(metadata.sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1800);
    } catch {
      // Clipboard API non disponibile
    }
  };

  const activeSliceBytes =
    file && metadata ? metadata.sliceBytes : file ? file.size : 0;
  const showLargeFileWarning = activeSliceBytes > 120 * 1024 * 1024;

  return (
    <section className="rounded-xl border border-[#232b3b] bg-[#111620] p-4 sm:p-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            1. Dataset di Input (<code className="font-mono text-emerald-300">enwik9</code> / File locale)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-load-sample"
            type="button"
            disabled={isRunning}
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Genera XML Wikipedia (1 MB)</span>
          </button>
          <button
            id="btn-download-sample"
            type="button"
            onClick={onDownloadSample}
            className="inline-flex items-center gap-1 rounded-md border border-[#2a3447] bg-[#171d2a] px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-[#1e2638]"
            title="Scarica il file XML di esempio sul disco"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Scarica esempio</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        id="dropzone-input"
        role="button"
        tabIndex={0}
        onClick={() => !isRunning && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isRunning) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isRunning) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition ${
          isDragging
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-[#323d52] bg-[#0d1119] hover:border-slate-500 hover:bg-[#121824]'
        } ${isRunning ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          id="file-picker-input"
          type="file"
          className="hidden"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) onSelectFile(chosen, false);
            e.target.value = '';
          }}
        />
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-[#2a3447] bg-[#151c29] text-slate-300 transition group-hover:border-emerald-500/40 group-hover:text-emerald-300">
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-200">
          Trascina qui <code className="font-mono text-emerald-300">enwik9</code> o clicca per selezionare un file
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Elaborazione interamente client-side tramite <code className="font-mono text-slate-300">File.slice()</code> — nessun dato lascia il browser
        </p>
      </div>

      {/* Slice / Limite dimensione */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">
            Slice / Limite dimensione benchmark
          </span>
          <span className="text-[11px] text-slate-500">
            Testa velocemente un prefisso prima di lanciare 1 GB
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SLICE_OPTIONS.map((opt) => {
            const selected = sliceLimitId === opt.id;
            return (
              <button
                key={opt.id}
                id={`slice-opt-${opt.id}`}
                type="button"
                disabled={isRunning}
                onClick={() => onChangeSlice(opt.id)}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition disabled:opacity-50 ${
                  selected
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                    : 'border-[#232b3b] bg-[#151b27] text-slate-300 hover:border-[#344057] hover:bg-[#1a2232]'
                }`}
              >
                <span className="font-mono text-xs font-semibold">{opt.label}</span>
                <span className="mt-0.5 text-[11px] text-slate-400">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* File Telemetry & Validation */}
      {file && (
        <div className="mt-4 rounded-lg border border-[#232b3b] bg-[#0d1119] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e2636] pb-2.5">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="truncate font-mono text-xs font-semibold text-slate-100">
                {file.name}
              </span>
              {metadata?.isEnwik9Candidate && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  enwik9 VERIFICATO
                </span>
              )}
              {metadata?.isSample && (
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-300">
                  SAMPLE XML
                </span>
              )}
            </div>

            <div className="font-mono text-xs text-slate-400 tabular-nums">
              Totale: <span className="text-slate-200">{formatBytes(file.size)}</span>{' '}
              <span className="text-slate-500">({formatExactBytes(file.size)})</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">
                Slice attivo
              </div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-emerald-300 tabular-nums">
                {formatBytes(activeSliceBytes)}
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {formatExactBytes(activeSliceBytes)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-500">
                <Fingerprint className="h-3 w-3" />
                <span>SHA-256 (slice)</span>
              </div>
              {isHashing ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-amber-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="font-mono tabular-nums">
                    Calcolo hash... {Math.round(hashProgress * 100)}%
                  </span>
                </div>
              ) : metadata ? (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <code
                    className="font-mono text-xs text-slate-200"
                    title={metadata.sha256}
                  >
                    {truncateHash(metadata.sha256, 10, 8)}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySha}
                    className="rounded p-1 text-slate-400 hover:bg-[#1b2333] hover:text-slate-200"
                    title="Copia SHA-256 completo"
                  >
                    {copiedHash ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-0.5 font-mono text-xs text-slate-500">—</div>
              )}
              {metadata && !isHashing && (
                <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                  Calcolato in {formatDuration(metadata.hashDurationMs)}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">
                CRC32 (IEEE)
              </div>
              <div className="mt-0.5 font-mono text-xs font-medium text-slate-200">
                {isHashing ? '...' : metadata ? `0x${metadata.crc32.toUpperCase()}` : '—'}
              </div>
              <div className="text-[11px] text-slate-500">
                Usato per controllo integrità
              </div>
            </div>
          </div>

          {showLargeFileWarning && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Stai per elaborare <strong>{formatBytes(activeSliceBytes)}</strong> in memoria nel browser.
                Su slice superiori a 100 MB, algoritmi in puro JS come BWT+MTF o LZSS possono richiedere diversi minuti e RAM elevata: usa il pulsante <strong>Abort</strong> in qualsiasi momento se necessario.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
