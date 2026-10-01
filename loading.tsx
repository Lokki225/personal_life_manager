// app/finance/today/loading.tsx  (same pattern for chests, goals, history, review, and app/finance/loading.tsx)
export default function Loading() {
  return (
    <main className="theme-shell px-4 py-6 md:px-6 pb-24">
      <div className="mx-auto max-w-2xl space-y-4 animate-pulse">
        <div className="h-8 w-32 rounded-lg bg-[var(--panel-muted)]" />
        <div className="bento-card p-6 h-32 bg-[var(--panel-muted)]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bento-card p-4 h-20 bg-[var(--panel-muted)]" />
          <div className="bento-card p-4 h-20 bg-[var(--panel-muted)]" />
        </div>
        <div className="bento-card p-4 h-24 bg-[var(--panel-muted)]" />
        <div className="bento-card p-5 h-40 bg-[var(--panel-muted)]" />
      </div>
    </main>
  )
}