/**
 * Deflate / Gzip — Compressione nativa del browser tramite Web Streams API
 * (`CompressionStream` / `DecompressionStream`).
 *
 * Caratteristiche:
 * - Sfrutta l'implementazione nativa C/C++ (zlib) integrata nel browser.
 * - Alimenta lo stream a chunk da 1 MB per evitare picchi di memoria e
 *   aggiornare fluidamente la barra di progresso anche su file di grandi dimensioni.
 */

const STREAM_CHUNK_SIZE = 1024 * 1024; // 1 MB

async function runNativeStream(
  data: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
  const n = data.length;
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  const outputChunks: Uint8Array[] = [];
  let totalOutLen = 0;

  // Avvia la lettura in parallelo alla scrittura per evitare backpressure/deadlock
  const readPromise = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        outputChunks.push(value);
        totalOutLen += value.byteLength;
      }
    }
  })();

  // Scrive l'input in chunk da 1 MB
  let offset = 0;
  while (offset < n) {
    const end = Math.min(offset + STREAM_CHUNK_SIZE, n);
    // Crea una view slice senza copiare il buffer sottostante
    const slice = data.subarray(offset, end);
    await writer.write(slice as BufferSource);
    offset = end;
    onProgress?.(n > 0 ? offset / n : 1);
  }
  await writer.close();
  await readPromise;

  // Unisce i chunk di output in un singolo Uint8Array
  const result = new Uint8Array(totalOutLen);
  let pos = 0;
  for (const chunk of outputChunks) {
    result.set(chunk, pos);
    pos += chunk.byteLength;
  }

  onProgress?.(1);
  return result;
}

export async function compressGzip(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream API non supportata in questo browser.');
  }
  return runNativeStream(data, new CompressionStream('gzip'), onProgress);
}

export async function decompressGzip(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream API non supportata in questo browser.');
  }
  return runNativeStream(data, new DecompressionStream('gzip'), onProgress);
}
