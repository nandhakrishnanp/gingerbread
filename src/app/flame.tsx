import { cn } from "./cn";

interface FlameProps {
  className?: string;
  /** Render a soft glow and rising embers behind the flame. */
  glow?: boolean;
  animated?: boolean;
}

/**
 * A hand-drawn flame — no emoji. The outer shape inherits `currentColor` so it
 * works on ink, lime and pastel surfaces alike.
 */
export function Flame({ className, glow = false, animated = true }: FlameProps) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      {glow && (
        <>
          <span
            aria-hidden
            className="animate-glow absolute inset-0 rounded-full bg-accent-lime/70 blur-xl"
          />
          <span
            aria-hidden
            className="animate-ember absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-accent-orange"
          />
          <span
            aria-hidden
            className="animate-ember absolute left-[38%] top-[46%] h-1.5 w-1.5 rounded-full bg-accent-butter [animation-delay:0.8s]"
          />
          <span
            aria-hidden
            className="animate-ember absolute left-[62%] top-[52%] h-1 w-1 rounded-full bg-accent-lime [animation-delay:1.5s]"
          />
        </>
      )}
      <svg
        viewBox="0 0 24 24"
        role="img"
        aria-label="Streak flame"
        className={cn("relative h-full w-full", animated && "animate-flame")}
      >
        <path
          d="M12 1.8c.6 3.6 3.1 5.7 4.9 7.6A7.6 7.6 0 0 1 19.2 14.6a7.2 7.2 0 1 1-14.4 0c0-2.2 1-4.1 2.4-5.8C9.1 6.7 11.1 4.8 12 1.8Z"
          fill="currentColor"
        />
        <path
          d="M12 9.8c.4 2 1.7 3.1 2.6 4.2.7.9 1.2 1.8 1.2 2.9a3.8 3.8 0 1 1-7.6 0c0-1.1.5-2.1 1.2-3 1-1.1 2.2-2.2 2.6-4.1Z"
          fill="rgba(255,255,255,0.86)"
        />
      </svg>
    </span>
  );
}

/** Small inline flame used beside streak counts. */
export function MiniFlame({ className }: { className?: string }) {
  return (
    <Flame
      animated
      className={cn("h-4 w-4", className)}
    />
  );
}
