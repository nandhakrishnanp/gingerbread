"use client";

import { useCallback, useState } from "react";
import {
  Bold,
  Check,
  Code,
  Eye,
  Heading2,
  History as HistoryIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  LoaderCircle,
  Pencil,
  Quote,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Draft, EntryPlain } from "@/lib/types";
import { MarkdownPreview } from "./markdown-preview";
import { TagInput } from "./tag-input";
import { cn } from "./cn";

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
  dirty: "Unsaved",
  error: "Save failed",
};

const STATUS_STYLE: Record<SaveStatus, string> = {
  saved: "bg-accent-lime text-[#09090b]",
  saving: "bg-accent-butter text-[#09090b]",
  dirty: "bg-accent-sky text-[#09090b]",
  error: "bg-red-500 text-white",
};

const TOOLS = [
  { title: "Bold", action: "bold", Icon: Bold },
  { title: "Italic", action: "italic", Icon: Italic },
  { title: "Heading", action: "heading", Icon: Heading2 },
  { title: "Bullet list", action: "ul", Icon: List },
  { title: "Numbered list", action: "ol", Icon: ListOrdered },
  { title: "Quote", action: "quote", Icon: Quote },
  { title: "Code", action: "code", Icon: Code },
  { title: "Link", action: "link", Icon: LinkIcon },
] as const;

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const runTool = useCallback(
    (action: string) => {
      const ta = textarea;
      if (!ta) return;
      const { selectionStart: start, selectionEnd: end, value } = ta;

      const surround = (before: string, after = before) => {
        const selected = value.slice(start, end);
        onPatch({
          markdown:
            value.slice(0, start) + before + selected + after + value.slice(end),
        });
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(
            start + before.length,
            start + before.length + selected.length,
          );
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
        onPatch({
          markdown: value.slice(0, lineStart) + block + value.slice(stop),
        });
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

  return (
    <div className="flex min-h-full w-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-smoke pb-3">
        {onClose && (
          <button
            type="button"
            aria-label="Close editor"
            onClick={onClose}
            className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full border border-smoke transition hover:bg-mist"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}

        <label className="relative">
          <span className="sr-only">Entry date</span>
          <input
            type="date"
            className="h-9 rounded-full border border-smoke bg-mist px-3 text-xs font-medium text-ink outline-none focus:border-ink"
            value={draft.date}
            onChange={(event) => onPatch({ date: event.target.value })}
            onBlur={onFlush}
          />
        </label>

        <span
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[0.62rem] font-bold uppercase tracking-wide",
            STATUS_STYLE[status],
          )}
        >
          {status === "saving" && (
            <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />
          )}
          {status === "saved" && <Check className="h-3 w-3" aria-hidden />}
          {status === "error" && (
            <TriangleAlert className="h-3 w-3" aria-hidden />
          )}
          {STATUS_LABEL[status]}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreview((value) => !value)}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-smoke px-3 text-xs font-semibold transition hover:bg-mist"
            aria-pressed={preview}
          >
            {preview ? (
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">{preview ? "Write" : "Preview"}</span>
          </button>
          <button
            type="button"
            onClick={onToggleHistory}
            aria-pressed={historyOpen}
            className={cn(
              "tap grid h-9 w-9 place-items-center rounded-full border border-smoke transition hover:bg-mist",
              historyOpen && "bg-mist",
            )}
            title="Version history"
            aria-label="Version history"
          >
            <HistoryIcon className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete();
            }}
            className={cn(
              "tap inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
              confirmDelete
                ? "bg-red-600 text-white"
                : "border border-red-500/25 text-red-600 hover:bg-red-500/10 dark:text-red-300",
            )}
            aria-label={confirmDelete ? "Confirm delete entry" : "Delete entry"}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">
              {confirmDelete ? "Confirm" : "Delete"}
            </span>
          </button>
        </div>
      </header>

      <input
        className="mt-4 w-full bg-transparent text-[1.9rem] font-semibold leading-tight tracking-[-0.035em] outline-none placeholder:text-ash/60"
        placeholder="Untitled"
        value={draft.title}
        onChange={(event) => onPatch({ title: event.target.value })}
        onBlur={onFlush}
      />

      {historyOpen && (
        <div className="mt-4 rounded-2xl border border-smoke bg-mist/60 p-4 text-sm">
          <p className="font-semibold">Version history</p>
          {historyLoading ? (
            <p className="mt-2 text-ash">Loading…</p>
          ) : history.length === 0 ? (
            <p className="mt-2 text-ash">No earlier versions yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {history.map((item) => (
                <li key={item.version} className="flex items-center gap-2">
                  <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-wide text-ash">
                    v{item.version}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink/75">
                    {item.preview || "(empty)"}
                  </span>
                  <button
                    type="button"
                    className="tap shrink-0 rounded-full border border-smoke bg-paper px-2.5 py-1 text-[0.68rem] font-semibold"
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

      {!preview && (
        <div className="mt-4 flex flex-wrap gap-1 rounded-2xl border border-smoke bg-mist/50 p-1">
          {TOOLS.map(({ title, action, Icon }) => (
            <button
              key={title}
              type="button"
              title={title}
              aria-label={title}
              className="tap grid h-9 w-9 place-items-center rounded-xl text-ink/70 transition hover:bg-paper hover:text-ink"
              onClick={() => runTool(action)}
            >
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex-1">
        {preview ? (
          <div className="rounded-2xl border border-smoke p-4">
            <MarkdownPreview markdown={draft.markdown} />
          </div>
        ) : (
          <textarea
            ref={setTextarea}
            className="min-h-[42vh] w-full resize-none bg-transparent text-[1rem] leading-relaxed outline-none placeholder:text-ash/60"
            placeholder="Write freely…"
            value={draft.markdown}
            onChange={(event) => onPatch({ markdown: event.target.value })}
            onBlur={onFlush}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                onFlush();
              }
            }}
          />
        )}
      </div>

      <footer className="mt-2 border-t border-smoke pt-3">
        <TagInput tags={draft.tags} onChange={(tags) => onPatch({ tags })} />
      </footer>
    </div>
  );
}
