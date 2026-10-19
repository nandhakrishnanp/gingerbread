import { StatusBadge } from "./status-badge";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-5xl" aria-hidden>
        🍪
      </span>
      <h1 className="font-serif text-5xl font-semibold tracking-tight">
        Gingerbread
      </h1>
      <p className="max-w-md text-pretty opacity-80">
        A private, end-to-end encrypted journal. Your words are locked in your
        browser before they ever leave your device.
      </p>
      <StatusBadge />
    </main>
  );
}
