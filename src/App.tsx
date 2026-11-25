import { useCallback, useEffect, useRef, useState } from 'react';
import { COMPRESSION_ALGORITHMS, getAlgorithmById } from './algorithms';
import { AlgorithmList } from './components/AlgorithmList';
import { BenchmarkCharts } from './components/BenchmarkCharts';
import { CodeInspectorModal } from './components/CodeInspectorModal';
import { Header } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { ResultsTable } from './components/ResultsTable';
import { SummaryStrip } from './components/SummaryStrip';
import {
  SLICE_OPTIONS,
  type BenchmarkResult,
  type CompressionAlgorithm,
  type ExecutionProgress,
  type InputFileMetadata,
  type SliceLimitId,
  type WorkerRequest,
  type WorkerResponse,
} from './types/benchmark';
import { exportResultsAsCSV, exportResultsAsJSON } from './utils/exportResults';
import {
  generateWikipediaSampleFile,
  triggerFileDownload,
  type SampleSizeOption,
} from './utils/sampleGenerator';

const INITIAL_PROGRESS: ExecutionProgress = {
  phase: 'idle',
  currentAlgorithmId: null,
  currentAlgorithmName: null,
  algorithmIndex: 0,
  totalAlgorithms: 0,
  phaseProgress: 0,
  overallProgress: 0,
  statusMessage: '',
};

function computeSliceBytes(fileSize: number, sliceId: SliceLimitId): number {
  const opt = SLICE_OPTIONS.find((o) => o.id === sliceId);
  if (!opt || opt.bytes === null) return fileSize;
  return Math.min(fileSize, opt.bytes);
}

function isLikelyEnwik9(file: File): boolean {
  return (
    file.size === 1_000_000_000 ||
    file.name.toLowerCase() === 'enwik9' ||
    file.name.toLowerCase() === 'enwik8'
  );
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isSampleFile, setIsSampleFile] = useState(false);
  const [sliceLimitId, setSliceLimitId] = useState<SliceLimitId>('1mb');
  const [metadata, setMetadata] = useState<InputFileMetadata | null>(null);

  const [isHashing, setIsHashing] = useState(false);
  const [hashProgress, setHashProgress] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(COMPRESSION_ALGORITHMS.map((a) => a.id)),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ExecutionProgress>(INITIAL_PROGRESS);
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  const [inspectedAlgorithm, setInspectedAlgorithm] =
    useState<CompressionAlgorithm | null>(null);

  const hashWorkerRef = useRef<Worker | null>(null);
  const benchWorkerRef = useRef<Worker | null>(null);

  // Pulizia dei Web Workers allo smontaggio
  useEffect(() => {
    return () => {
      hashWorkerRef.current?.terminate();
      benchWorkerRef.current?.terminate();
    };
  }, []);

  // Calcola SHA-256 + CRC32 dello slice attivo in un Web Worker dedicato
  const startHashing = useCallback(
    (targetFile: File, targetSliceId: SliceLimitId, sampleFlag: boolean) => {
      hashWorkerRef.current?.terminate();

      const worker = new Worker(
        new URL('./workers/benchmark.worker.ts', import.meta.url),
        { type: 'module' },
      );
      hashWorkerRef.current = worker;

      const sliceBytes = computeSliceBytes(targetFile.size, targetSliceId);
      setIsHashing(true);
      setHashProgress(0);
      setMetadata({
        name: targetFile.name,
        totalBytes: targetFile.size,
        sliceBytes,
        sliceLimitId: targetSliceId,
        sha256: '',
        crc32: '',
        isEnwik9Candidate: isLikelyEnwik9(targetFile),
        isSample: sampleFlag,
        hashDurationMs: 0,
      });

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === 'HASH_PROGRESS') {
          setHashProgress(msg.progress);
        } else if (msg.type === 'HASH_COMPLETE') {
          setIsHashing(false);
          setHashProgress(1);
          setMetadata({
            name: targetFile.name,
            totalBytes: targetFile.size,
            sliceBytes: msg.sliceBytes,
            sliceLimitId: targetSliceId,
            sha256: msg.sha256,
            crc32: msg.crc32,
            isEnwik9Candidate: isLikelyEnwik9(targetFile),
            isSample: sampleFlag,
            hashDurationMs: msg.durationMs,
          });
          worker.terminate();
          if (hashWorkerRef.current === worker) {
            hashWorkerRef.current = null;
          }
        } else if (msg.type === 'WORKER_ERROR') {
          setIsHashing(false);
          worker.terminate();
        }
      };

      const request: WorkerRequest = {
        type: 'HASH_FILE',
        file: targetFile,
        sliceBytes,
      };
      worker.postMessage(request);
    },
    [],
  );

  const handleSelectFile = useCallback(
    (chosenFile: File, sampleFlag = false) => {
      setFile(chosenFile);
      setIsSampleFile(sampleFlag);
      setResults([]);
      setProgress(INITIAL_PROGRESS);
      startHashing(chosenFile, sliceLimitId, sampleFlag);
    },
    [sliceLimitId, startHashing],
  );

  const handleChangeSlice = useCallback(
    (nextSliceId: SliceLimitId) => {
      setSliceLimitId(nextSliceId);
      if (file) {
        startHashing(file, nextSliceId, isSampleFile);
      }
    },
    [file, isSampleFile, startHashing],
  );

  const handleLoadSample = useCallback(
    (option: SampleSizeOption) => {
      const sample = generateWikipediaSampleFile(option.bytes, option.filename);
      // Adegua automaticamente lo slice se quello corrente è più piccolo del sample scelto
      const currentLimitBytes =
        SLICE_OPTIONS.find((o) => o.id === sliceLimitId)?.bytes ?? null;
      let nextSliceId: SliceLimitId = sliceLimitId;
      if (currentLimitBytes !== null && option.bytes > currentLimitBytes) {
        if (option.bytes <= 10_485_760) nextSliceId = '10mb';
        else if (option.bytes <= 104_857_600) nextSliceId = '100mb';
        else nextSliceId = 'full';
        setSliceLimitId(nextSliceId);
      }

      setFile(sample);
      setIsSampleFile(true);
      setResults([]);
      setProgress(INITIAL_PROGRESS);
      startHashing(sample, nextSliceId, true);
    },
    [sliceLimitId, startHashing],
  );

  const handleDownloadSample = useCallback((option: SampleSizeOption) => {
    const sample = generateWikipediaSampleFile(option.bytes, option.filename);
    triggerFileDownload(sample);
  }, []);

  const handleToggleAlgorithm = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleRunBenchmark = useCallback(() => {
    if (!file || selectedIds.size === 0 || isRunning) return;

    benchWorkerRef.current?.terminate();
    const worker = new Worker(
      new URL('./workers/benchmark.worker.ts', import.meta.url),
      { type: 'module' },
    );
    benchWorkerRef.current = worker;

    const orderedIds = COMPRESSION_ALGORITHMS.filter((a) =>
      selectedIds.has(a.id),
    ).map((a) => a.id);

    const sliceBytes = computeSliceBytes(file.size, sliceLimitId);

    setResults([]);
    setIsRunning(true);
    setProgress({
      phase: 'reading',
      currentAlgorithmId: null,
      currentAlgorithmName: null,
      algorithmIndex: 0,
      totalAlgorithms: orderedIds.length,
      phaseProgress: 0,
      overallProgress: 0.01,
      statusMessage: 'Inizializzazione Web Worker...',
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'BENCHMARK_PROGRESS') {
        setProgress(msg.progress);
      } else if (msg.type === 'ALGORITHM_RESULT') {
        setResults((prev) => [...prev, msg.result]);
      } else if (msg.type === 'BENCHMARK_COMPLETE') {
        setIsRunning(false);
        worker.terminate();
        if (benchWorkerRef.current === worker) {
          benchWorkerRef.current = null;
        }
      } else if (msg.type === 'WORKER_ERROR') {
        setIsRunning(false);
        setProgress((prev) => ({
          ...prev,
          phase: 'error',
          statusMessage: `Errore nel worker: ${msg.message}`,
        }));
        worker.terminate();
        if (benchWorkerRef.current === worker) {
          benchWorkerRef.current = null;
        }
      }
    };

    worker.onerror = (err) => {
      setIsRunning(false);
      setProgress((prev) => ({
        ...prev,
        phase: 'error',
        statusMessage: `Errore imprevisto nel worker: ${err.message}`,
      }));
      worker.terminate();
      if (benchWorkerRef.current === worker) {
        benchWorkerRef.current = null;
      }
    };

    const req: WorkerRequest = {
      type: 'RUN_BENCHMARK',
      file,
      sliceBytes,
      algorithmIds: orderedIds,
    };
    worker.postMessage(req);
  }, [file, isRunning, selectedIds, sliceLimitId]);

  const handleAbortBenchmark = useCallback(() => {
    if (benchWorkerRef.current) {
      benchWorkerRef.current.terminate();
      benchWorkerRef.current = null;
    }
    setIsRunning(false);
    setProgress((prev) => ({
      ...prev,
      phase: 'aborted',
      statusMessage: 'Benchmark interrotto manualmente (Web Worker terminato).',
    }));
  }, []);

  const handleInspectById = useCallback((algorithmId: string) => {
    const algo = getAlgorithmById(algorithmId);
    if (algo) setInspectedAlgorithm(algo);
  }, []);

  const canRun = Boolean(file) && selectedIds.size > 0 && !isRunning;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200">
      <Header
        results={results}
        isRunning={isRunning}
        onExportJson={() => exportResultsAsJSON(metadata, results)}
        onExportCsv={() => exportResultsAsCSV(metadata, results)}
      />

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6">
        {/* Top Workbench Controls: Input + Pipeline */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <InputPanel
              file={file}
              metadata={metadata}
              sliceLimitId={sliceLimitId}
              isHashing={isHashing}
              hashProgress={hashProgress}
              isRunning={isRunning}
              onSelectFile={handleSelectFile}
              onChangeSlice={handleChangeSlice}
              onLoadSample={handleLoadSample}
              onDownloadSample={handleDownloadSample}
            />
          </div>

          <div className="lg:col-span-6">
            <AlgorithmList
              algorithms={COMPRESSION_ALGORITHMS}
              selectedIds={selectedIds}
              canRun={canRun}
              isRunning={isRunning}
              progress={progress}
              onToggleAlgorithm={handleToggleAlgorithm}
              onSelectAll={() =>
                setSelectedIds(new Set(COMPRESSION_ALGORITHMS.map((a) => a.id)))
              }
              onSelectNone={() => setSelectedIds(new Set())}
              onInspectCode={setInspectedAlgorithm}
              onRunBenchmark={handleRunBenchmark}
              onAbortBenchmark={handleAbortBenchmark}
            />
          </div>
        </div>

        {/* KPI Summary */}
        <SummaryStrip results={results} />

        {/* Real-time Charts */}
        <BenchmarkCharts results={results} />

        {/* Comparative Metrics Table */}
        <ResultsTable
          results={results}
          onInspectById={handleInspectById}
        />
      </main>

      {/* Code Inspector Slide-Over Modal */}
      <CodeInspectorModal
        algorithm={inspectedAlgorithm}
        onClose={() => setInspectedAlgorithm(null)}
      />
    </div>
  );
}
