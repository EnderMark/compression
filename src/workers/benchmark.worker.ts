/// <reference lib="webworker" />

import { getAlgorithmById } from '../algorithms';
import type {
  BenchmarkResult,
  ExecutionProgress,
  MemoryMeasurement,
  WorkerRequest,
  WorkerResponse,
} from '../types/benchmark';
import { hashFileSlice } from '../utils/hash';

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

function readHeapBytes(): number | null {
  const perf = performance as PerformanceWithMemory;
  if (perf.memory && typeof perf.memory.usedJSHeapSize === 'number') {
    return perf.memory.usedJSHeapSize;
  }
  return null;
}

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}

/**
 * Confronta due Uint8Array byte-per-byte restituendo l'indice della prima discrepanza
 * oppure `null` se sono identici.
 */
function verifyLossless(
  original: Uint8Array,
  decompressed: Uint8Array,
  onProgress?: (p: number) => void,
): { verified: boolean; mismatchIndex: number | null } {
  const len = original.length;
  if (decompressed.length !== len) {
    return { verified: false, mismatchIndex: Math.min(len, decompressed.length) };
  }

  // Confronto veloce a chunk da 4 MB per aggiornare la UI senza overhead
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < len; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, len);
    for (let i = offset; i < end; i++) {
      if (original[i] !== decompressed[i]) {
        return { verified: false, mismatchIndex: i };
      }
    }
    onProgress?.(len > 0 ? end / len : 1);
  }

  onProgress?.(1);
  return { verified: true, mismatchIndex: null };
}

async function handleHashFile(file: File, sliceBytes: number): Promise<void> {
  const start = performance.now();
  const effectiveSlice = Math.min(file.size, sliceBytes);

  const { sha256, crc32 } = await hashFileSlice(file, effectiveSlice, (progress) => {
    post({ type: 'HASH_PROGRESS', progress });
  });

  post({
    type: 'HASH_COMPLETE',
    sha256,
    crc32,
    sliceBytes: effectiveSlice,
    durationMs: performance.now() - start,
  });
}

async function handleRunBenchmark(
  file: File,
  sliceBytes: number,
  algorithmIds: string[],
): Promise<void> {
  const benchStart = performance.now();
  const totalAlgorithms = algorithmIds.length;
  const effectiveSlice = Math.min(file.size, sliceBytes);

  const emitProgress = (progress: ExecutionProgress) => {
    post({ type: 'BENCHMARK_PROGRESS', progress });
  };

  emitProgress({
    phase: 'reading',
    currentAlgorithmId: null,
    currentAlgorithmName: null,
    algorithmIndex: 0,
    totalAlgorithms,
    phaseProgress: 0.25,
    overallProgress: 0.02,
    statusMessage: `Lettura slice di input (${(effectiveSlice / (1024 * 1024)).toFixed(2)} MB)...`,
  });

  // Carica solo la porzione richiesta (slice) in un singolo Uint8Array condiviso in lettura
  const arrayBuffer = await file.slice(0, effectiveSlice).arrayBuffer();
  const inputData = new Uint8Array(arrayBuffer);
  const originalBytes = inputData.byteLength;
  const originalMB = originalBytes / (1024 * 1024);

  for (let idx = 0; idx < totalAlgorithms; idx++) {
    const algoId = algorithmIds[idx];
    const algo = getAlgorithmById(algoId);
    if (!algo) continue;

    const baseOverall = idx / totalAlgorithms;
    const stepWeight = 1 / totalAlgorithms;

    const heapStart = readHeapBytes();
    let peakHeap = heapStart;

    const sampleHeap = () => {
      const current = readHeapBytes();
      if (current !== null && (peakHeap === null || current > peakHeap)) {
        peakHeap = current;
      }
    };

    try {
      // 1. COMPRESSIONE
      emitProgress({
        phase: 'compressing',
        currentAlgorithmId: algo.id,
        currentAlgorithmName: algo.name,
        algorithmIndex: idx,
        totalAlgorithms,
        phaseProgress: 0,
        overallProgress: baseOverall,
        statusMessage: `[${idx + 1}/${totalAlgorithms}] ${algo.name} — Compressione...`,
      });

      const compStart = performance.now();
      const compressed = await algo.compress(inputData, (p) => {
        sampleHeap();
        emitProgress({
          phase: 'compressing',
          currentAlgorithmId: algo.id,
          currentAlgorithmName: algo.name,
          algorithmIndex: idx,
          totalAlgorithms,
          phaseProgress: p,
          overallProgress: baseOverall + p * stepWeight * 0.55,
          statusMessage: `[${idx + 1}/${totalAlgorithms}] ${algo.name} — Compressione (${Math.round(p * 100)}%)`,
        });
      });
      const compressTimeMs = Math.max(0.01, performance.now() - compStart);
      sampleHeap();

      const compressedBytes = compressed.byteLength;

      // 2. DECOMPRESSIONE
      emitProgress({
        phase: 'decompressing',
        currentAlgorithmId: algo.id,
        currentAlgorithmName: algo.name,
        algorithmIndex: idx,
        totalAlgorithms,
        phaseProgress: 0,
        overallProgress: baseOverall + stepWeight * 0.55,
        statusMessage: `[${idx + 1}/${totalAlgorithms}] ${algo.name} — Decompressione...`,
      });

      const decompStart = performance.now();
      const decompressed = await algo.decompress(compressed, (p) => {
        sampleHeap();
        emitProgress({
          phase: 'decompressing',
          currentAlgorithmId: algo.id,
          currentAlgorithmName: algo.name,
          algorithmIndex: idx,
          totalAlgorithms,
          phaseProgress: p,
          overallProgress: baseOverall + stepWeight * (0.55 + p * 0.35),
          statusMessage: `[${idx + 1}/${totalAlgorithms}] ${algo.name} — Decompressione (${Math.round(p * 100)}%)`,
        });
      });
      const decompressTimeMs = Math.max(0.01, performance.now() - decompStart);
      sampleHeap();

      // 3. VERIFICA LOSSLESS BYTE-PER-BYTE
      emitProgress({
        phase: 'verifying',
        currentAlgorithmId: algo.id,
        currentAlgorithmName: algo.name,
        algorithmIndex: idx,
        totalAlgorithms,
        phaseProgress: 0,
        overallProgress: baseOverall + stepWeight * 0.9,
        statusMessage: `[${idx + 1}/${totalAlgorithms}] ${algo.name} — Verifica integrità byte-per-byte...`,
      });

      const { verified, mismatchIndex } = verifyLossless(inputData, decompressed, (p) => {
        emitProgress({
          phase: 'verifying',
          currentAlgorithmId: algo.id,
          currentAlgorithmName: algo.name,
          algorithmIndex: idx,
          totalAlgorithms,
          phaseProgress: p,
          overallProgress: baseOverall + stepWeight * (0.9 + p * 0.1),
          statusMessage: `[${idx + 1}/${totalAlgorithms}] ${algo.name} — Verifica integrità (${Math.round(p * 100)}%)`,
        });
      });

      const compressionRatio = compressedBytes > 0 ? originalBytes / compressedBytes : 0;
      const savingsPercent =
        originalBytes > 0 ? (1 - compressedBytes / originalBytes) * 100 : 0;
      const bitsPerByte = originalBytes > 0 ? (compressedBytes * 8) / originalBytes : 0;

      const memory: MemoryMeasurement = {
        supported: heapStart !== null,
        peakHeapBytes: peakHeap,
        deltaHeapBytes:
          heapStart !== null && peakHeap !== null ? Math.max(0, peakHeap - heapStart) : null,
        estimatedBufferBytes: originalBytes + compressedBytes + decompressed.byteLength,
      };

      const result: BenchmarkResult = {
        algorithmId: algo.id,
        algorithmName: algo.name,
        shortName: algo.shortName,
        category: algo.category,
        originalBytes,
        compressedBytes,
        compressionRatio,
        savingsPercent,
        bitsPerByte,
        compressTimeMs,
        decompressTimeMs,
        compressThroughputMBs: originalMB / (compressTimeMs / 1000),
        decompressThroughputMBs: originalMB / (decompressTimeMs / 1000),
        verified,
        mismatchIndex,
        memory,
        timestamp: new Date().toISOString(),
      };

      post({ type: 'ALGORITHM_RESULT', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: BenchmarkResult = {
        algorithmId: algo.id,
        algorithmName: algo.name,
        shortName: algo.shortName,
        category: algo.category,
        originalBytes,
        compressedBytes: 0,
        compressionRatio: 0,
        savingsPercent: 0,
        bitsPerByte: 0,
        compressTimeMs: 0,
        decompressTimeMs: 0,
        compressThroughputMBs: 0,
        decompressThroughputMBs: 0,
        verified: false,
        mismatchIndex: null,
        memory: {
          supported: heapStart !== null,
          peakHeapBytes: peakHeap,
          deltaHeapBytes: null,
          estimatedBufferBytes: originalBytes,
        },
        error: message,
        timestamp: new Date().toISOString(),
      };
      post({ type: 'ALGORITHM_RESULT', result });
    }
  }

  emitProgress({
    phase: 'completed',
    currentAlgorithmId: null,
    currentAlgorithmName: null,
    algorithmIndex: totalAlgorithms,
    totalAlgorithms,
    phaseProgress: 1,
    overallProgress: 1,
    statusMessage: `Benchmark completato (${totalAlgorithms} algoritmi verificati).`,
  });

  post({
    type: 'BENCHMARK_COMPLETE',
    totalDurationMs: performance.now() - benchStart,
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === 'HASH_FILE') {
      await handleHashFile(req.file, req.sliceBytes);
    } else if (req.type === 'RUN_BENCHMARK') {
      await handleRunBenchmark(req.file, req.sliceBytes, req.algorithmIds);
    }
  } catch (err) {
    post({
      type: 'WORKER_ERROR',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
