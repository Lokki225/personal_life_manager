import { Skeleton } from '@/components/ui/skeleton'

// Mirrors the Today page so nothing jumps when the data arrives.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading / Chargement</span>
    </main>
  )
}
