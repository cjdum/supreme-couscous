"use client";

import { useRef, useState, useEffect } from "react";
import { Bold, Italic, List, Image as ImageIcon, Link as LinkIcon } from "lucide-react";

interface RichComposerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

/**
 * Lightweight markdown-style composer with bold/italic/list/image/link buttons.
 * Persists to a textarea (markdown text), no contentEditable / iframe.
 * Image button opens file picker and pastes a base64 URL into the text.
 */
export function RichComposer({ value, onChange, placeholder = "Write your post...", rows = 6, maxLength = 5000 }: RichComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  function wrapSelection(prefix: string, suffix: string = prefix) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function insertList() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    // Insert "- " on a new line
    const prefix = value.slice(0, start);
    const needsNewline = prefix && !prefix.endsWith("\n");
    insertAtCursor(`${needsNewline ? "\n" : ""}- `);
  }

  function handleImageClick() {
    fileRef.current?.click();
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("Image must be under 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      insertAtCursor(`\n![image](${url})\n`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function insertLink() {
    const url = prompt("URL?");
    if (!url) return;
    wrapSelection("[", `](${url})`);
  }

  // Auto-resize
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 360)}px`;
  }, [value]);

  return (
    <div className={`rounded-2xl border ${focused ? "border-[var(--color-accent)] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]" : "border-[var(--color-border)]"} bg-[var(--color-bg-elevated)] transition-all overflow-hidden`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-border)]">
        <ToolbarButton onClick={() => wrapSelection("**")} label="Bold" icon={<Bold size={13} />} />
        <ToolbarButton onClick={() => wrapSelection("*")} label="Italic" icon={<Italic size={13} />} />
        <ToolbarButton onClick={insertList} label="List" icon={<List size={13} />} />
        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
        <ToolbarButton onClick={insertLink} label="Link" icon={<LinkIcon size={13} />} />
        <ToolbarButton onClick={handleImageClick} label="Image" icon={<ImageIcon size={13} />} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <span className="ml-auto text-[10px] text-[var(--color-text-muted)] tabular">
          {value.length} / {maxLength}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 outline-none px-4 py-3 text-sm text-white placeholder-[var(--color-text-muted)] resize-none focus:ring-0"
        style={{ minHeight: `${rows * 24}px` }}
      />
    </div>
  );
}

function ToolbarButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
    >
      {icon}
    </button>
  );
}

/**
 * Render a markdown string to React nodes (basic support for **bold**, *italic*, lists, images, links).
 */
export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: React.ReactNode[] = [];

  function flushList() {
    if (listBuffer.length > 0) {
      out.push(
        <ul key={`l-${out.length}`} className="list-disc pl-5 space-y-0.5 my-1">
          {listBuffer}
        </ul>
      );
      listBuffer = [];
    }
  }

  lines.forEach((line, i) => {
    // Image
    const imgMatch = line.match(/^!\[.*?\]\((.+?)\)$/);
    if (imgMatch) {
      flushList();
      out.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`img-${i}`} src={imgMatch[1]} alt="post image" className="rounded-xl my-2 max-w-full h-auto" />
      );
      return;
    }
    // List item
    if (/^- /.test(line)) {
      listBuffer.push(<li key={`li-${i}`}>{inlineRender(line.slice(2))}</li>);
      return;
    }
    flushList();
    if (line.trim() === "") {
      out.push(<br key={`br-${i}`} />);
    } else {
      out.push(<p key={`p-${i}`} className="mb-1">{inlineRender(line)}</p>);
    }
  });
  flushList();
  return out;
}

function inlineRender(text: string): React.ReactNode {
  // Process **bold**, *italic*, [link](url) — simple regex pass
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) parts.push(text.slice(cursor, m.index));
    if (m[2]) parts.push(<strong key={`s-${key++}`}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={`e-${key++}`}>{m[3]}</em>);
    else if (m[4] && m[5]) parts.push(<a key={`a-${key++}`} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-bright)] hover:underline">{m[4]}</a>);
    cursor = re.lastIndex;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
