import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bus,
  CircleEllipsis,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  Siren,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

type CategoryStyle = { label: string; icon: LucideIcon }

const CATEGORIES: Record<string, CategoryStyle> = {
  food: { label: 'Food', icon: Utensils },
  transport: { label: 'Transport', icon: Bus },
  transportation: { label: 'Transport', icon: Bus },
  shopping: { label: 'Shopping', icon: ShoppingBag },
  emergency: { label: 'Emergency', icon: Siren },
  other: { label: 'Other', icon: CircleEllipsis },
}

// Label and icon for an expense or exception category. Unknown values (older
// data) keep their own name with a neutral icon.
export function categoryStyle(category: string | null | undefined): CategoryStyle {
  const key = (category ?? 'other').toLowerCase()

  return CATEGORIES[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), icon: ReceiptText }
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
export function eventStyle(event: EventLike): { icon: LucideIcon; kind: string; tone: string; where: string | null } {
  if (event.type === 'expense') {
    const { icon, label } = categoryStyle(event.category)
    return { icon, kind: label, tone: 'bg-muted text-muted-foreground', where: null }
  }

  if (event.type === 'exception') {
    return { icon: TriangleAlert, kind: 'Exception', tone: 'bg-warning/15 text-warning', where: null }
  }

  if (event.movementType === 'TRANSFER') {
    return { icon: ArrowLeftRight, kind: 'Transfer', tone: 'bg-category-income/15 text-category-income', where: null }
  }

  if (event.movementType === 'OUT') {
    return {
      icon: ArrowUpRight,
      kind: 'Money out',
      tone: 'bg-muted text-muted-foreground',
      where: event.sourceChestName ? `From ${event.sourceChestName}` : null,
    }
  }

  return {
    icon: event.label === 'Daily saving' ? PiggyBank : ArrowDownLeft,
    kind: event.label === 'Daily saving' ? 'Saved' : 'Money in',
    tone: 'bg-success/15 text-success',
    where: event.destinationChestName ? `Into ${event.destinationChestName}` : null,
  }
}
