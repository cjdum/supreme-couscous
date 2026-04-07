import React from "react";

/**
 * Lightweight markdown renderer.
 * Supports: # / ## / ### headings, **bold**, *italic*, `code`, - bullets,
 * 1. numbered lists, paragraph breaks, and inline links.
 */
export function Markdown({ text }: { text: string }) {
  return <>{renderMarkdown(text)}</>;
}

function renderInline(s: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // bold | italic | inline code | link
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b-${idx++}`} className="font-bold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      parts.push(
        <code
          key={`${keyPrefix}-c-${idx++}`}
          className="px-1.5 py-0.5 rounded bg-white/10 text-[0.85em] font-mono text-[#60A5FA]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const m2 = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (m2) {
        parts.push(
          <a
            key={`${keyPrefix}-l-${idx++}`}
            href={m2[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#60A5FA] hover:text-white underline underline-offset-2"
          >
            {m2[1]}
          </a>
        );
      } else {
        parts.push(tok);
      }
    } else {
      parts.push(
        <em key={`${keyPrefix}-i-${idx++}`} className="italic">
          {tok.slice(1, -1)}
        </em>
      );
    }
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let ulBuffer: string[] = [];
  let olBuffer: string[] = [];

  function flushUl() {
    if (ulBuffer.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="list-disc pl-5 space-y-1.5 my-2 marker:text-[#60A5FA]"
      >
        {ulBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item, `ul-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>
    );
    ulBuffer = [];
  }
  function flushOl() {
    if (olBuffer.length === 0) return;
    blocks.push(
      <ol
        key={`ol-${blocks.length}`}
        className="list-decimal pl-5 space-y-1.5 my-2 marker:text-[#60A5FA] marker:font-bold"
      >
        {olBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item, `ol-${blocks.length}-${i}`)}
          </li>
        ))}
      </ol>
    );
    olBuffer = [];
  }
  function flushAll() {
    flushUl();
    flushOl();
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith("### ")) {
      flushAll();
      blocks.push(
        <h4
          key={`h-${i}`}
          className="text-[11px] font-bold uppercase tracking-wider text-white/60 mt-3 mb-1.5"
        >
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      flushAll();
      blocks.push(
        <h3 key={`h-${i}`} className="text-base font-black mt-4 mb-2 text-white">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      flushAll();
      blocks.push(
        <h2 key={`h-${i}`} className="text-lg font-black mt-4 mb-2 text-white">
          {line.slice(2)}
        </h2>
      );
    } else if (/^[-*]\s+/.test(line)) {
      flushOl();
      ulBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      flushUl();
      olBuffer.push(line.replace(/^\d+\.\s+/, ""));
    } else if (line === "") {
      flushAll();
    } else {
      flushAll();
      blocks.push(
        <p key={`p-${i}`} className="leading-relaxed mb-2 last:mb-0">
          {renderInline(line, `p-${i}`)}
        </p>
      );
    }
  }
  flushAll();
  return blocks;
}
