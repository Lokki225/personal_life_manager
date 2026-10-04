import {
  Briefcase,
  CalendarCheck,
  CalendarRange,
  ChartNoAxesColumn,
  Compass,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Mail,
  NotebookPen,
  PiggyBank,
  Sparkles,
  Target,
  Telescope,
  UserRound,
  Wallet,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

import type { NodeIconName } from '@/lib/nav/registry'

const ICONS: Record<NodeIconName, LucideIcon> = {
  wallet: Wallet,
  user: UserRound,
  briefcase: Briefcase,
  compass: Compass,
  'calendar-check': CalendarCheck,
  'piggy-bank': PiggyBank,
  chart: ChartNoAxesColumn,
  target: Target,
  'list-checks': ListChecks,
  notebook: NotebookPen,
  layout: LayoutDashboard,
  folder: FolderKanban,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  telescope: Telescope,
  'calendar-range': CalendarRange,
  mail: Mail,
}

export function NodeIcon({ name, ...props }: { name: NodeIconName } & LucideProps) {
  const Icon = ICONS[name]
  return <Icon aria-hidden="true" {...props} />
}
