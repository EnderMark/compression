/**
 * Tokenizer TypeScript leggero (zero dipendenze) per il Code Inspector.
 * Restituisce token tipizzati per ogni riga così da renderizzare syntax highlighting
 * pulito e sicuro in React senza usare dangerouslySetInnerHTML.
 */

export type TokenType =
  | 'plain'
  | 'keyword'
  | 'type'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'operator';

export interface CodeToken {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  'export',
  'import',
  'from',
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'new',
  'throw',
  'try',
  'catch',
  'finally',
  'async',
  'await',
  'interface',
  'type',
  'class',
  'private',
  'public',
  'readonly',
  'true',
  'false',
  'null',
  'undefined',
  'typeof',
  'of',
  'in',
  'as',
]);

const TYPES = new Set([
  'Uint8Array',
  'Uint16Array',
  'Uint32Array',
  'Int32Array',
  'ArrayBuffer',
  'DataView',
  'BufferSource',
  'Promise',
  'CompressionStream',
  'DecompressionStream',
  'Error',
  'number',
  'string',
  'boolean',
  'void',
  'Math',
]);

const TOKEN_REGEX =
  /(\/\/.*$|\/\*[\s\S]*?\*\/|`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\b0x[0-9a-fA-F]+\b|\b\d+(?:_\d+)*(?:\.\d+)?\b|\b[A-Za-z_$][A-Za-z0-9_$]*\b|[=<>!+\-*/%&|^~?:]+)/gm;

export function tokenizeTypeScript(source: string): CodeToken[][] {
  // Gestisce commenti multi-linea tracciando lo stato tra le righe
  const lines = source.split('\n');
  let inBlockComment = false;

  return lines.map((line) => {
    const tokens: CodeToken[] = [];
    let pos = 0;

    if (inBlockComment) {
      const endIdx = line.indexOf('*/');
      if (endIdx === -1) {
        return [{ type: 'comment', value: line }];
      }
      tokens.push({ type: 'comment', value: line.slice(0, endIdx + 2) });
      pos = endIdx + 2;
      inBlockComment = false;
    }

    const rest = line.slice(pos);
    TOKEN_REGEX.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TOKEN_REGEX.exec(rest)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'plain', value: rest.slice(lastIndex, match.index) });
      }

      const raw = match[0];

      // Inizio di commento a blocco non chiuso sulla stessa riga
      if (raw.startsWith('/*') && !raw.endsWith('*/')) {
        tokens.push({ type: 'comment', value: rest.slice(match.index) });
        inBlockComment = true;
        lastIndex = rest.length;
        break;
      }

      let type: TokenType = 'plain';
      if (raw.startsWith('//') || raw.startsWith('/*')) {
        type = 'comment';
      } else if (raw.startsWith("'") || raw.startsWith('"') || raw.startsWith('`')) {
        type = 'string';
      } else if (/^(?:0x[0-9a-fA-F]+|\d)/.test(raw)) {
        type = 'number';
      } else if (KEYWORDS.has(raw)) {
        type = 'keyword';
      } else if (TYPES.has(raw)) {
        type = 'type';
      } else if (/^[A-Za-z_$]/.test(raw)) {
        // Se seguito da `(`, evidenzialo come chiamata/definizione di funzione
        const after = rest[match.index + raw.length];
        type = after === '(' ? 'function' : 'plain';
      } else {
        type = 'operator';
      }

      tokens.push({ type, value: raw });
      lastIndex = match.index + raw.length;
    }

    if (lastIndex < rest.length) {
      // Gestisce eventuali `/*` non chiusi fino a fine riga
      const tail = rest.slice(lastIndex);
      const blockStart = tail.indexOf('/*');
      if (blockStart !== -1 && tail.indexOf('*/', blockStart + 2) === -1) {
        if (blockStart > 0) {
          tokens.push({ type: 'plain', value: tail.slice(0, blockStart) });
        }
        tokens.push({ type: 'comment', value: tail.slice(blockStart) });
        inBlockComment = true;
      } else {
        tokens.push({ type: 'plain', value: tail });
      }
    }

    return tokens;
  });
}
