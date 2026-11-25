/**
 * Generatore di estratti MediaWiki XML (stile enwik9 / Hutter Prize) in più taglie
 * (1 MB, 10 MB, 50 MB, 100 MB) per test immediati e download locale senza backend.
 */

export interface SampleSizeOption {
  id: '1mb' | '10mb' | '50mb' | '100mb';
  label: string;
  bytes: number;
  filename: string;
}

export const SAMPLE_SIZE_OPTIONS: SampleSizeOption[] = [
  { id: '1mb', label: '1 MB', bytes: 1_048_576, filename: 'enwik9-sample-1mb.xml' },
  { id: '10mb', label: '10 MB', bytes: 10_485_760, filename: 'enwik9-sample-10mb.xml' },
  { id: '50mb', label: '50 MB', bytes: 52_428_800, filename: 'enwik9-sample-50mb.xml' },
  { id: '100mb', label: '100 MB', bytes: 104_857_600, filename: 'enwik9-sample-100mb.xml' },
];

const SAMPLE_ARTICLES: Array<{ title: string; id: number; body: string }> = [
  {
    title: 'Hutter Prize',
    id: 10042,
    body: `The '''Hutter Prize''' is a cash prize funded by [[Marcus Hutter]] which rewards [[data compression]] improvements on a specific 1 [[gigabyte]] English text file named '''enwik9'''. The goal of the Hutter Prize is to encourage research in [[artificial intelligence]] (AI). The organizers believe that text compression and AI are equivalent problems.
== Motivation ==
Hutter's [[AIXI]] model of universal artificial intelligence relies on [[Solomonoff's theory of inductive inference]], which is closely linked to [[Kolmogorov complexity]]. Because optimal compression requires understanding the semantic, syntactic, and factual structure of natural language, compressing a large snapshot of [[Wikipedia]] serves as a practical benchmark for general intelligence.
== Dataset ==
* '''enwik8''': The first 100,000,000 bytes (100 MB) of the English Wikipedia XML dump from March 3, 2006.
* '''enwik9''': The first 1,000,000,000 bytes (1 GB) of the same XML dump, containing over 240,000 articles, markup, infoboxes, and tables.
[[Category:Artificial intelligence]][[Category:Data compression]][[Category:Competitions]]`,
  },
  {
    title: 'Burrows–Wheeler transform',
    id: 10089,
    body: `The '''Burrows–Wheeler transform''' ('''BWT''', also called '''block-sorting compression''') rearranges a character string into runs of similar characters. This is useful for compression, since it tends to be easy to compress a string that has runs of repeated characters by techniques such as [[move-to-front transform]] and [[run-length encoding]].
== Algorithm ==
When a character string is transformed by the BWT, the transformation permutes the order of the characters. If the original string had several substrings that occurred often, then the transformed string will have several places where a single character is repeated multiple times in a row.
=== Example ===
The transform is computed by sorting all cyclic rotations of the input block lexicographically and extracting the last column ''L'' together with the primary index pointing to the original row. The inverse transform uses the '''LF-mapping''' property and runs in linear O(N) time without needing to reconstruct the rotation matrix.
[[Category:Data compression]][[Category:String algorithms]]`,
  },
  {
    title: 'LZ77 and LZ78',
    id: 10112,
    body: `'''LZ77''' and '''LZ78''' are the two [[lossless data compression]] algorithms published in papers by [[Abraham Lempel]] and [[Jacob Ziv]] in 1977 and 1978. They are also known as '''LZ1''' and '''LZ2''' respectively. These two algorithms form the basis for many variations including [[LZW]], [[LZSS]], [[LZMA]], and [[DEFLATE]].
== Sliding Window ==
LZ77 algorithms achieve compression by replacing repeated occurrences of data with references to a single copy of that data existing earlier in the uncompressed data stream. A match is encoded by a pair of numbers called a '''length–distance pair''', which is equivalent to the statement "each of the next ''length'' characters is equal to the characters exactly ''distance'' characters behind it in the uncompressed stream".
In '''LZSS''' (Lempel–Ziv–Storer–Szymanski), a 1-bit flag indicates whether the next token is a literal byte or a length–distance reference, avoiding overhead when no match of at least 3 bytes is found.
[[Category:Lossless compression algorithms]][[Category:Information theory]]`,
  },
  {
    title: 'Huffman coding',
    id: 10154,
    body: `In [[computer science]] and [[information theory]], a '''Huffman code''' is a particular type of optimal [[prefix code]] that is commonly used for [[lossless data compression]]. The process of finding or using such a code proceeds by means of '''Huffman coding''', an algorithm developed by [[David A. Huffman]] while he was a Sc.D. student at [[MIT]], and published in the 1952 paper "A Method for the Construction of Minimum-Redundancy Codes".
== Canonical Huffman Codes ==
A '''canonical Huffman code''' is a particular type of Huffman code with unique properties which allow it to be described in a very compact manner. Rather than serializing the full binary tree structure, only the bit-length of each symbol's codeword needs to be transmitted. Both encoder and decoder reconstruct the exact same prefix-free codes deterministically from the length table.
[[Category:Entropy coding]][[Category:Information theory]]`,
  },
  {
    title: 'DEFLATE',
    id: 10203,
    body: `In computing, '''DEFLATE''' is a [[lossless data compression]] file format that uses a combination of [[LZSS]] and [[Huffman coding]]. It was designed by [[Phil Katz]] for version 2 of his [[PKZIP]] archiving tool. DEFLATE was later specified in [[RFC 1951]] (1996).
== Stream Structure ==
A DEFLATE stream consists of a series of blocks. Each block is preceded by a 3-bit header indicating whether it is the final block and which encoding method is used:
# Stored (uncompressed) block, up to 65,535 bytes.
# Compressed with fixed (predefined) Huffman trees.
# Compressed with dynamic Huffman trees tailored to the block's symbol frequencies.
DEFLATE is the core compression algorithm used in [[gzip]], [[zlib]], [[PNG]], and HTTP content encoding.
[[Category:Lossless compression algorithms]][[Category:Internet Standards]]`,
  },
  {
    title: 'Information entropy',
    id: 10277,
    body: `In [[information theory]], the '''entropy''' of a [[random variable]] is the average level of "information", "surprise", or "uncertainty" inherent to the variable's possible outcomes. Given a discrete random variable X with possible outcomes x_1, ..., x_n occurring with probability P(x_1), ..., P(x_n), the entropy of X is formally defined as H(X) = -sum(P(x_i) log_2 P(x_i)).
== Relation to Compression ==
[[Claude Shannon]]'s source coding theorem proves that no lossless compression algorithm can represent a sequence of independent and identically distributed symbols using fewer bits per symbol, on average, than the Shannon entropy H(X). For English text such as Wikipedia, character-level order-0 entropy is roughly 4.5 to 5.0 bits per byte, while high-order contextual models approach ~1.1 bits per byte.
[[Category:Information theory]][[Category:Claude Shannon]]`,
  },
];

function buildXmlChunk(chunkIndex: number, targetChunkBytes: number): Uint8Array {
  const parts: string[] = [];
  let len = 0;
  let pageOffset = chunkIndex * 180;
  const baseRev = 15_800_000 + chunkIndex * 6_700;

  while (len < targetChunkBytes) {
    const base = SAMPLE_ARTICLES[pageOffset % SAMPLE_ARTICLES.length];
    const variant = Math.floor(pageOffset / SAMPLE_ARTICLES.length);
    const revId = baseRev + (pageOffset % 180) * 37;
    const day = String((pageOffset % 28) + 1).padStart(2, '0');
    const hour = String(pageOffset % 24).padStart(2, '0');
    const minute = String((pageOffset * 7) % 60).padStart(2, '0');
    const suffix = variant === 0 ? '' : ` (Section ${variant})`;

    const pageXml = `  <page>
    <title>${base.title}${suffix}</title>
    <id>${base.id + variant * 1000}</id>
    <revision>
      <id>${revId}</id>
      <timestamp>2006-03-${day}T${hour}:${minute}:12Z</timestamp>
      <contributor>
        <username>WikiEditor${(pageOffset % 48) + 1}</username>
        <id>${2000 + (pageOffset % 48)}</id>
      </contributor>
      <comment>Copyedit and benchmark metadata update #${pageOffset + 1}</comment>
      <text xml:space="preserve">${base.body}
== Notes (Rev ${revId}) ==
Archived snapshot entry #${pageOffset + 1} for lossless compression benchmarking on browser Web Workers. Checksum reference index: ${(revId % 9973).toString(16).toUpperCase()}.</text>
    </revision>
  </page>\n`;

    parts.push(pageXml);
    len += pageXml.length;
    pageOffset++;
  }

  return new TextEncoder().encode(parts.join(''));
}

/**
 * Genera rapidamente un File MediaWiki XML sintetico della dimensione richiesta
 * (es. 1 MB, 10 MB, 50 MB, 100 MB) riutilizzando un pool di chunk variati da 256 KB
 * per evitare picchi di memoria e mantenere la generazione istantanea nel browser.
 */
export function generateWikipediaSampleFile(
  targetBytes = 1_048_576,
  filename?: string,
): File {
  const header = `<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.3/" xml:lang="en">
  <siteinfo>
    <sitename>Wikipedia</sitename>
    <base>https://en.wikipedia.org/wiki/Main_Page</base>
    <generator>MediaWiki 1.6alpha</generator>
    <case>first-letter</case>
  </siteinfo>\n`;
  const footer = `</mediawiki>\n`;

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(header);
  const footerBytes = encoder.encode(footer);

  // Crea un pool di 8 chunk distinti (~256 KB ciascuno, ~2 MB unici) così che
  // anche file da 50-100 MB si generino in pochi millisecondi senza saturare il GC.
  const chunkTarget = Math.min(262_144, Math.max(32_768, targetBytes));
  const poolSize = targetBytes <= 2_097_152 ? Math.ceil(targetBytes / chunkTarget) : 8;
  const pool: Uint8Array[] = [];
  for (let i = 0; i < poolSize; i++) {
    pool.push(buildXmlChunk(i, chunkTarget));
  }

  const blobParts: BlobPart[] = [headerBytes];
  let currentBytes = headerBytes.byteLength + footerBytes.byteLength;
  let chunkSeq = 0;

  while (currentBytes < targetBytes) {
    const chunk = pool[chunkSeq % pool.length];
    const remaining = targetBytes - currentBytes;
    if (chunk.byteLength <= remaining) {
      blobParts.push(chunk as BlobPart);
      currentBytes += chunk.byteLength;
    } else {
      // Aggiunge un blocco finale troncato in modo pulito su un newline se possibile
      let cut = remaining;
      while (cut > 0 && chunk[cut - 1] !== 0x0a) cut--;
      blobParts.push(chunk.subarray(0, cut > 0 ? cut : remaining) as BlobPart);
      currentBytes = targetBytes;
    }
    chunkSeq++;
  }

  blobParts.push(footerBytes);

  const mbLabel = Math.max(1, Math.round(targetBytes / 1_048_576));
  const resolvedName = filename ?? `enwik9-sample-${mbLabel}mb.xml`;
  const blob = new Blob(blobParts, { type: 'application/xml' });

  return new File([blob], resolvedName, {
    type: 'application/xml',
    lastModified: Date.now(),
  });
}

export function triggerFileDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
