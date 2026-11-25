/**
 * Canonical Huffman Coding a blocchi (block-framed, lunghezza codice limitata a 15 bit).
 *
 * Architettura:
 * - Elabora l'input in blocchi indipendenti da 512 KB per adattarsi alla distribuzione
 *   locale dei simboli e contenere l'utilizzo di memoria.
 * - Genera codici di Huffman canonici con profondità massima 15 bit (limitazione Kraft-safe).
 * - Decodifica O(1) per simbolo grazie a una lookup table diretta da 32768 entry (2^15).
 *
 * Formato binario:
 * - Header globale: 4 byte (uint32 LE) lunghezza totale originale.
 * - Per ogni blocco:
 *   - 4 byte (uint32 LE) lunghezza non compressa del blocco.
 *   - 1 byte modalità:
 *     - 0 = RAW (blocco non comprimibile, seguito dai byte grezzi)
 *     - 1 = SINGLE_SYMBOL (1 solo simbolo unico, seguito dal byte del simbolo)
 *     - 2 = HUFFMAN (256 byte con le lunghezze dei codici + 4 byte payloadLen + bitstream)
 */

const BLOCK_SIZE = 512 * 1024; // 512 KB
const MAX_CODE_LEN = 15;
const TABLE_SIZE = 1 << MAX_CODE_LEN; // 32768

interface HeapNode {
  freq: number;
  symbol: number; // >= 0 per foglie, -1 per nodi interni
  left: HeapNode | null;
  right: HeapNode | null;
}

function buildCodeLengths(freqs: Uint32Array): Uint8Array {
  const lengths = new Uint8Array(256);
  const heap: HeapNode[] = [];

  for (let s = 0; s < 256; s++) {
    if (freqs[s] > 0) {
      heap.push({ freq: freqs[s], symbol: s, left: null, right: null });
    }
  }

  if (heap.length === 0) return lengths;
  if (heap.length === 1) {
    lengths[heap[0].symbol] = 1;
    return lengths;
  }

  // Min-heap binario
  const siftUp = (idx: number) => {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heap[parent].freq <= heap[idx].freq) break;
      const tmp = heap[parent];
      heap[parent] = heap[idx];
      heap[idx] = tmp;
      idx = parent;
    }
  };

  const siftDown = (idx: number) => {
    const len = heap.length;
    while (true) {
      let smallest = idx;
      const left = idx * 2 + 1;
      const right = left + 1;
      if (left < len && heap[left].freq < heap[smallest].freq) smallest = left;
      if (right < len && heap[right].freq < heap[smallest].freq) smallest = right;
      if (smallest === idx) break;
      const tmp = heap[idx];
      heap[idx] = heap[smallest];
      heap[smallest] = tmp;
      idx = smallest;
    }
  };

  for (let i = (heap.length >> 1) - 1; i >= 0; i--) {
    siftDown(i);
  }

  const pop = (): HeapNode => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      siftDown(0);
    }
    return top;
  };

  while (heap.length > 1) {
    const a = pop();
    const b = pop();
    heap.push({ freq: a.freq + b.freq, symbol: -1, left: a, right: b });
    siftUp(heap.length - 1);
  }

  // Calcola le profondità dell'albero
  let overflow = false;
  const assignDepth = (node: HeapNode, depth: number) => {
    if (node.symbol >= 0) {
      if (depth > MAX_CODE_LEN) {
        lengths[node.symbol] = MAX_CODE_LEN;
        overflow = true;
      } else {
        lengths[node.symbol] = depth;
      }
      return;
    }
    if (node.left) assignDepth(node.left, depth + 1);
    if (node.right) assignDepth(node.right, depth + 1);
  };
  assignDepth(heap[0], 0);

  // Se la profondità ha superato MAX_CODE_LEN, ribilancia preservando la disuguaglianza di Kraft
  if (overflow) {
    const symbols: number[] = [];
    for (let s = 0; s < 256; s++) {
      if (lengths[s] > 0) symbols.push(s);
    }
    symbols.sort((a, b) => freqs[a] - freqs[b]);

    let kraft = 0;
    for (const s of symbols) {
      kraft += 1 << (MAX_CODE_LEN - lengths[s]);
    }

    // Riduci kraft aumentando la lunghezza dei simboli meno frequenti con lunghezza < MAX_CODE_LEN
    while (kraft > TABLE_SIZE) {
      for (let i = 0; i < symbols.length && kraft > TABLE_SIZE; i++) {
        const s = symbols[i];
        if (lengths[s] < MAX_CODE_LEN) {
          kraft -= 1 << (MAX_CODE_LEN - lengths[s] - 1);
          lengths[s]++;
        }
      }
    }
  }

  return lengths;
}

function buildCanonicalCodes(lengths: Uint8Array): Uint32Array {
  const blCount = new Uint32Array(MAX_CODE_LEN + 1);
  for (let s = 0; s < 256; s++) {
    if (lengths[s] > 0) blCount[lengths[s]]++;
  }

  const nextCode = new Uint32Array(MAX_CODE_LEN + 1);
  let code = 0;
  for (let bits = 1; bits <= MAX_CODE_LEN; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  const codes = new Uint32Array(256);
  for (let s = 0; s < 256; s++) {
    const len = lengths[s];
    if (len > 0) {
      codes[s] = nextCode[len]++;
    }
  }
  return codes;
}

export function compressHuffman(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  const n = data.length;
  const chunks: Uint8Array[] = [];

  // Header globale: 4 byte
  const globalHeader = new Uint8Array(4);
  new DataView(globalHeader.buffer).setUint32(0, n, true);
  chunks.push(globalHeader);

  let totalOutBytes = 4;
  let offset = 0;

  while (offset < n) {
    const blockLen = Math.min(BLOCK_SIZE, n - offset);
    const block = data.subarray(offset, offset + blockLen);

    // 1. Istogramma frequenze
    const freqs = new Uint32Array(256);
    let uniqueCount = 0;
    let lastSymbol = 0;
    for (let i = 0; i < blockLen; i++) {
      const b = block[i];
      if (freqs[b] === 0) {
        uniqueCount++;
        lastSymbol = b;
      }
      freqs[b]++;
    }

    if (uniqueCount === 1) {
      // Caso speciale: blocco composto da un solo simbolo ripetuto
      const frame = new Uint8Array(6);
      new DataView(frame.buffer).setUint32(0, blockLen, true);
      frame[4] = 1; // SINGLE_SYMBOL
      frame[5] = lastSymbol;
      chunks.push(frame);
      totalOutBytes += frame.length;
    } else {
      const lengths = buildCodeLengths(freqs);
      const codes = buildCanonicalCodes(lengths);

      // Calcola la lunghezza esatta in bit del payload compresso
      let totalBits = 0;
      for (let s = 0; s < 256; s++) {
        if (freqs[s] > 0) {
          totalBits += freqs[s] * lengths[s];
        }
      }
      const payloadBytes = Math.ceil(totalBits / 8);

      // Se Huffman + tabella (256 byte) non riduce la dimensione, usa modalità RAW
      if (payloadBytes + 260 >= blockLen) {
        const frame = new Uint8Array(5 + blockLen);
        new DataView(frame.buffer).setUint32(0, blockLen, true);
        frame[4] = 0; // RAW
        frame.set(block, 5);
        chunks.push(frame);
        totalOutBytes += frame.length;
      } else {
        const frame = new Uint8Array(5 + 256 + 4 + payloadBytes);
        const view = new DataView(frame.buffer);
        view.setUint32(0, blockLen, true);
        frame[4] = 2; // HUFFMAN
        frame.set(lengths, 5);
        view.setUint32(261, payloadBytes, true);

        // Scrittura bitstream MSB-first
        let outIdx = 265;
        let bitBuf = 0;
        let bitCount = 0;

        for (let i = 0; i < blockLen; i++) {
          const sym = block[i];
          const len = lengths[sym];
          bitBuf = (bitBuf << len) | codes[sym];
          bitCount += len;

          while (bitCount >= 8) {
            bitCount -= 8;
            frame[outIdx++] = (bitBuf >>> bitCount) & 0xff;
          }
        }
        if (bitCount > 0) {
          frame[outIdx++] = (bitBuf << (8 - bitCount)) & 0xff;
        }

        chunks.push(frame);
        totalOutBytes += frame.length;
      }
    }

    offset += blockLen;
    onProgress?.(n > 0 ? offset / n : 1);
  }

  // Concatena i blocchi in un singolo Uint8Array
  const result = new Uint8Array(totalOutBytes);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  onProgress?.(1);
  return result;
}

export function decompressHuffman(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  if (data.length < 4) {
    throw new Error('Stream Huffman non valido: header mancante.');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const origLen = view.getUint32(0, true);
  const out = new Uint8Array(origLen);

  // Lookup table riusata tra i blocchi: entry = (symbol << 5) | codeLen
  const lookup = new Uint16Array(TABLE_SIZE);

  let inPos = 4;
  let outPos = 0;

  while (outPos < origLen && inPos < data.length) {
    const blockLen = view.getUint32(inPos, true);
    const mode = data[inPos + 4];
    inPos += 5;

    if (mode === 0) {
      // RAW
      out.set(data.subarray(inPos, inPos + blockLen), outPos);
      inPos += blockLen;
      outPos += blockLen;
    } else if (mode === 1) {
      // SINGLE_SYMBOL
      const sym = data[inPos++];
      out.fill(sym, outPos, outPos + blockLen);
      outPos += blockLen;
    } else if (mode === 2) {
      // HUFFMAN
      const lengths = data.subarray(inPos, inPos + 256);
      inPos += 256;
      const payloadBytes = view.getUint32(inPos, true);
      inPos += 4;

      const codes = buildCanonicalCodes(lengths);

      // Popola la lookup table da 32768 entry per decodifica O(1)
      for (let s = 0; s < 256; s++) {
        const len = lengths[s];
        if (len === 0) continue;
        const shift = MAX_CODE_LEN - len;
        const base = codes[s] << shift;
        const count = 1 << shift;
        const entry = (s << 5) | len;
        lookup.fill(entry, base, base + count);
      }

      const payloadEnd = inPos + payloadBytes;
      let bitBuf = 0;
      let bitCount = 0;
      const blockEnd = outPos + blockLen;

      while (outPos < blockEnd) {
        while (bitCount < MAX_CODE_LEN && inPos < payloadEnd) {
          bitBuf = (bitBuf << 8) | data[inPos++];
          bitCount += 8;
        }

        // Allinea i bit più significativi a MAX_CODE_LEN bit
        const idx =
          bitCount >= MAX_CODE_LEN
            ? (bitBuf >>> (bitCount - MAX_CODE_LEN)) & (TABLE_SIZE - 1)
            : (bitBuf << (MAX_CODE_LEN - bitCount)) & (TABLE_SIZE - 1);

        const entry = lookup[idx];
        const sym = entry >>> 5;
        const len = entry & 31;

        out[outPos++] = sym;
        bitCount -= len;
      }

      inPos = payloadEnd;
    } else {
      throw new Error(`Modalità blocco Huffman sconosciuta: ${mode}`);
    }

    onProgress?.(origLen > 0 ? outPos / origLen : 1);
  }

  if (outPos !== origLen) {
    throw new Error(`Errore decompressione Huffman: attesi ${origLen} byte, ottenuti ${outPos}.`);
  }

  onProgress?.(1);
  return out;
}
