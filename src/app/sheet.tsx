"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Optional sticky footer inside the sheet. */
  footer?: ReactNode;
  /** `sheet` slides up from the bottom on phones; `dialog` is centred. */
  variant?: "sheet" | "dialog";
}

/**
 * Mobile-first bottom sheet that becomes a centred dialog on larger screens.
 * Handles scroll locking, Escape and a backdrop tap.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "sheet",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden border border-smoke bg-paper text-ink shadow-2xl",
          variant === "sheet"
            ? "rounded-t-[2rem] sm:max-w-md sm:rounded-[2rem]"
            : "mx-4 rounded-[2rem] sm:mx-0 sm:max-w-md",
          "animate-rise",
        ].join(" ")}
      >
        <div className="flex items-start gap-3 border-b border-smoke px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-ash">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-smoke text-ink transition hover:bg-mist active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="border-t border-smoke bg-paper px-5 py-3 safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
