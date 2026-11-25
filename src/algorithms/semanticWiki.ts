/**
 * Semantic Wiki-XML + Dynamic Word Dictionary + Canonical Huffman.
 *
 * Algoritmo ispirato ai preprocessori semantici dell'Hutter Prize (es. starlit / paq8hp):
 * invece di trattare il testo come un flusso cieco di byte, sfrutta la conoscenza
 * strutturale di MediaWiki XML e il vocabolario lessicale del documento.
 *
 * Pipeline a 3 stadi (100% lossless su qualunque file binario o testuale, a blocchi da 512 KB):
 * 1. Semantic Schema Transform: sostituisce tag XML MediaWiki, sintassi Wikitext e
 *    costrutti semantici ricorrenti con token compatti da 2 byte (escape 0xFE).
 * 2. Dynamic Word-Level Dictionary: estrae dinamicamente per ogni blocco fino a 254 parole
 *    o identificatori più redditizi (massimizzando il risparmio netto in byte) e li codifica
 *    con riferimenti lessicali da 2 byte (escape 0xFF).
 * 3. Canonical Huffman Coding: codifica entropica a 15 bit del flusso di token semantici
 *    con decodifica O(1) tramite lookup table.
 */

const BLOCK_SIZE = 512 * 1024; // 512 KB
const TAG_ESC = 0xfe;
const DICT_ESC = 0xff;
const MAX_CODE_LEN = 15;
const TABLE_SIZE = 1 << MAX_CODE_LEN;

const TEXT_ENCODER = new TextEncoder();

/**
 * Dizionario semantico statico per MediaWiki XML / enwik9 e sintassi Wikitext.
 * Ordinato per lunghezza decrescente per favorire il match più specifico (longest-match).
 */
const SEMANTIC_PHRASES: Uint8Array[] = [
  '<text xml:space="preserve">',
  '</contributor>\n',
  '  <contributor>\n',
  '    <timestamp>',
  '</timestamp>\n',
  '    <revision>\n',
  '  </revision>\n',
  '    <username>',
  '</username>\n',
  '    <comment>',
  '</comment>\n',
  '[[Category:',
  '  <page>\n',
  '  </page>\n',
  '    <title>',
  '</title>\n',
  '    <id>',
  '</id>\n',
  '</text>\n',
  'https://',
  'http://',
  'Wikipedia',
  'compression',
  'algorithm',
  'information',
  'character',
  'lossless',
  'sequence',
  'encoding',
  'original',
  'language',
  'because',
  'between',
  'example',
  'through',
  'symbols',
  'string',
  'binary',
  'stream',
  'bytes',
  'block',
  'index',
  'which',
  'their',
  'about',
  'these',
  'other',
  'would',
  'first',
  'where',
  'there',
  "'''",
  '== ',
  ' ==',
  '[[',
  ']]',
  ' the ',
  ' and ',
  ' of ',
  ' to ',
  ' in ',
  ' is ',
  ' that ',
  ' for ',
  ' with ',
  ' from ',
  ' are ',
  ' by ',
  ' as ',
  ' on ',
]
  .sort((a, b) => b.length - a.length)
  .map((s) => TEXT_ENCODER.encode(s));

// Indice rapido per primo byte per accelerare il matching delle frasi statiche
const PHRASE_BY_FIRST_BYTE: number[][] = Array.from({ length: 256 }, () => []);
for (let idx = 0; idx < SEMANTIC_PHRASES.length; idx++) {
  PHRASE_BY_FIRST_BYTE[SEMANTIC_PHRASES[idx][0]].push(idx);
}

/* ── Stadio 1: Semantic Schema Transform (escape 0xFE) ── */

function semanticSchemaEncode(block: Uint8Array): Uint8Array {
  const n = block.length;
  const out = new Uint8Array(n * 2 + 16);
  let outPos = 0;
  let i = 0;

  while (i < n) {
    const b = block[i];
    if (b === TAG_ESC) {
      out[outPos++] = TAG_ESC;
      out[outPos++] = 0x00;
      i++;
      continue;
    }

    const candidates = PHRASE_BY_FIRST_BYTE[b];
    let matchedIdx = -1;
    for (let c = 0; c < candidates.length; c++) {
      const pIdx = candidates[c];
      const phrase = SEMANTIC_PHRASES[pIdx];
      const pLen = phrase.length;
      if (i + pLen > n) continue;
      let ok = true;
      for (let k = 1; k < pLen; k++) {
        if (block[i + k] !== phrase[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matchedIdx = pIdx;
        break;
      }
    }

    if (matchedIdx !== -1) {
      out[outPos++] = TAG_ESC;
      out[outPos++] = matchedIdx + 1;
      i += SEMANTIC_PHRASES[matchedIdx].length;
    } else {
      out[outPos++] = b;
      i++;
    }
  }

  return out.subarray(0, outPos);
}

function semanticSchemaDecode(data: Uint8Array, expectedLen: number): Uint8Array {
  const out = new Uint8Array(expectedLen);
  let inPos = 0;
  let outPos = 0;

  while (inPos < data.length && outPos < expectedLen) {
    const b = data[inPos++];
    if (b !== TAG_ESC) {
      out[outPos++] = b;
    } else {
      const code = data[inPos++];
      if (code === 0x00) {
        out[outPos++] = TAG_ESC;
      } else {
        const phrase = SEMANTIC_PHRASES[code - 1];
        out.set(phrase, outPos);
        outPos += phrase.length;
      }
    }
  }

  return out;
}

/* ── Stadio 2: Dynamic Word-Level Dictionary (escape 0xFF) ── */

function isWordStart(b: number): boolean {
  return (b >= 65 && b <= 90) || (b >= 97 && b <= 122); // A-Z, a-z
}

function isWordChar(b: number): boolean {
  return (
    (b >= 65 && b <= 90) ||
    (b >= 97 && b <= 122) ||
    (b >= 48 && b <= 57) ||
    b === 95 || // _
    b === 45 // -
  );
}

function dynamicWordEncode(data: Uint8Array): Uint8Array {
  const n = data.length;
  const freqMap = new Map<string, number>();

  // 1. Estrae il vocabolario del blocco saltando le sequenze di escape 0xFE
  let i = 0;
  while (i < n) {
    const b = data[i];
    if (b === TAG_ESC) {
      i += 2;
      continue;
    }
    if (isWordStart(b)) {
      const start = i;
      i++;
      while (i < n && i - start < 24 && isWordChar(data[i])) {
        i++;
      }
      const len = i - start;
      if (len >= 4) {
        let word = '';
        for (let k = start; k < i; k++) word += String.fromCharCode(data[k]);
        freqMap.set(word, (freqMap.get(word) ?? 0) + 1);
      }
    } else {
      i++;
    }
  }

  // 2. Seleziona fino a 254 parole con il maggior risparmio netto in byte
  const scored: Array<{ word: string; savings: number }> = [];
  for (const [word, freq] of freqMap) {
    if (freq < 3) continue;
    const savings = freq * (word.length - 2) - (word.length + 1);
    if (savings > 4) {
      scored.push({ word, savings });
    }
  }
  scored.sort((a, b) => b.savings - a.savings);
  const selected = scored.slice(0, 254);

  const wordToId = new Map<string, number>();
  let dictHeaderBytes = 1; // 1 byte count
  for (let idx = 0; idx < selected.length; idx++) {
    wordToId.set(selected[idx].word, idx + 1);
    dictHeaderBytes += 1 + selected[idx].word.length;
  }

  // 3. Serializza il dizionario + codifica il flusso
  const out = new Uint8Array(dictHeaderBytes + n * 2 + 16);
  let outPos = 0;
  out[outPos++] = selected.length;
  for (let idx = 0; idx < selected.length; idx++) {
    const w = selected[idx].word;
    out[outPos++] = w.length;
    for (let k = 0; k < w.length; k++) {
      out[outPos++] = w.charCodeAt(k);
    }
  }

  i = 0;
  while (i < n) {
    const b = data[i];
    if (b === TAG_ESC) {
      out[outPos++] = TAG_ESC;
      out[outPos++] = data[i + 1];
      i += 2;
    } else if (b === DICT_ESC) {
      out[outPos++] = DICT_ESC;
      out[outPos++] = 0x00;
      i++;
    } else if (selected.length > 0 && isWordStart(b)) {
      const start = i;
      i++;
      while (i < n && i - start < 24 && isWordChar(data[i])) {
        i++;
      }
      const len = i - start;
      let id: number | undefined;
      if (len >= 4) {
        let word = '';
        for (let k = start; k < i; k++) word += String.fromCharCode(data[k]);
        id = wordToId.get(word);
      }
      if (id !== undefined) {
        out[outPos++] = DICT_ESC;
        out[outPos++] = id;
      } else {
        out.set(data.subarray(start, i), outPos);
        outPos += len;
      }
    } else {
      out[outPos++] = b;
      i++;
    }
  }

  return out.subarray(0, outPos);
}

function dynamicWordDecode(encoded: Uint8Array, expectedLen: number): Uint8Array {
  let inPos = 0;
  const dictCount = encoded[inPos++];
  const dict: Uint8Array[] = new Array(dictCount);
  for (let i = 0; i < dictCount; i++) {
    const wLen = encoded[inPos++];
    dict[i] = encoded.subarray(inPos, inPos + wLen);
    inPos += wLen;
  }

  const out = new Uint8Array(expectedLen);
  let outPos = 0;
  while (inPos < encoded.length && outPos < expectedLen) {
    const b = encoded[inPos++];
    if (b !== DICT_ESC) {
      out[outPos++] = b;
    } else {
      const code = encoded[inPos++];
      if (code === 0x00) {
        out[outPos++] = DICT_ESC;
      } else {
        const word = dict[code - 1];
        out.set(word, outPos);
        outPos += word.length;
      }
    }
  }

  return out;
}

/* ── Stadio 3: Canonical Huffman (auto-contenuto) ── */

interface HuffNode {
  freq: number;
  symbol: number;
  left: HuffNode | null;
  right: HuffNode | null;
}

function buildHuffLengths(freqs: Uint32Array): Uint8Array {
  const lengths = new Uint8Array(256);
  const heap: HuffNode[] = [];
  for (let s = 0; s < 256; s++) {
    if (freqs[s] > 0) heap.push({ freq: freqs[s], symbol: s, left: null, right: null });
  }
  if (heap.length === 0) return lengths;
  if (heap.length === 1) {
    lengths[heap[0].symbol] = 1;
    return lengths;
  }

  const siftDown = (idx: number) => {
    const len = heap.length;
    while (true) {
      let sm = idx;
      const l = idx * 2 + 1;
      const r = l + 1;
      if (l < len && heap[l].freq < heap[sm].freq) sm = l;
      if (r < len && heap[r].freq < heap[sm].freq) sm = r;
      if (sm === idx) break;
      const t = heap[idx];
      heap[idx] = heap[sm];
      heap[sm] = t;
      idx = sm;
    }
  };

  for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(i);

  const pop = () => {
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
    let idx = heap.length - 1;
    while (idx > 0) {
      const p = (idx - 1) >> 1;
      if (heap[p].freq <= heap[idx].freq) break;
      const t = heap[p];
      heap[p] = heap[idx];
      heap[idx] = t;
      idx = p;
    }
  }

  let overflow = false;
  const assign = (node: HuffNode, depth: number) => {
    if (node.symbol >= 0) {
      if (depth > MAX_CODE_LEN) {
        lengths[node.symbol] = MAX_CODE_LEN;
        overflow = true;
      } else {
        lengths[node.symbol] = depth;
      }
      return;
    }
    if (node.left) assign(node.left, depth + 1);
    if (node.right) assign(node.right, depth + 1);
  };
  assign(heap[0], 0);

  if (overflow) {
    const syms: number[] = [];
    for (let s = 0; s < 256; s++) if (lengths[s] > 0) syms.push(s);
    syms.sort((a, b) => freqs[a] - freqs[b]);
    let kraft = 0;
    for (const s of syms) kraft += 1 << (MAX_CODE_LEN - lengths[s]);
    while (kraft > TABLE_SIZE) {
      for (let i = 0; i < syms.length && kraft > TABLE_SIZE; i++) {
        const s = syms[i];
        if (lengths[s] < MAX_CODE_LEN) {
          kraft -= 1 << (MAX_CODE_LEN - lengths[s] - 1);
          lengths[s]++;
        }
      }
    }
  }

  return lengths;
}

function buildCanonical(lengths: Uint8Array): Uint32Array {
  const blCount = new Uint32Array(MAX_CODE_LEN + 1);
  for (let s = 0; s < 256; s++) if (lengths[s] > 0) blCount[lengths[s]]++;
  const nextCode = new Uint32Array(MAX_CODE_LEN + 1);
  let code = 0;
  for (let bits = 1; bits <= MAX_CODE_LEN; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }
  const codes = new Uint32Array(256);
  for (let s = 0; s < 256; s++) {
    if (lengths[s] > 0) codes[s] = nextCode[lengths[s]]++;
  }
  return codes;
}

function huffCompressBlock(data: Uint8Array): { mode: number; payload: Uint8Array } {
  const n = data.length;
  if (n === 0) return { mode: 0, payload: new Uint8Array(0) };

  const freqs = new Uint32Array(256);
  let unique = 0;
  for (let i = 0; i < n; i++) {
    if (freqs[data[i]] === 0) unique++;
    freqs[data[i]]++;
  }
  if (unique <= 1) {
    return { mode: 0, payload: data };
  }

  const lengths = buildHuffLengths(freqs);
  const codes = buildCanonical(lengths);
  let totalBits = 0;
  for (let s = 0; s < 256; s++) totalBits += freqs[s] * lengths[s];
  const bitBytes = Math.ceil(totalBits / 8);

  if (bitBytes + 256 >= n) {
    return { mode: 0, payload: data };
  }

  const payload = new Uint8Array(256 + bitBytes);
  payload.set(lengths, 0);
  let outIdx = 256;
  let bitBuf = 0;
  let bitCount = 0;
  for (let i = 0; i < n; i++) {
    const sym = data[i];
    const len = lengths[sym];
    bitBuf = (bitBuf << len) | codes[sym];
    bitCount += len;
    while (bitCount >= 8) {
      bitCount -= 8;
      payload[outIdx++] = (bitBuf >>> bitCount) & 0xff;
    }
  }
  if (bitCount > 0) {
    payload[outIdx++] = (bitBuf << (8 - bitCount)) & 0xff;
  }

  return { mode: 1, payload };
}

function huffDecompressBlock(
  payload: Uint8Array,
  mode: number,
  expectedLen: number,
  lookup: Uint16Array,
): Uint8Array {
  if (mode === 0) return payload.subarray(0, expectedLen);

  const lengths = payload.subarray(0, 256);
  const codes = buildCanonical(lengths);
  for (let s = 0; s < 256; s++) {
    const len = lengths[s];
    if (len === 0) continue;
    const shift = MAX_CODE_LEN - len;
    const base = codes[s] << shift;
    lookup.fill((s << 5) | len, base, base + (1 << shift));
  }

  const out = new Uint8Array(expectedLen);
  let inPos = 256;
  let outPos = 0;
  let bitBuf = 0;
  let bitCount = 0;

  while (outPos < expectedLen) {
    while (bitCount < MAX_CODE_LEN && inPos < payload.length) {
      bitBuf = (bitBuf << 8) | payload[inPos++];
      bitCount += 8;
    }
    const idx =
      bitCount >= MAX_CODE_LEN
        ? (bitBuf >>> (bitCount - MAX_CODE_LEN)) & (TABLE_SIZE - 1)
        : (bitBuf << (MAX_CODE_LEN - bitCount)) & (TABLE_SIZE - 1);
    const entry = lookup[idx];
    out[outPos++] = entry >>> 5;
    bitCount -= entry & 31;
  }

  return out;
}

/* ── API Pubblica del Plugin ── */

export function compressSemanticWiki(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  const n = data.length;
  const chunks: Uint8Array[] = [];

  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, n, true);
  chunks.push(header);
  let totalOutBytes = 4;

  let offset = 0;
  while (offset < n) {
    const blockLen = Math.min(BLOCK_SIZE, n - offset);
    const block = data.subarray(offset, offset + blockLen);

    // Applica la pipeline semantica a 3 stadi
    const stage1 = semanticSchemaEncode(block);
    const stage2 = dynamicWordEncode(stage1);
    const { mode: huffMode, payload } = huffCompressBlock(stage2);

    // Se la pipeline semantica non riduce la dimensione (es. file binario casuale), usa RAW
    if (payload.length + 17 >= blockLen) {
      const frame = new Uint8Array(5 + blockLen);
      new DataView(frame.buffer).setUint32(0, blockLen, true);
      frame[4] = 0; // RAW block
      frame.set(block, 5);
      chunks.push(frame);
      totalOutBytes += frame.length;
    } else {
      // Frame header: 4B blockLen + 1B frameMode + 4B stage1Len + 4B stage2Len + 4B payloadLen
      const frame = new Uint8Array(17 + payload.length);
      const view = new DataView(frame.buffer);
      view.setUint32(0, blockLen, true);
      frame[4] = huffMode === 1 ? 2 : 1; // 1 = Semantic+Raw, 2 = Semantic+Huffman
      view.setUint32(5, stage1.length, true);
      view.setUint32(9, stage2.length, true);
      view.setUint32(13, payload.length, true);
      frame.set(payload, 17);
      chunks.push(frame);
      totalOutBytes += frame.length;
    }

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

export function decompressSemanticWiki(
  data: Uint8Array,
  onProgress?: (progress: number) => void,
): Uint8Array {
  if (data.length < 4) {
    throw new Error('Stream Semantic Wiki non valido: header mancante.');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const origLen = view.getUint32(0, true);
  const out = new Uint8Array(origLen);
  const lookup = new Uint16Array(TABLE_SIZE);

  let inPos = 4;
  let outPos = 0;

  while (outPos < origLen && inPos < data.length) {
    const blockLen = view.getUint32(inPos, true);
    const frameMode = data[inPos + 4];
    inPos += 5;

    if (frameMode === 0) {
      out.set(data.subarray(inPos, inPos + blockLen), outPos);
      inPos += blockLen;
      outPos += blockLen;
    } else if (frameMode === 1 || frameMode === 2) {
      const stage1Len = view.getUint32(inPos, true);
      const stage2Len = view.getUint32(inPos + 4, true);
      const payloadLen = view.getUint32(inPos + 8, true);
      inPos += 12;

      const payload = data.subarray(inPos, inPos + payloadLen);
      inPos += payloadLen;

      const stage2 = huffDecompressBlock(payload, frameMode === 2 ? 1 : 0, stage2Len, lookup);
      const stage1 = dynamicWordDecode(stage2, stage1Len);
      const restored = semanticSchemaDecode(stage1, blockLen);

      out.set(restored, outPos);
      outPos += blockLen;
    } else {
      throw new Error(`Modalità blocco Semantic Wiki sconosciuta: ${frameMode}`);
    }

    onProgress?.(origLen > 0 ? outPos / origLen : 1);
  }

  if (outPos !== origLen) {
    throw new Error(
      `Errore decompressione Semantic Wiki: attesi ${origLen} byte, ottenuti ${outPos}.`,
    );
  }

  onProgress?.(1);
  return out;
}
