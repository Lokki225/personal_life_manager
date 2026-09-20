export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-[var(--text)]">
      <div className="flex items-center gap-3 rounded-[28px] border border-[var(--border)] bg-[var(--panel)] px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur-md">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--text)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--text)]">Loading your finances...</p>
      </div>
    </main>
  )
}
