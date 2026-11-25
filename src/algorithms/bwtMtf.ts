/**
 * BWT + MTF + Zero-RLE (pipeline ispirata a bzip2, elaborata a blocchi).
 *
 * Stadi della pipeline per ogni blocco da 64 KB:
 * 1. BWT (Burrows-Wheeler Transform): ordina ciclicamente le rotazioni del blocco
 *    tramite Suffix Array con prefix-doubling O(N log N) e counting sort.
 *    Raggruppa caratteri con contesti simili in lunghe sequenze contigue.
 * 2. MTF (Move-To-Front): trasforma la località creata dalla BWT in un flusso
 *    dominato da zeri (0x00) e indici molto piccoli.
 * 3. Zero-RLE (codifica biettiva in base 2 RUNA/RUNB): comprime le sequenze di zeri
 *    in spazio logaritmico (1 zero -> 1 byte, 2 zeri -> 1 byte, 100 zeri -> 6 byte).
 *
 * Lavorando a blocchi da 64 KB, la memoria di lavoro resta costante (~1 MB) anche su file da 1 GB.
 */

const BLOCK_SIZE = 64 * 1024; // 64 KB

const RUNA = 0x00;
const RUNB = 0x01;
const ESCAPE = 0xff;

interface BwtWorkspace {
  sa: Int32Array;
  rank: Int32Array;
  tmp: Int32Array;
  cnt: Int32Array;
}

function createWorkspace(maxBlockSize: number): BwtWorkspace {
  const cntSize = Math.max(256, maxBlockSize);
  return {
    sa: new Int32Array(maxBlockSize),
    rank: new Int32Array(maxBlockSize),
    tmp: new Int32Array(maxBlockSize),
    cnt: new Int32Array(cntSize),
  };
}

/**
 * BWT diretta tramite ordinamento ciclico O(N log N) con prefix-doubling.
 */
function bwtForward(
  block: Uint8Array,
  ws: BwtWorkspace,
): { lastCol: Uint8Array; primaryIndex: number } {
  const n = block.length;
  const { sa, rank, tmp, cnt } = ws;

  // Passo 0: counting sort sui singoli byte
  cnt.fill(0, 0, 256);
  for (let i = 0; i < n; i++) cnt[block[i]]++;
  for (let i = 1; i < 256; i++) cnt[i] += cnt[i - 1];
  for (let i = n - 1; i >= 0; i--) {
    sa[--cnt[block[i]]] = i;
  }

  let classes = 1;
  rank[sa[0]] = 0;
  for (let i = 1; i < n; i++) {
    if (block[sa[i]] !== block[sa[i - 1]]) classes++;
    rank[sa[i]] = classes - 1;
  }

  // Prefix-doubling: raddoppia la lunghezza ordinata k = 1, 2, 4, ...
  for (let k = 1; k < n && classes < n; k <<= 1) {
    // Ordina per la seconda metà (spostamento ciclico -k)
    for (let i = 0; i < n; i++) {
      let p = sa[i] - k;
      if (p < 0) p += n;
      tmp[i] = p;
    }

    // Counting sort stabile sulla prima metà usando i rank correnti
    cnt.fill(0, 0, classes);
    for (let i = 0; i < n; i++) cnt[rank[tmp[i]]]++;
    for (let i = 1; i < classes; i++) cnt[i] += cnt[i - 1];
    for (let i = n - 1; i >= 0; i--) {
      const p = tmp[i];
      sa[--cnt[rank[p]]] = p;
    }

    // Ricalcola le classi di equivalenza in `tmp` (riutilizzato come nextRank)
    tmp[sa[0]] = 0;
    let nextClasses = 1;
    for (let i = 1; i < n; i++) {
      const cur = sa[i];
      const prev = sa[i - 1];
      const curMid = cur + k < n ? cur + k : cur + k - n;
      const prevMid = prev + k < n ? prev + k : prev + k - n;
      if (rank[cur] !== rank[prev] || rank[curMid] !== rank[prevMid]) {
        nextClasses++;
      }
      tmp[cur] = nextClasses - 1;
    }

    for (let i = 0; i < n; i++) {
      rank[i] = tmp[i];
    }
    classes = nextClasses;
  }

  // Costruisce l'ultima colonna L e individua il primaryIndex (dove sa[i] === 0)
  const lastCol = new Uint8Array(n);
  let primaryIndex = 0;
  for (let i = 0; i < n; i++) {
    const pos = sa[i];
    if (pos === 0) {
      primaryIndex = i;
      lastCol[i] = block[n - 1];
    } else {
      lastCol[i] = block[pos - 1];
    }
  }

  return { lastCol, primaryIndex };
}

/**
 * BWT inversa in tempo lineare O(N) tramite LF-mapping.
 */
function bwtInverse(lastCol: Uint8Array, primaryIndex: number): Uint8Array {
  const n = lastCol.length;
  const out = new Uint8Array(n);
  if (n === 0) return out;

  const counts = new Uint32Array(256);
  for (let i = 0; i < n; i++) counts[lastCol[i]]++;

  // Calcola offset cumulativi della prima colonna ordinata F
  const starts = new Uint32Array(256);
  let sum = 0;
  for (let b = 0; b < 256; b++) {
    starts[b] = sum;
    sum += counts[b];
  }

  // Costruisce il vettore di trasformazione LF
  const lf = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const sym = lastCol[i];
    lf[i] = starts[sym]++;
  }

  // Ricostruisce il blocco originale procedendo all'indietro
  let idx = primaryIndex;
  for (let i = n - 1; i >= 0; i--) {
    out[i] = lastCol[idx];
    idx = lf[idx];
  }

  return out;
}

/**
 * Move-To-Front (MTF) diretta.
 */
function mtfEncode(data: Uint8Array): Uint8Array {
  const n = data.length;
  const out = new Uint8Array(n);
  const alphabet = new Uint8Array(256);
  for (let i = 0; i < 256; i++) alphabet[i] = i;

  for (let i = 0; i < n; i++) {
    const sym = data[i];
    let idx = 0;
    while (alphabet[idx] !== sym) idx++;
    out[i] = idx;
    if (idx > 0) {
      for (let j = idx; j > 0; j--) {
        alphabet[j] = alphabet[j - 1];
      }
      alphabet[0] = sym;
    }
  }
  return out;
}

/**
 * Move-To-Front (MTF) inversa.
 */
function mtfDecode(data: Uint8Array): Uint8Array {
  const n = data.length;
  const out = new Uint8Array(n);
  const alphabet = new Uint8Array(256);
  for (let i = 0; i < 256; i++) alphabet[i] = i;

  for (let i = 0; i < n; i++) {
    const idx = data[i];
    const sym = alphabet[idx];
    out[i] = sym;
    if (idx > 0) {
      for (let j = idx; j > 0; j--) {
        alphabet[j] = alphabet[j - 1];
      }
      alphabet[0] = sym;
    }
  }
  return out;
}

/**
 * Zero-RLE biettiva in base 2 (RUNA=0x00, RUNB=0x01).
 * - Sequenze di zeri codificate con RUNA/RUNB (spazio logaritmico).
 * - Valori 1..253 mappati su 2..254.
 * - Valori 254..255 preceduti da ESCAPE (0xff) + (0 o 1).
 */
function zeroRleEncode(mtf: Uint8Array): Uint8Array {
  const n = mtf.length;
  const out = new Uint8Array(n * 2 + 16);
  let outPos = 0;
  let i = 0;

  while (i < n) {
    if (mtf[i] === 0) {
      let run = 0;
      while (i < n && mtf[i] === 0) {
        run++;
        i++;
      }
      // Codifica biettiva base-2 della lunghezza della run di zeri
      while (run > 0) {
        if ((run & 1) === 1) {
          out[outPos++] = RUNA;
          run = (run - 1) >>> 1;
        } else {
          out[outPos++] = RUNB;
          run = (run - 2) >>> 1;
        }
      }
    } else {
      const v = mtf[i++];
      if (v <= 253) {
        out[outPos++] = v + 1;
      } else {
        out[outPos++] = ESCAPE;
        out[outPos++] = v - 254;
      }
    }
  }

  return out.subarray(0, outPos);
}

function zeroRleDecode(encoded: Uint8Array, expectedLen: number): Uint8Array {
  const out = new Uint8Array(expectedLen);
  let inPos = 0;
  let outPos = 0;

  while (inPos < encoded.length && outPos < expectedLen) {
    const b = encoded[inPos];
    if (b === RUNA || b === RUNB) {
      let run = 0;
      let power = 1;
      while (inPos < encoded.length && (encoded[inPos] === RUNA || encoded[inPos] === RUNB)) {
        run += (encoded[inPos] === RUNA ? 1 : 2) * power;
        power <<= 1;
        inPos++;
      }
      out.fill(0, outPos, outPos + run);
      outPos += run;
    } else if (b === ESCAPE) {
      inPos++;
      out[outPos++] = 254 + encoded[inPos++];
    } else {
      out[outPos++] = b - 1;
      inPos++;
    }
  }

  return out;
}

export function compressBwtMtf(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  const n = data.length;
  const chunks: Uint8Array[] = [];

  const globalHeader = new Uint8Array(4);
  new DataView(globalHeader.buffer).setUint32(0, n, true);
  chunks.push(globalHeader);
  let totalOutBytes = 4;

  const ws = createWorkspace(Math.min(BLOCK_SIZE, Math.max(1, n)));
  let offset = 0;

  while (offset < n) {
    const blockLen = Math.min(BLOCK_SIZE, n - offset);
    const block = data.subarray(offset, offset + blockLen);

    const { lastCol, primaryIndex } = bwtForward(block, ws);
    const mtf = mtfEncode(lastCol);
    const payload = zeroRleEncode(mtf);

    // Header blocco: 4 byte blockLen + 4 byte primaryIndex + 4 byte payloadLen
    const frame = new Uint8Array(12 + payload.length);
    const view = new DataView(frame.buffer);
    view.setUint32(0, blockLen, true);
    view.setUint32(4, primaryIndex, true);
    view.setUint32(8, payload.length, true);
    frame.set(payload, 12);

    chunks.push(frame);
    totalOutBytes += frame.length;
    offset += blockLen;
    onProgress?.(n > 0 ? offset / n : 1);
  }

  const result = new Uint8Array(totalOutBytes);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  onProgress?.(1);
  return result;
}

export function decompressBwtMtf(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  if (data.length < 4) {
    throw new Error('Stream BWT+MTF non valido: header mancante.');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const origLen = view.getUint32(0, true);
  const out = new Uint8Array(origLen);

  let inPos = 4;
  let outPos = 0;

  while (outPos < origLen && inPos < data.length) {
    const blockLen = view.getUint32(inPos, true);
    const primaryIndex = view.getUint32(inPos + 4, true);
    const payloadLen = view.getUint32(inPos + 8, true);
    inPos += 12;

    const payload = data.subarray(inPos, inPos + payloadLen);
    inPos += payloadLen;

    const mtf = zeroRleDecode(payload, blockLen);
    const lastCol = mtfDecode(mtf);
    const restored = bwtInverse(lastCol, primaryIndex);

    out.set(restored, outPos);
    outPos += blockLen;
    onProgress?.(origLen > 0 ? outPos / origLen : 1);
  }

  if (outPos !== origLen) {
    throw new Error(`Errore decompressione BWT+MTF: attesi ${origLen} byte, ottenuti ${outPos}.`);
  }

  onProgress?.(1);
  return out;
}
