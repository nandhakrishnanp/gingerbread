"use client";

import { useState } from "react";

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
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-ginger/20 px-3 py-1 text-sm text-ember"
        >
          #{tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="opacity-60 hover:opacity-100"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:opacity-50"
        placeholder="Add a tag…"
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) add(e.target.value.slice(0, -1));
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}
