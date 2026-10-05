import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Patterns that open the door to injection, checked in all the app's code
// (test plan §8). Any new use has to be added here on purpose, with a reason.

const FOLDERS = ['app', 'application', 'domain', 'infrastructure', 'lib', 'components']

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const files = FOLDERS.flatMap(sourceFiles).map((path) => ({ path: path.replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }))

const uses = (pattern: RegExp) => files.filter((file) => pattern.test(file.text)).map((file) => file.path)

describe('the code never renders text as HTML or runs text as code', () => {
  it('uses dangerouslySetInnerHTML only for the fixed theme script', () => {
    expect(uses(/dangerouslySetInnerHTML/)).toEqual(['app/layout.tsx'])
  })

  it('never writes innerHTML or outerHTML', () => {
    expect(uses(/\.(inner|outer)HTML\s*=/)).toEqual([])
  })

  it('never evaluates strings', () => {
    expect(uses(/\beval\(|new Function\(/)).toEqual([])
  })
})

describe('the code never builds SQL from text', () => {
  it('has no unsafe raw queries', () => {
    expect(uses(/\$(query|execute)RawUnsafe/)).toEqual([])
  })

  it('has no raw queries at all outside the repositories', () => {
    expect(uses(/\$(query|execute)Raw\b/).filter((path) => !path.startsWith('infrastructure/repositories/'))).toEqual([])
  })
})

describe('every write is limited', () => {
  it('checks the write limit in every server action file of the nodes', () => {
    const actions = files.filter((file) => /^app\/\(shell\)\/.*actions\.ts$/.test(file.path))
    expect(actions.length).toBeGreaterThan(10)
    expect(actions.filter((file) => !/writesAllowed\(/.test(file.text)).map((file) => file.path)).toEqual([])
  })
})
