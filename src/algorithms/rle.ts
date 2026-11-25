/**
 * RLE (Run-Length Encoding) — variante PackBits byte-oriented.
 *
 * Formato binario:
 * - Header: 4 byte (uint32 LE) con la lunghezza originale in byte.
 * - Stream di pacchetti:
 *   - Control byte `h` in [0..127]: sequenza letterale di (h + 1) byte grezzi.
 *   - Control byte `h` in [128..255]: ripetizione di (h - 128 + 3) copie del byte successivo.
 *
 * Vantaggio rispetto al RLE naive: sui dati non comprimibili l'espansione massima
 * è limitata a ~0.78% (1 byte di controllo ogni 128 byte letterali).
 */

const MIN_RUN = 3;
const MAX_RUN = 130; // 127 + 3
const MAX_LITERAL = 128;

export function compressRLE(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  const n = data.length;
  // Worst-case size: 4 byte header + n + ceil(n / 128)
  const maxOut = 4 + n + Math.ceil(n / MAX_LITERAL) + 8;
  const out = new Uint8Array(maxOut);
  const view = new DataView(out.buffer);
  view.setUint32(0, n, true);

  let outPos = 4;
  let i = 0;
  let lastProgressAt = 0;
  const progressStep = Math.max(65536, Math.floor(n / 40));

  while (i < n) {
    // Verifica se inizia una sequenza ripetuta di almeno MIN_RUN byte uguali
    let runLen = 1;
    const val = data[i];
    while (i + runLen < n && runLen < MAX_RUN && data[i + runLen] === val) {
      runLen++;
    }

    if (runLen >= MIN_RUN) {
      out[outPos++] = 128 + (runLen - MIN_RUN);
      out[outPos++] = val;
      i += runLen;
    } else {
      // Accumula byte letterali finché non incontriamo una run >= MIN_RUN o raggiungiamo MAX_LITERAL
      const litStart = i;
      i += runLen;
      while (i < n && i - litStart < MAX_LITERAL) {
        if (
          i + 2 < n &&
          data[i] === data[i + 1] &&
          data[i] === data[i + 2]
        ) {
          break;
        }
        i++;
      }
      const litLen = i - litStart;
      out[outPos++] = litLen - 1;
      out.set(data.subarray(litStart, litStart + litLen), outPos);
      outPos += litLen;
    }

    if (onProgress && i - lastProgressAt >= progressStep) {
      lastProgressAt = i;
      onProgress(i / n);
    }
  }

  onProgress?.(1);
  return out.subarray(0, outPos);
}

export function decompressRLE(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  if (data.length < 4) {
    throw new Error('Stream RLE non valido: header mancante.');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const origLen = view.getUint32(0, true);
  const out = new Uint8Array(origLen);

  let inPos = 4;
  let outPos = 0;
  let lastProgressAt = 0;
  const progressStep = Math.max(65536, Math.floor(origLen / 40));

  while (outPos < origLen && inPos < data.length) {
    const header = data[inPos++];
    if (header < 128) {
      const litLen = header + 1;
      out.set(data.subarray(inPos, inPos + litLen), outPos);
      inPos += litLen;
      outPos += litLen;
    } else {
      const runLen = header - 128 + MIN_RUN;
      const val = data[inPos++];
      out.fill(val, outPos, outPos + runLen);
      outPos += runLen;
    }

    if (onProgress && outPos - lastProgressAt >= progressStep) {
      lastProgressAt = outPos;
      onProgress(origLen > 0 ? outPos / origLen : 1);
    }
  }

  if (outPos !== origLen) {
    throw new Error(`Errore decompressione RLE: attesi ${origLen} byte, ottenuti ${outPos}.`);
  }

  onProgress?.(1);
  return out;
}
