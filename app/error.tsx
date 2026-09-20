'use client'

export default function GlobalError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-[var(--text)]">
      <div className="max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-6 text-center shadow-[var(--shadow-soft)] backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Finance app</p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">Something went wrong</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          The finance data could not be loaded. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 inline-flex rounded-xl border border-[var(--border)] bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--bg)]"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
