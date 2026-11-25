import type { BenchmarkResult, InputFileMetadata } from '../types/benchmark';

function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportResultsAsJSON(
  metadata: InputFileMetadata | null,
  results: BenchmarkResult[],
): void {
  const payload = {
    tool: 'enwik9 Bench — Client-Side Lossless Compression Workbench',
    exportedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    input: metadata,
    results,
  };
  const filename = `benchmark-${metadata?.name ?? 'dataset'}-${Date.now()}.json`;
  downloadText(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8');
}

export function exportResultsAsCSV(
  metadata: InputFileMetadata | null,
  results: BenchmarkResult[],
): void {
  const headers = [
    'algorithm_id',
    'algorithm_name',
    'category',
    'input_file',
    'original_bytes',
    'compressed_bytes',
    'algorithm_code_bytes',
    'total_hutter_bytes',
    'compression_ratio',
    'effective_hutter_ratio',
    'savings_percent',
    'effective_hutter_savings_percent',
    'bits_per_byte',
    'verified_lossless',
    'compress_time_ms',
    'decompress_time_ms',
    'compress_throughput_mbs',
    'decompress_throughput_mbs',
    'peak_heap_bytes',
    'estimated_buffer_bytes',
    'error',
  ];

  const escapeCsv = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };

  const rows = results.map((r) =>
    [
      r.algorithmId,
      r.algorithmName,
      r.category,
      metadata?.name ?? '',
      r.originalBytes,
      r.compressedBytes,
      r.algorithmCodeBytes,
      r.totalHutterBytes,
      r.compressionRatio.toFixed(4),
      r.effectiveRatio.toFixed(4),
      r.savingsPercent.toFixed(2),
      r.effectiveSavingsPercent.toFixed(2),
      r.bitsPerByte.toFixed(4),
      r.verified ? 'PASS' : 'FAIL',
      r.compressTimeMs.toFixed(2),
      r.decompressTimeMs.toFixed(2),
      r.compressThroughputMBs.toFixed(3),
      r.decompressThroughputMBs.toFixed(3),
      r.memory.peakHeapBytes ?? '',
      r.memory.estimatedBufferBytes,
      r.error ?? '',
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = `benchmark-${metadata?.name ?? 'dataset'}-${Date.now()}.csv`;
  downloadText(csv, filename, 'text/csv;charset=utf-8');
}
