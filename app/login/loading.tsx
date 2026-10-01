// Mirrors the form column of the login page so nothing jumps when it arrives.
export default function LoginLoading() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-6" aria-busy="true">
      <div className="mx-auto w-full max-w-sm animate-pulse space-y-5">
        <div className="h-7 w-40 rounded-md bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted" />
        <div className="h-11 rounded-md bg-muted" />
        <div className="h-11 rounded-md bg-muted" />
        <div className="h-11 rounded-md bg-muted" />
        <span className="sr-only">Loading sign in</span>
      </div>
    </main>
  )
}
