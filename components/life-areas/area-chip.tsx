import { BookOpen, Briefcase, Code, Heart, Music, Sparkles, Sprout, Star, Users, type LucideIcon } from 'lucide-react'

import type { AreaColor, AreaIcon } from '@/domain/lifeAreas/areas'
import { cn } from '@/lib/utils'

// A life area as a small chip, in its colour and with its icon.

export const AREA_ICON_COMPONENTS: Record<AreaIcon, LucideIcon> = {
  code: Code,
  music: Music,
  book: BookOpen,
  heart: Heart,
  users: Users,
  briefcase: Briefcase,
  sprout: Sprout,
  star: Star,
}

// Whole class names, so Tailwind keeps them; light and dark.
export const AREA_COLOR_CLASSES: Record<AreaColor, string> = {
  blue: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  orange: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
  teal: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  rose: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  green: 'bg-green-500/12 text-green-700 dark:text-green-300',
  slate: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
}

export type AreaLook = { name: string; color: string | null; icon: string | null }

export function AreaChip({ area, className }: { area: AreaLook; className?: string }) {
  const Icon = AREA_ICON_COMPONENTS[area.icon as AreaIcon] ?? Sparkles
  const colour = AREA_COLOR_CLASSES[area.color as AreaColor] ?? 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', colour, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {area.name}
    </span>
  )
}
