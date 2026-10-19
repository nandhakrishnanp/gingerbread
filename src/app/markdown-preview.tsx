"use client";

import { useEffect, useState } from "react";
import { marked } from "marked";

/** Renders sanitised Markdown supplied by the (already decrypted) editor. */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let active = true;
    const render = async () => {
      const [{ default: DOMPurify }] = await Promise.all([import("dompurify")]);
      if (!active) return;
      const raw = marked.parse(markdown, { async: false }) as string;
      setHtml(DOMPurify.sanitize(raw));
    };
    void render();
    return () => {
      active = false;
    };
  }, [markdown]);

  return (
    <div
      className="prose-gingerbread"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
