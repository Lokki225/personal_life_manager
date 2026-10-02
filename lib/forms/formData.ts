const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_DEPTH = 4
const MAX_INDEX = 99
const INDEX_PATTERN = /^\d+$/

type Node = Record<string, unknown> | unknown[]

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

function readChild(node: Node, segment: string): unknown {
  if (Array.isArray(node)) return node[Number(segment)]
  return Object.hasOwn(node, segment) ? node[segment] : undefined
}

function writeChild(node: Node, segment: string, value: unknown) {
  if (Array.isArray(node)) node[Number(segment)] = value
  else node[segment] = value
}

function isValidSegment(node: Node, segment: string): boolean {
  if (segment === '' || FORBIDDEN_KEYS.has(segment)) return false
  return Array.isArray(node) ? INDEX_PATTERN.test(segment) && Number(segment) <= MAX_INDEX : true
}

// "allocations.0.amount" becomes { allocations: [{ amount }] }.
// A digits-only segment is always a row index from 0 to 99, never an id or a
// year: name such fields with a prefix, e.g. "goals.g17.amount".
// Skipped: files, React's "$ACTION_" keys, malformed or unsafe paths, and
// entries that conflict with an earlier one. A repeated key keeps its last value.
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const root: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string' || key.startsWith('$ACTION_')) continue

    const segments = key.split('.')
    if (segments.length > MAX_DEPTH) continue

    setPath(root, segments, value)
  }

  return root
}

function setPath(root: Record<string, unknown>, segments: string[], value: string) {
  // Resolve the whole path before writing, so a rejected entry leaves no trace.
  const pending: { parent: Node; segment: string; child: Node }[] = []
  let node: Node = root

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    if (!isValidSegment(node, segment)) return

    const nextIsIndex = INDEX_PATTERN.test(segments[index + 1])
    const existing = readChild(node, segment)

    if (existing === undefined) {
      const child: Node = nextIsIndex ? [] : {}
      pending.push({ parent: node, segment, child })
      node = child
    } else if (isNode(existing) && Array.isArray(existing) === nextIsIndex) {
      node = existing
    } else {
      return
    }
  }

  const last = segments[segments.length - 1]
  if (!isValidSegment(node, last) || isNode(readChild(node, last))) return

  for (const { parent, segment, child } of pending) writeChild(parent, segment, child)
  writeChild(node, last, value)
}

// Flat string entries of a submission, echoed back on error.
export function formDataToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$ACTION_') && !FORBIDDEN_KEYS.has(key)) {
      values[key] = value
    }
  }

  return values
}
