export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mb-6 text-sm text-slate-600">
          Sign in to continue to your Personal Life Manager dashboard.
        </p>
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          Authentication is handled by the NextAuth credentials route.
        </div>
      </div>
    </main>
  )
}
