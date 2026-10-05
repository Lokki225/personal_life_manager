// The Personal journal: entry kinds, links written into the text, and the
// small rules around them. No database.

// CAREER_LOG lines are written from Career, and read here with the rest.
export const JOURNAL_TYPES = ['FREE', 'DAILY', 'DECISION', 'IDEA', 'REVIEW', 'CAREER_LOG'] as const
export type JournalType = (typeof JOURNAL_TYPES)[number]

// The kinds a person writes by hand; reviews are written from the review page.
export const WRITABLE_TYPES = ['FREE', 'DAILY', 'DECISION', 'IDEA'] as const

export const LINK_TARGETS = ['goal', 'task'] as const
export type LinkTarget = (typeof LINK_TARGETS)[number]

export type JournalLink = { targetType: LinkTarget; targetId: string; label: string }

export const MAX_BODY = 10_000
export const MAX_TITLE = 80
export const MIN_PASSWORD = 4

// A link is written in the text as @[Label](goal:id), so it reads well even
// as plain text and survives copy and paste.
const LINK = /@\[([^\]\n]{1,80})\]\((goal|task):([A-Za-z0-9_-]{1,40})\)/g

export const linkToken = (link: JournalLink) => `@[${link.label.replace(/[\[\]\n]/g, ' ').trim()}](${link.targetType}:${link.targetId})`

// The links in an entry's text, each once.
export function parseLinks(body: string): JournalLink[] {
  const seen = new Set<string>()
  const links: JournalLink[] = []

  for (const match of body.matchAll(LINK)) {
    const key = `${match[2]}:${match[3]}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ targetType: match[2] as LinkTarget, targetId: match[3], label: match[1] })
  }

  return links
}

export type BodyPart = { kind: 'text'; text: string } | { kind: 'link'; link: JournalLink }

// Splits an entry's text into plain text and links, to draw links as chips.
export function splitBody(body: string): BodyPart[] {
  const parts: BodyPart[] = []
  let last = 0

  for (const match of body.matchAll(LINK)) {
    if (match.index > last) parts.push({ kind: 'text', text: body.slice(last, match.index) })
    parts.push({ kind: 'link', link: { targetType: match[2] as LinkTarget, targetId: match[3], label: match[1] } })
    last = match.index + match[0].length
  }

  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) })
  return parts
}

// The text with links shown as their labels, for previews.
export const plainText = (body: string) => body.replace(LINK, (_match, label: string) => label)

// A short preview of an entry.
export function excerpt(body: string, length = 140): string {
  const text = plainText(body).replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text
}

// Mood and energy are 1 to 5, or not given.
export const isScale = (value: number | null | undefined): boolean => value == null || (Number.isInteger(value) && value >= 1 && value <= 5)
