/**
 * LZ77 / LZSS — Sliding-Window Dictionary Compression con Hash Chain.
 *
 * Parametri:
 * - Finestra scorrevole: 32 KB (32768 byte, distanza 1..32768)
 * - Match minimo: 3 byte, Match massimo: 258 byte
 * - Hash table a 3 byte (65536 bucket) con catena limitata per garantire tempo O(N).
 *
 * Formato binario:
 * - Header: 4 byte (uint32 LE) con lunghezza originale.
 * - Gruppi da 8 token preceduti da 1 byte di flag:
 *   - bit = 0 -> 1 byte letterale
 *   - bit = 1 -> 3 byte match: uint16 LE (distance - 1) + uint8 (length - 3)
 */

const WINDOW_SIZE = 32768;
const WINDOW_MASK = WINDOW_SIZE - 1;
const HASH_BITS = 16;
const HASH_SIZE = 1 << HASH_BITS;
const HASH_MASK = HASH_SIZE - 1;
const MIN_MATCH = 3;
const MAX_MATCH = 258;
const MAX_CHAIN_LENGTH = 24;

function hash3(data: Uint8Array, pos: number): number {
  return (((data[pos] << 8) ^ (data[pos + 1] << 4) ^ data[pos + 2]) * 2654435761) >>> (32 - HASH_BITS) & HASH_MASK;
}

export function compressLZSS(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  const n = data.length;
  // Buffer di output dinamico: allochiamo una capacità iniziale conservativa
  let capacity = Math.max(64, n + Math.ceil(n / 8) + 32);
  let out = new Uint8Array(capacity);
  new DataView(out.buffer).setUint32(0, n, true);
  let outPos = 4;

  const ensureCapacity = (needed: number) => {
    if (outPos + needed <= capacity) return;
    while (capacity < outPos + needed) {
      capacity = Math.floor(capacity * 1.5) + 1024;
    }
    const next = new Uint8Array(capacity);
    next.set(out.subarray(0, outPos));
    out = next;
  };

  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(WINDOW_SIZE).fill(-1);

  const insertHash = (pos: number) => {
    if (pos + 2 >= n) return;
    const h = hash3(data, pos);
    prev[pos & WINDOW_MASK] = head[h];
    head[h] = pos;
  };

  let i = 0;
  let lastProgressAt = 0;
  const progressStep = Math.max(65536, Math.floor(n / 40));

  while (i < n) {
    ensureCapacity(1 + 8 * 3);
    const flagPos = outPos++;
    let flags = 0;

    for (let bit = 0; bit < 8 && i < n; bit++) {
      let bestLen = 0;
      let bestDist = 0;

      if (i + MIN_MATCH <= n) {
        const h = hash3(data, i);
        let candidate = head[h];
        const minPos = Math.max(0, i - WINDOW_SIZE);
        const maxLen = Math.min(MAX_MATCH, n - i);
        let chain = 0;

        while (candidate >= minPos && chain < MAX_CHAIN_LENGTH) {
          // Controllo rapido sul byte finale del miglior match attuale
          if (
            bestLen === 0 ||
            data[candidate + bestLen] === data[i + bestLen]
          ) {
            let len = 0;
            while (len < maxLen && data[candidate + len] === data[i + len]) {
              len++;
            }
            if (len >= MIN_MATCH && len > bestLen) {
              bestLen = len;
              bestDist = i - candidate;
              if (bestLen === maxLen) break;
            }
          }
          const nextCandidate = prev[candidate & WINDOW_MASK];
          if (nextCandidate >= candidate) break;
          candidate = nextCandidate;
          chain++;
        }
      }

      if (bestLen >= MIN_MATCH) {
        // Emetti token match (3 byte)
        flags |= 1 << bit;
        const distMinus1 = bestDist - 1;
        out[outPos++] = distMinus1 & 0xff;
        out[outPos++] = (distMinus1 >>> 8) & 0xff;
        out[outPos++] = bestLen - MIN_MATCH;

        // Inserisci nella hash chain le posizioni coperte dal match
        const limit = Math.min(i + bestLen, n - 2);
        for (let p = i; p < limit; p++) {
          insertHash(p);
        }
        i += bestLen;
      } else {
        // Emetti byte letterale (1 byte)
        insertHash(i);
        out[outPos++] = data[i++];
      }
    }

    out[flagPos] = flags;

    if (onProgress && i - lastProgressAt >= progressStep) {
      lastProgressAt = i;
      onProgress(i / n);
    }
  }

  onProgress?.(1);
  return out.subarray(0, outPos);
}

export function decompressLZSS(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  if (data.length < 4) {
    throw new Error('Stream LZSS non valido: header mancante.');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const origLen = view.getUint32(0, true);
  const out = new Uint8Array(origLen);

  let inPos = 4;
  let outPos = 0;
  let lastProgressAt = 0;
  const progressStep = Math.max(65536, Math.floor(origLen / 40));

  while (outPos < origLen && inPos < data.length) {
    const flags = data[inPos++];

    for (let bit = 0; bit < 8 && outPos < origLen; bit++) {
      if ((flags & (1 << bit)) === 0) {
        out[outPos++] = data[inPos++];
      } else {
        const dist = (data[inPos] | (data[inPos + 1] << 8)) + 1;
        const len = data[inPos + 2] + MIN_MATCH;
        inPos += 3;

        let src = outPos - dist;
        if (src < 0) {
          throw new Error(`Offset LZSS non valido: dist=${dist} a pos=${outPos}`);
        }
        // Copia byte-per-byte per supportare correttamente i match sovrapposti (RLE-like)
        for (let k = 0; k < len; k++) {
          out[outPos++] = out[src++];
        }
      }
    }

    if (onProgress && outPos - lastProgressAt >= progressStep) {
      lastProgressAt = outPos;
      onProgress(origLen > 0 ? outPos / origLen : 1);
    }
  }

  if (outPos !== origLen) {
    throw new Error(`Errore decompressione LZSS: attesi ${origLen} byte, ottenuti ${outPos}.`);
  }

  onProgress?.(1);
  return out;
}
