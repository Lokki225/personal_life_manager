import { cn } from '@/lib/utils'

// A person's picture, or their initial on a tinted disc when they have none.
export function Avatar({
  name,
  picture,
  className,
}: {
  name: string
  picture?: string | null
  className?: string
}) {
  return picture ? (
    // A small image stored with the account, not a file Next.js can optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={picture} alt="" className={cn('size-9 shrink-0 rounded-full object-cover', className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground',
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
