import { Check, Code2, Copy, FileCode, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CompressionAlgorithm } from '../types/benchmark';
import { tokenizeTypeScript, type TokenType } from '../utils/syntaxHighlight';

interface CodeInspectorModalProps {
  algorithm: CompressionAlgorithm | null;
  onClose: () => void;
}

const TOKEN_CLASSES: Record<TokenType, string> = {
  plain: 'text-slate-200',
  keyword: 'text-sky-400 font-medium',
  type: 'text-teal-300',
  string: 'text-emerald-300',
  comment: 'text-slate-500 italic',
  number: 'text-amber-300',
  function: 'text-blue-300',
  operator: 'text-slate-400',
};

export function CodeInspectorModal({
  algorithm,
  onClose,
}: CodeInspectorModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!algorithm) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [algorithm, onClose]);

  const tokenizedLines = useMemo(() => {
    if (!algorithm) return [];
    return tokenizeTypeScript(algorithm.sourceCode);
  }, [algorithm]);

  if (!algorithm) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(algorithm.sourceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      id="code-inspector-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-inspector-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-4xl flex-col border-l border-[#2a3447] bg-[#0e131d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232b3b] bg-[#111620] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-sky-400" />
              <h2
                id="code-inspector-title"
                className="truncate text-base font-semibold text-slate-100"
              >
                {algorithm.name}
              </h2>
              <span className="rounded border border-[#2d384d] bg-[#182030] px-2 py-0.5 font-mono text-[11px] text-slate-300">
                {algorithm.category}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 font-mono text-slate-300">
                <FileCode className="h-3.5 w-3.5 text-slate-500" />
                {algorithm.sourceFile}
              </span>
              <span>·</span>
              <span className="font-mono">{tokenizedLines.length} righe</span>
              <span>·</span>
              <span className="font-mono">{algorithm.complexity}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-copy-source"
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#2a3447] bg-[#171e2d] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-[#1e273a]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copiato</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copia codice</span>
                </>
              )}
            </button>
            <button
              id="btn-close-inspector"
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#2a3447] bg-[#171e2d] p-1.5 text-slate-400 transition hover:bg-[#1e273a] hover:text-slate-100"
              aria-label="Chiudi Code Inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Description strip */}
        <div className="border-b border-[#1e2636] bg-[#101520] px-5 py-2.5 text-xs text-slate-400">
          {algorithm.description}
        </div>

        {/* Code body */}
        <div className="flex-1 overflow-auto bg-[#0b0e14] p-4 font-mono text-xs leading-6">
          <table className="w-full border-collapse">
            <tbody>
              {tokenizedLines.map((tokens, lineIdx) => (
                <tr key={lineIdx} className="hover:bg-[#131926]">
                  <td className="w-12 select-none pr-4 text-right align-top text-slate-600 tabular-nums">
                    {lineIdx + 1}
                  </td>
                  <td className="whitespace-pre text-slate-200">
                    {tokens.length === 0 ? (
                      '\u00A0'
                    ) : (
                      tokens.map((tok, tIdx) => (
                        <span key={tIdx} className={TOKEN_CLASSES[tok.type]}>
                          {tok.value}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
