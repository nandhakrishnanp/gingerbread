"use client";

import { useCallback, useState } from "react";
import type { Draft, EntryPlain } from "@/lib/types";
import { MarkdownPreview } from "./markdown-preview";
import { TagInput } from "./tag-input";
import { dangerButtonClass, ghostButtonClass, inputClass } from "./ui";

export type SaveStatus = "saved" | "saving" | "dirty" | "error";

export interface HistoryItem {
  version: number;
  createdAt: string;
  preview: string;
  plain: EntryPlain;
}

interface Props {
  draft: Draft;
  status: SaveStatus;
  onPatch: (patch: Partial<Draft>) => void;
  onFlush: () => void;
  onDelete: () => void;
  historyOpen: boolean;
  history: HistoryItem[];
  historyLoading: boolean;
  onToggleHistory: () => void;
  onRestore: (item: HistoryItem) => void;
  /** Present when the editor is shown as a compose overlay. */
  onClose?: () => void;
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  dirty: "Unsaved changes",
  error: "Could not save",
};

export function EntryEditor({
  draft,
  status,
  onPatch,
  onFlush,
  onDelete,
  historyOpen,
  history,
  historyLoading,
  onToggleHistory,
  onRestore,
  onClose,
}: Props) {
  const [preview, setPreview] = useState(false);
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);

  const runTool = useCallback(
    (action: string) => {
      const ta = textarea;
      if (!ta) return;
      const { selectionStart: start, selectionEnd: end, value } = ta;

      const surround = (before: string, after = before) => {
        const selected = value.slice(start, end);
        onPatch({
          markdown: value.slice(0, start) + before + selected + after + value.slice(end),
        });
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(start + before.length, start + before.length + selected.length);
        });
      };

      const prefixLines = (prefix: string) => {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = value.indexOf("\n", end);
        const stop = lineEnd === -1 ? value.length : lineEnd;
        const block = value
          .slice(lineStart, stop)
          .split("\n")
          .map((line) => prefix + line)
          .join("\n");
        onPatch({ markdown: value.slice(0, lineStart) + block + value.slice(stop) });
      };

      switch (action) {
        case "bold":
          return surround("**");
        case "italic":
          return surround("_");
        case "heading":
          return prefixLines("## ");
        case "ul":
          return prefixLines("- ");
        case "ol":
          return prefixLines("1. ");
        case "quote":
          return prefixLines("> ");
        case "code":
          return surround("`");
        case "link":
          return surround("[", "](https://)");
      }
    },
    [onPatch, textarea],
  );

  const tools: Array<{ label: string; title: string; action: string }> = [
    { label: "B", title: "Bold", action: "bold" },
    { label: "I", title: "Italic", action: "italic" },
    { label: "H", title: "Heading", action: "heading" },
    { label: "•", title: "Bullet list", action: "ul" },
    { label: "1.", title: "Numbered list", action: "ol" },
    { label: "❝", title: "Quote", action: "quote" },
    { label: "</>", title: "Code", action: "code" },
    { label: "🔗", title: "Link", action: "link" },
  ];

  return (
    <div className="flex w-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-3 dark:border-white/15">
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-lg transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            ✕
          </button>
        )}
        <input
          type="date"
          className={`${inputClass} w-auto flex-none`}
          value={draft.date}
          onChange={(e) => onPatch({ date: e.target.value })}
          onBlur={onFlush}
        />
        <span
          className={`text-xs ${
            status === "error" ? "text-red-600 dark:text-red-400" : "opacity-60"
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? "Write" : "Preview"}
          </button>
          <button type="button" className={ghostButtonClass} onClick={onToggleHistory}>
            History
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={() => {
              if (confirm("Delete this entry? This cannot be undone.")) onDelete();
            }}
          >
            Delete
          </button>
        </div>
      </header>

      <input
        className="mt-4 w-full bg-transparent font-serif text-3xl font-semibold outline-none placeholder:opacity-40"
        placeholder="Untitled"
        value={draft.title}
        onChange={(e) => onPatch({ title: e.target.value })}
        onBlur={onFlush}
      />

      {historyOpen && (
        <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] p-4 text-sm dark:border-white/15 dark:bg-white/[0.04]">
          <p className="font-medium">Version history</p>
          {historyLoading ? (
            <p className="mt-2 opacity-60">Loading…</p>
          ) : history.length === 0 ? (
            <p className="mt-2 opacity-60">No earlier versions yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {history.map((item) => (
                <li key={item.version} className="flex items-center gap-3">
                  <span className="opacity-60">
                    v{item.version} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  <span className="min-w-0 flex-1 truncate opacity-80">
                    {item.preview || "(empty)"}
                  </span>
                  <button
                    type="button"
                    className={ghostButtonClass}
                    onClick={() => onRestore(item)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1">
        {!preview &&
          tools.map((tool) => (
            <button
              key={tool.title}
              type="button"
              title={tool.title}
              className="rounded-md px-2 py-1 text-sm transition hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => runTool(tool.action)}
            >
              {tool.label}
            </button>
          ))}
      </div>

      <div className="mt-2 flex-1">
        {preview ? (
          <MarkdownPreview markdown={draft.markdown} />
        ) : (
          <textarea
            ref={setTextarea}
            className="min-h-[40vh] w-full resize-none bg-transparent font-mono text-[0.95rem] leading-relaxed outline-none placeholder:opacity-40"
            placeholder="Write freely…"
            value={draft.markdown}
            onChange={(e) => onPatch({ markdown: e.target.value })}
            onBlur={onFlush}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                onFlush();
              }
            }}
          />
        )}
      </div>

      <footer className="border-t border-black/10 pt-3 dark:border-white/15">
        <TagInput tags={draft.tags} onChange={(tags) => onPatch({ tags })} />
      </footer>
    </div>
  );
}
