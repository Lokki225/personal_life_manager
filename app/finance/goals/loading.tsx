import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-56" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <span className="sr-only">Loading</span>
    </main>
  )
}
