import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The offline layer's security checks (security test plan §10), read from the
// code: what the device keeps, for whom, and what it forgets at sign-out.

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const files = ['app', 'components', 'lib'].flatMap(sourceFiles).map((path) => ({ path: path.replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }))
const uses = (pattern: RegExp) => files.filter((file) => pattern.test(file.text)).map((file) => file.path).sort()
const read = (path: string) => readFileSync(path, 'utf8')

describe('what the device keeps', () => {
  it('saves read-only copies of the four offline screens only, none of them the journal', () => {
    expect(uses(/<SaveSnapshot\b/)).toEqual([
      'app/(shell)/finance/page.tsx',
      'app/(shell)/finance/review/page.tsx',
      'app/(shell)/personal/review/page.tsx',
      'app/(shell)/personal/today/page.tsx',
    ])
  })

  it('keeps drafts of capture forms only, never of the journal, and never a password', () => {
    expect(uses(/draftKey=/).filter((path) => path.includes('/journal/'))).toEqual([])
    expect(read('lib/offline/drafts.ts')).toMatch(/passwords\.has\(name\)/)
  })

  it('keeps the outbox, drafts and copies per person', () => {
    const db = read('lib/offline/db.ts')
    expect(db).toMatch(/drafts: '\[userId\+formId\]'/)
    expect(read('lib/offline/outbox.ts')).toMatch(/where\('userId'\)\.equals\(userId\)/)
  })
})

describe('what the service worker caches', () => {
  const worker = read('app/sw.ts')

  it('caches only the app’s own files and icons, never a page or an answer', () => {
    expect(worker.match(/new CacheFirst\(/g)).toHaveLength(2)
    expect(worker).not.toMatch(/NetworkFirst|StaleWhileRevalidate/)
    expect(worker).toMatch(/request\.mode === 'navigate',\s*handler: new NetworkOnly\(\)/)
  })
})

describe('signing out', () => {
  it('always goes through the sign-out that clears the device', () => {
    expect(uses(/\bsignOut\b.*from 'next-auth\/react'|import \{[^}]*\bsignOut\b[^}]*\} from 'next-auth\/react'/)).toEqual(['lib/offline/sign-out.ts'])
    expect(read('lib/offline/sign-out.ts')).toMatch(/await clearDevice\(\)[\s\S]*await signOut\(/)
  })
})
