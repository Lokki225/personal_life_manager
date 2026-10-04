import { m } from '@/lib/i18n/translate'

// The nodes of the app and their views. The switcher, the bottom tabs, the
// accent colour and the memory of the last page all read this list, so a node
// or a view is added here and nowhere else.

export type NodeId = 'finance' | 'personal' | 'career' | 'projection'

// Who can open a node: everyone, only administrators (while it is being
// built and tested on the live site), or nobody yet ("Coming soon").
export type NodeAccess = 'all' | 'admin' | 'none'

export type NodeIconName =
  | 'wallet'
  | 'user'
  | 'briefcase'
  | 'compass'
  | 'calendar-check'
  | 'piggy-bank'
  | 'chart'
  | 'target'
  | 'list-checks'
  | 'notebook'
  | 'layout'
  | 'folder'
  | 'sparkles'
  | 'lightbulb'
  | 'telescope'
  | 'calendar-range'
  | 'mail'

export type NodeView = {
  id: string
  label: string
  icon: NodeIconName
  // Where the tab leads.
  href: string
  // Other paths that belong to this view: the view is active on each of them
  // and on everything below them.
  matches: string[]
}

export type NodeDef = {
  id: NodeId
  label: string
  icon: NodeIconName
  defaultView: string
  // At most 5, in tab order, so the bottom tabs fit a phone.
  views: NodeView[]
  access: NodeAccess
}

const view = (id: string, label: string, icon: NodeIconName, href: string, matches: string[] = []): NodeView => ({
  id,
  label,
  icon,
  href,
  matches: [href, ...matches],
})

export const NODES: NodeDef[] = [
  {
    id: 'finance',
    label: m('Finance'),
    icon: 'wallet',
    defaultView: 'today',
    access: 'all',
    views: [
      view('savings', m('Savings'), 'piggy-bank', '/finance/chests', ['/finance/goals', '/finance/debts']),
      // Today is the finance home; /finance/today only redirects to it.
      view('today', m('Today'), 'calendar-check', '/finance', ['/finance/today']),
      view('review', m('Review'), 'chart', '/finance/review', ['/finance/history']),
    ],
  },
  {
    id: 'personal',
    label: m('Personal'),
    icon: 'user',
    defaultView: 'today',
    access: 'all',
    views: [
      view('today', m('Today'), 'calendar-check', '/personal/today'),
      view('goals', m('Goals'), 'target', '/personal/goals'),
      view('tasks', m('Tasks'), 'list-checks', '/personal/tasks'),
      view('journal', m('Journal'), 'notebook', '/personal/journal'),
      view('review', m('Review'), 'chart', '/personal/review'),
    ],
  },
  {
    id: 'career',
    label: m('Career'),
    icon: 'briefcase',
    defaultView: 'overview',
    access: 'none',
    views: [
      view('overview', m('Overview'), 'layout', '/career/overview'),
      view('projects', m('Projects'), 'folder', '/career/projects'),
      view('skills', m('Skills'), 'sparkles', '/career/skills'),
      view('review', m('Review'), 'chart', '/career/review'),
    ],
  },
  {
    id: 'projection',
    label: m('Projection'),
    icon: 'compass',
    defaultView: 'ideas',
    access: 'none',
    views: [
      view('ideas', m('Ideas'), 'lightbulb', '/projection/ideas'),
      view('vision', m('Vision'), 'telescope', '/projection/vision'),
      view('seasons', m('Seasons'), 'calendar-range', '/projection/seasons'),
      view('letters', m('Letters'), 'mail', '/projection/letters'),
    ],
  },
]

// The path part of a route, without its search params or hash.
const pathOf = (route: string) => route.split(/[?#]/, 1)[0]

// A view living at the node's root (Finance Today at /finance) only matches
// that exact path; any other view also matches the pages below it.
const isNodeRoot = (base: string) => base.lastIndexOf('/') === 0

const under = (path: string, base: string) =>
  path === base || (!isNodeRoot(base) && path.startsWith(`${base}/`))

export function getNode(id: NodeId): NodeDef {
  const node = NODES.find((n) => n.id === id)

  if (!node) {
    throw new Error(`Unknown node ${id}`)
  }

  return node
}

// The node a route belongs to, or null outside the nodes (account, admin…).
export function nodeFromPath(route: string): NodeDef | null {
  const path = pathOf(route)
  return NODES.find((n) => path === `/${n.id}` || path.startsWith(`/${n.id}/`)) ?? null
}

// The view of the node a route shows, or null on a page of the node that is
// not one of its views (Finance setup).
export function viewFromPath(node: NodeDef, route: string): NodeView | null {
  const path = pathOf(route)
  return node.views.find((v) => v.matches.some((base) => under(path, base))) ?? null
}

export function defaultRoute(node: NodeDef): string {
  const fallback = node.views.find((v) => v.id === node.defaultView) ?? node.views[0]
  return fallback.href
}

// Whether a node can be opened by this person.
export function canOpen(node: NodeDef, isAdmin: boolean): boolean {
  return node.access === 'all' || (node.access === 'admin' && isAdmin)
}

// The route a node reopens on: the one remembered for it if it still shows
// one of its views, otherwise its default view.
export function lastRouteOf(node: NodeDef, remembered: string | undefined): string {
  if (remembered && nodeFromPath(remembered)?.id === node.id && viewFromPath(node, remembered)) {
    return remembered
  }

  return defaultRoute(node)
}
