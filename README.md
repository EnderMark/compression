# enwik9 Bench — Lossless Compression Workbench

Applicazione web **100% client-side** (React + TypeScript + Tailwind CSS + Web Workers) per eseguire benchmark di algoritmi di compressione lossless sul dataset **`enwik9`** (1 GB, Hutter Prize) o su qualsiasi file caricato localmente nel browser, senza alcun backend.

## Funzionalità Principali

- **Gestione Input & Validazione (`enwik9`)**: Drag-and-drop locale tramite `File.slice()`, calcolo streaming di **SHA-256** e **CRC32** a chunk da 4 MB (sicuro anche su file da 1 GB), selettore **Slice** (`1 MB`, `10 MB`, `100 MB`, `File intero`) e generatore integrato di estratto MediaWiki XML da 1 MB.
- **Architettura a Plugin (`CompressionAlgorithm`)**: Interfaccia uniforme con 5 algoritmi pronti all'uso:
  1. **RLE (PackBits)** — `src/algorithms/rle.ts`
  2. **Canonical Huffman** (blocchi da 512 KB, lookup table O(1) a 15 bit) — `src/algorithms/huffman.ts`
  3. **LZ77 / LZSS** (finestra 32 KB con hash chain a 3 byte) — `src/algorithms/lzss.ts`
  4. **BWT + MTF + Zero-RLE** (blocchi da 64 KB, suffix sort O(N log N), RUNA/RUNB) — `src/algorithms/bwtMtf.ts`
  5. **Deflate / Gzip (Native)** (`CompressionStream` / `DecompressionStream` a chunk da 1 MB) — `src/algorithms/deflate.ts`
- **Code Inspector**: Pannello laterale con syntax highlighting TypeScript e numeri di riga che mostra il codice sorgente esatto di ogni algoritmo (importato con `?raw`).
- **Web Workers + Abort + Verifica Lossless**: Esecuzione sequenziale off-main-thread, terminazione immediata tramite `worker.terminate()`, e verifica obbligatoria byte-per-byte (`decompressed === original`).
- **Dashboard & Export**: Tabella ordinabile, grafici comparativi real-time (Dimensione/Ratio, Throughput MB/s, Tempi ms), telemetria RAM (`performance.memory` con fallback), ed export in **JSON** e **CSV**.

## Avvio Rapido

```bash
npm install
npm run dev
```

## Test Unitari (Verifica Lossless)

```bash
npm test
```

## Aggiungere un Nuovo Algoritmo

1. Crea un file in `src/algorithms/mioAlgoritmo.ts` esportando `compress(data: Uint8Array)` e `decompress(data: Uint8Array)`.
2. Registralo nell'array `COMPRESSION_ALGORITHMS` in `src/algorithms/index.ts` importando il sorgente con `?raw`.
