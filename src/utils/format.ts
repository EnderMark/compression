export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

export function formatExactBytes(bytes: number): string {
  return `${bytes.toLocaleString('it-IT')} B`;
}

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatThroughput(mbs: number): string {
  if (!Number.isFinite(mbs) || mbs <= 0) return '—';
  if (mbs >= 100) return `${mbs.toFixed(1)} MB/s`;
  return `${mbs.toFixed(2)} MB/s`;
}

export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '—';
  return `${ratio.toFixed(2)}x`;
}

export function formatSavings(savingsPercent: number): string {
  if (!Number.isFinite(savingsPercent)) return '—';
  // Se savingsPercent > 0 significa che il file è più piccolo (es. -70.8%)
  // Se savingsPercent < 0 significa che il file è espanso (es. +1.2%)
  if (savingsPercent >= 0) {
    return `-${savingsPercent.toFixed(1)}%`;
  }
  return `+${Math.abs(savingsPercent).toFixed(1)}%`;
}

export function truncateHash(hash: string, head = 12, tail = 8): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
