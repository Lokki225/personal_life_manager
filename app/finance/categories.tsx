import {
  ArrowLeftRight,
  Bus,
  CircleEllipsis,
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

export const EVENT_ICONS: Record<'expense' | 'exception' | 'movement', LucideIcon> = {
  expense: ReceiptText,
  exception: TriangleAlert,
  movement: ArrowLeftRight,
}
