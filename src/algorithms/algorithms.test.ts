import { describe, expect, it } from 'vitest';
import { compressBwtMtf, decompressBwtMtf } from './bwtMtf';
import { compressGzip, decompressGzip } from './deflate';
import { compressHuffman, decompressHuffman } from './huffman';
import { compressLZSS, decompressLZSS } from './lzss';
import { compressRLE, decompressRLE } from './rle';
import { StreamingCRC32, StreamingSHA256 } from '../utils/hash';

const ALGORITHMS = [
  { name: 'RLE', compress: compressRLE, decompress: decompressRLE },
  { name: 'LZSS', compress: compressLZSS, decompress: decompressLZSS },
  { name: 'Huffman', compress: compressHuffman, decompress: decompressHuffman },
  { name: 'BWT+MTF', compress: compressBwtMtf, decompress: decompressBwtMtf },
  { name: 'Gzip', compress: compressGzip, decompress: decompressGzip },
];

function makeWikipediaXml(repeatCount: number): Uint8Array {
  const article = `<page>
  <title>Data compression</title>
  <id>42019</id>
  <revision>
    <id>15898945</id>
    <timestamp>2006-03-03T12:00:00Z</timestamp>
    <contributor><username>HutterBench</username><id>1024</id></contributor>
    <text xml:space="preserve">In [[information theory]], '''data compression''', [[source coding]], or '''bit-rate reduction''' is the process of encoding information using fewer [[bit]]s than the original representation. Any particular compression is either [[lossy compression|lossy]] or [[lossless compression|lossless]]. Lossless compression reduces bits by identifying and eliminating statistical redundancy. No information is lost in lossless compression.
== Algorithms ==
* [[Run-length encoding]] (RLE)
* [[Huffman coding]]
* [[LZ77 and LZ78|LZ77 / LZSS]]
* [[Burrows–Wheeler transform]] (BWT) + [[Move-to-front transform]] (MTF)
* [[DEFLATE]] (used in [[gzip]] and [[ZIP (file format)|ZIP]])
[[Category:Data compression]][[Category:Information theory]]</text>
  </revision>
</page>\n`;
  return new TextEncoder().encode(article.repeat(repeatCount));
}

function makePseudoRandomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  let seed = 0x12345678;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    buf[i] = (seed >>> 24) & 0xff;
  }
  return buf;
}

describe('Lossless Compression Algorithms Round-Trip', () => {
  const datasets: Array<{ label: string; data: Uint8Array; expectShrink?: boolean }> = [
    { label: 'empty buffer (0 B)', data: new Uint8Array(0) },
    { label: 'single byte (1 B)', data: new Uint8Array([0x42]) },
    { label: 'single repeated symbol (10 KB)', data: new Uint8Array(10_000).fill(0x41), expectShrink: true },
    { label: 'all 256 byte values', data: Uint8Array.from({ length: 256 }, (_, i) => i) },
    { label: 'high-entropy random binary (70 KB, multi-block BWT)', data: makePseudoRandomBytes(70_000) },
    { label: 'Wikipedia XML excerpt (~100 KB)', data: makeWikipediaXml(120), expectShrink: true },
  ];

  for (const algo of ALGORITHMS) {
    describe(algo.name, () => {
      for (const ds of datasets) {
        it(`losslessly round-trips ${ds.label}`, async () => {
          const compressed = await algo.compress(ds.data);
          const decompressed = await algo.decompress(compressed);

          expect(decompressed.length).toBe(ds.data.length);
          let firstMismatch = -1;
          for (let i = 0; i < ds.data.length; i++) {
            if (decompressed[i] !== ds.data[i]) {
              firstMismatch = i;
              break;
            }
          }
          expect(firstMismatch).toBe(-1);

          if (ds.expectShrink && algo.name !== 'RLE') {
            expect(compressed.length).toBeLessThan(ds.data.length);
          }
        });
      }
    });
  }
});

describe('Streaming Hash Utilities', () => {
  it('computes exact SHA-256 for standard test vector "abc"', () => {
    const sha = new StreamingSHA256();
    sha.update(new TextEncoder().encode('a'));
    sha.update(new TextEncoder().encode('bc'));
    expect(sha.digestHex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('computes exact CRC32 for "123456789"', () => {
    const crc = new StreamingCRC32();
    crc.update(new TextEncoder().encode('12345'));
    crc.update(new TextEncoder().encode('6789'));
    expect(crc.digestHex()).toBe('cbf43926');
  });
});
