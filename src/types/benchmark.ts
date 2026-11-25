/**
 * Interfaccia comune per il sistema a plugin degli algoritmi di compressione.
 * Per aggiungere un nuovo algoritmo è sufficiente implementare questa interfaccia
 * e registrarlo in `src/algorithms/index.ts`.
 */
export interface CompressionAlgorithm {
  /** Identificatore univoco dell'algoritmo (es. "rle", "lzss", "bwt-mtf") */
  id: string;
  /** Nome leggibile mostrato nella dashboard */
  name: string;
  /** Nome breve per grafici e badge */
  shortName: string;
  /** Categoria tecnica (es. "Dictionary", "Entropy", "Block-Sorting", "Native Stream") */
  category: string;
  /** Descrizione sintetica del funzionamento */
  description: string;
  /** Complessità temporale / note prestazionali */
  complexity: string;
  /** File sorgente relativo per il Code Inspector */
  sourceFile: string;
  /** Codice sorgente TypeScript grezzo importato tramite Vite `?raw` */
  sourceCode: string;
  /** True se delega a un engine nativo del browser (es. CompressionStream/zlib) */
  isNativeEngine?: boolean;
  /**
   * Comprime un buffer di byte in modo strettamente lossless.
   * Può essere sincrono o asincrono (es. CompressionStream API).
   */
  compress(
    data: Uint8Array,
    onProgress?: (progress: number) => void,
  ): Uint8Array | Promise<Uint8Array>;
  /**
   * Decomprime il buffer prodotto da `compress`, restituendo i byte originali identici.
   */
  decompress(
    data: Uint8Array,
    onProgress?: (progress: number) => void,
  ): Uint8Array | Promise<Uint8Array>;
}

export type SliceLimitId = '1mb' | '10mb' | '100mb' | 'full';

export interface SliceOption {
  id: SliceLimitId;
  label: string;
  bytes: number | null; // null = file intero
  hint: string;
}

export const SLICE_OPTIONS: SliceOption[] = [
  { id: '1mb', label: '1 MB', bytes: 1_048_576, hint: 'Test rapido (< 1s)' },
  { id: '10mb', label: '10 MB', bytes: 10_485_760, hint: 'Benchmark bilanciato' },
  { id: '100mb', label: '100 MB', bytes: 104_857_600, hint: 'Stress test (tipo enwik8)' },
  { id: 'full', label: 'File intero', bytes: null, hint: 'Intero dataset (es. 1 GB enwik9)' },
];

export interface InputFileMetadata {
  name: string;
  totalBytes: number;
  sliceBytes: number;
  sliceLimitId: SliceLimitId;
  sha256: string;
  crc32: string;
  isEnwik9Candidate: boolean;
  isSample: boolean;
  hashDurationMs: number;
}

export type BenchmarkPhase =
  | 'idle'
  | 'hashing'
  | 'reading'
  | 'compressing'
  | 'decompressing'
  | 'verifying'
  | 'completed'
  | 'aborted'
  | 'error';

export interface MemoryMeasurement {
  /** True se `performance.memory` è supportato dal browser (Chromium) */
  supported: boolean;
  /** Picco JS heap osservato durante il benchmark (byte), se supportato */
  peakHeapBytes: number | null;
  /** Delta approssimativo di heap usato rispetto all'inizio dell'algoritmo (byte) */
  deltaHeapBytes: number | null;
  /** Stima deterministica dei buffer allocati (input + compressed + decompressed) */
  estimatedBufferBytes: number;
}

export interface BenchmarkResult {
  algorithmId: string;
  algorithmName: string;
  shortName: string;
  category: string;
  isNativeEngine: boolean;
  originalBytes: number;
  compressedBytes: number;
  /** Dimensione del codice sorgente dell'algoritmo (UTF-8 byte) — metrica Hutter Prize */
  algorithmCodeBytes: number;
  /** Hutter Score totale: compressedBytes + algorithmCodeBytes */
  totalHutterBytes: number;
  /** Rapporto di compressione puro: originalBytes / compressedBytes */
  compressionRatio: number;
  /** Rapporto effettivo Hutter Prize: originalBytes / (compressedBytes + algorithmCodeBytes) */
  effectiveRatio: number;
  /** Percentuale di risparmio puro: (1 - compressed / original) * 100 */
  savingsPercent: number;
  /** Percentuale di risparmio effettivo Hutter: (1 - totalHutterBytes / original) * 100 */
  effectiveSavingsPercent: number;
  /** Bit per carattere / byte (BPC = compressedBytes * 8 / originalBytes) */
  bitsPerByte: number;
  compressTimeMs: number;
  decompressTimeMs: number;
  /** Throughput in MB/s (basato su 1024*1024 byte/MB) */
  compressThroughputMBs: number;
  decompressThroughputMBs: number;
  /** Verifica byte-per-byte + CRC32 */
  verified: boolean;
  mismatchIndex: number | null;
  memory: MemoryMeasurement;
  error?: string;
  timestamp: string;
}

export interface ExecutionProgress {
  phase: BenchmarkPhase;
  currentAlgorithmId: string | null;
  currentAlgorithmName: string | null;
  algorithmIndex: number;
  totalAlgorithms: number;
  /** Progresso 0..1 della fase corrente */
  phaseProgress: number;
  /** Progresso complessivo 0..1 */
  overallProgress: number;
  statusMessage: string;
}

/* ── Messaggi Main Thread <-> Web Worker ── */

export type WorkerRequest =
  | {
      type: 'HASH_FILE';
      file: File;
      sliceBytes: number;
    }
  | {
      type: 'RUN_BENCHMARK';
      file: File;
      sliceBytes: number;
      algorithmIds: string[];
    };

export type WorkerResponse =
  | {
      type: 'HASH_PROGRESS';
      progress: number;
    }
  | {
      type: 'HASH_COMPLETE';
      sha256: string;
      crc32: string;
      sliceBytes: number;
      durationMs: number;
    }
  | {
      type: 'BENCHMARK_PROGRESS';
      progress: ExecutionProgress;
    }
  | {
      type: 'ALGORITHM_RESULT';
      result: BenchmarkResult;
    }
  | {
      type: 'BENCHMARK_COMPLETE';
      totalDurationMs: number;
    }
  | {
      type: 'WORKER_ERROR';
      message: string;
    };
