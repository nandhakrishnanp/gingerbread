"use client";

import { useState } from "react";
import { Hash, X } from "lucide-react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/** Simple chip input: type and press Enter (or comma) to add a tag. */
export function TagInput({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function add(value: string) {
    const tag = value.trim().replace(/^#/, "");
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ash">
        <Hash className="h-3 w-3" aria-hidden /> Tags
      </span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink"
        >
          #{tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="text-ash transition hover:text-ink"
            onClick={() => onChange(tags.filter((value) => value !== tag))}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent px-1 py-1 text-xs outline-none placeholder:text-ash"
        placeholder="Add a tag…"
        value={draft}
        onChange={(event) => {
          if (event.target.value.endsWith(",")) add(event.target.value.slice(0, -1));
          else setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(draft);
          } else if (event.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}
