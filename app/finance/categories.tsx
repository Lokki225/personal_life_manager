import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bus,
  CircleEllipsis,
  CircleHelp,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  Siren,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

import { m, type Translator } from '@/lib/i18n/translate'

// `label` is English: pass it through the translator before showing it.
type CategoryStyle = { label: string; icon: LucideIcon }

const CATEGORIES: Record<string, CategoryStyle> = {
  food: { label: m('Food'), icon: Utensils },
  transport: { label: m('Transport'), icon: Bus },
  transportation: { label: m('Transport'), icon: Bus },
  shopping: { label: m('Shopping'), icon: ShoppingBag },
  emergency: { label: m('Emergency'), icon: Siren },
  other: { label: m('Other'), icon: CircleEllipsis },
  // An overspend recorded without a cause, until it is explained.
  unexplained: { label: m('Not explained yet'), icon: CircleHelp },
}

// Label and icon for an expense or exception category. Unknown values (older
// data) keep their own name with a neutral icon.
export function categoryStyle(category: string | null | undefined): CategoryStyle {
  const key = (category ?? 'other').toLowerCase()

  return CATEGORIES[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), icon: ReceiptText }
}

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-chart-1',
  transport: 'bg-chart-2',
  transportation: 'bg-chart-2',
  shopping: 'bg-chart-3',
  emergency: 'bg-chart-4',
}

// The colour a category keeps in every chart. Anything else is a neutral grey.
export function categoryColor(category: string | null | undefined): string {
  return CATEGORY_COLORS[(category ?? 'other').toLowerCase()] ?? 'bg-muted-foreground/50'
}

type EventLike = {
  type: 'expense' | 'exception' | 'movement'
  category?: string
  label: string
  movementType?: 'IN' | 'OUT' | 'TRANSFER'
  sourceChestName?: string | null
  destinationChestName?: string | null
}

// One icon, one word and one colour per kind of event, so a timeline reads at
// a glance. `where` names the chest involved, when there is one.
export function eventStyle(
  event: EventLike,
  t: Translator,
): { icon: LucideIcon; kind: string; tone: string; where: string | null } {
  if (event.type === 'expense') {
    const { icon, label } = categoryStyle(event.category)
    return { icon, kind: t(label), tone: 'bg-muted text-muted-foreground', where: null }
  }

  if (event.type === 'exception') {
    return { icon: TriangleAlert, kind: t('Exception'), tone: 'bg-warning/15 text-warning', where: null }
  }

  if (event.movementType === 'TRANSFER') {
    return {
      icon: ArrowLeftRight,
      kind: t('Transfer'),
      tone: 'bg-category-income/15 text-category-income',
      where: null,
    }
  }

  if (event.movementType === 'OUT') {
    return {
      icon: ArrowUpRight,
      kind: t('Money out'),
      tone: 'bg-muted text-muted-foreground',
      where: event.sourceChestName ? t('From {chest}', { chest: event.sourceChestName }) : null,
    }
  }

  return {
    icon: event.label === 'Daily saving' ? PiggyBank : ArrowDownLeft,
    kind: event.label === 'Daily saving' ? t('Saved') : t('Money in'),
    tone: 'bg-success/15 text-success',
    where: event.destinationChestName ? t('Into {chest}', { chest: event.destinationChestName }) : null,
  }
}
