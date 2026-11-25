import type { CompressionAlgorithm } from '../types/benchmark';

import { compressRLE, decompressRLE } from './rle';
import rleSource from './rle.ts?raw';

import { compressLZSS, decompressLZSS } from './lzss';
import lzssSource from './lzss.ts?raw';

import { compressHuffman, decompressHuffman } from './huffman';
import huffmanSource from './huffman.ts?raw';

import { compressGzip, decompressGzip } from './deflate';
import deflateSource from './deflate.ts?raw';

import { compressBwtMtf, decompressBwtMtf } from './bwtMtf';
import bwtMtfSource from './bwtMtf.ts?raw';

/**
 * Registro centralizzato degli algoritmi di compressione (architettura a plugin).
 * Aggiungere un nuovo algoritmo qui lo rende automaticamente disponibile nella UI,
 * nel Web Worker di esecuzione e nel Code Inspector.
 */
export const COMPRESSION_ALGORITHMS: CompressionAlgorithm[] = [
  {
    id: 'rle',
    name: 'RLE (PackBits)',
    shortName: 'RLE',
    category: 'Run-Length',
    description:
      'Codifica a lunghezza di sequenza byte-oriented. Comprime run di >= 3 byte identici con overhead massimo < 0.8% su dati casuali.',
    complexity: 'O(N) — Ultra-rapido',
    sourceFile: 'src/algorithms/rle.ts',
    sourceCode: rleSource,
    compress: compressRLE,
    decompress: decompressRLE,
  },
  {
    id: 'huffman',
    name: 'Canonical Huffman',
    shortName: 'Huffman',
    category: 'Entropy',
    description:
      'Codifica entropica canonica a blocchi da 512 KB con codici limitati a 15 bit e decodifica O(1) tramite lookup table.',
    complexity: 'O(N) — Bilanciato',
    sourceFile: 'src/algorithms/huffman.ts',
    sourceCode: huffmanSource,
    compress: compressHuffman,
    decompress: decompressHuffman,
  },
  {
    id: 'lzss',
    name: 'LZ77 / LZSS',
    shortName: 'LZSS',
    category: 'Dictionary',
    description:
      'Compressione a dizionario con finestra scorrevole da 32 KB, hash chain a 3 byte e match da 3 a 258 byte.',
    complexity: 'O(N) — Medio',
    sourceFile: 'src/algorithms/lzss.ts',
    sourceCode: lzssSource,
    compress: compressLZSS,
    decompress: decompressLZSS,
  },
  {
    id: 'bwt-mtf',
    name: 'BWT + MTF + Zero-RLE',
    shortName: 'BWT+MTF',
    category: 'Block-Sorting',
    description:
      'Burrows-Wheeler Transform a blocchi da 64 KB (suffix sort O(N log N)), Move-To-Front e codifica RUNA/RUNB degli zeri.',
    complexity: 'O(N log B) — Intenso',
    sourceFile: 'src/algorithms/bwtMtf.ts',
    sourceCode: bwtMtfSource,
    compress: compressBwtMtf,
    decompress: decompressBwtMtf,
  },
  {
    id: 'gzip-native',
    name: 'Deflate / Gzip (Native)',
    shortName: 'Gzip',
    category: 'Native Stream',
    description:
      'Compressione Gzip/Deflate eseguita dal motore nativo del browser tramite Web Streams API (CompressionStream) a chunk da 1 MB.',
    complexity: 'Native C++ — Riferimento',
    sourceFile: 'src/algorithms/deflate.ts',
    sourceCode: deflateSource,
    compress: compressGzip,
    decompress: decompressGzip,
  },
];

export function getAlgorithmById(id: string): CompressionAlgorithm | undefined {
  return COMPRESSION_ALGORITHMS.find((algo) => algo.id === id);
}
