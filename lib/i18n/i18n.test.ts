import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { pickLocale } from './config'
import { FR } from './fr'
import { createTranslator } from './translate'

describe('pickLocale', () => {
  it('uses the chosen language first, then the browser, then English', () => {
    expect(pickLocale('fr', 'en-GB,en;q=0.9')).toBe('fr')
    expect(pickLocale(undefined, 'fr-CI,fr;q=0.9,en;q=0.8')).toBe('fr')
    expect(pickLocale(undefined, 'de-DE,en;q=0.8,fr;q=0.5')).toBe('en')
    expect(pickLocale('es', 'es-ES')).toBe('en')
    expect(pickLocale(null, null)).toBe('en')
  })
})

describe('createTranslator', () => {
  const en = createTranslator('en')
  const fr = createTranslator('fr')

  it('leaves English as written and fills in the placeholders', () => {
    expect(en('Save {amount}', { amount: 60000 })).toBe('Save 60,000')
    expect(en('Something nobody translated')).toBe('Something nobody translated')
    expect(en.amount(1234567.8)).toBe('1,234,568')
  })

  it('translates, and writes amounts the French way', () => {
    expect(fr('Sign in')).toBe('Se connecter')
    expect(fr('Save {amount}', { amount: 60000 })).toBe(`Épargner ${fr.amount(60000)}`)
    expect(fr.amount(60000)).toMatch(/^60\s000$/)
    expect(fr('Something nobody translated')).toBe('Something nobody translated')
  })

  it('translates a built-in name given as a value, and keeps a person’s own words', () => {
    expect(fr('Into {chest}', { chest: 'Buffer' })).toBe('Vers Réserve')
    expect(fr('Into {chest}', { chest: 'Vacances de Awa' })).toBe('Vers Vacances de Awa')
  })

  it('counts zero as singular in French and plural in English', () => {
    const one = '{count} project.'
    const other = '{count} projects.'

    expect(en.plural(0, one, other)).toBe('0 projects.')
    expect(en.plural(1, one, other)).toBe('1 project.')
    expect(fr.plural(0, one, other)).toBe('0 projet.')
    expect(fr.plural(2, one, other)).toBe('2 projets.')
  })

  it('translates text that arrives already filled in', () => {
    expect(fr('Base Chest only holds 40,000.')).toBe(`Coffre principal ne contient que ${fr.amount(40000)}.`)
    expect(fr('Keep it under 30 characters.')).toBe('30 caractères au maximum.')
    expect(fr('Transfer: Buffer → Base Chest')).toBe('Transfert : Réserve → Coffre principal')
    expect(fr('Exception: food')).toBe('Imprévu : alimentation')
    expect(fr('Borrowed from Awa')).toBe('Emprunté à Awa')
    expect(fr('Repaid by Awa')).toBe('Remboursé par Awa')
  })
})

// --- Every text the code shows has a French version --------------------------

const SOURCE_FOLDERS = ['app', 'application', 'domain', 'lib', 'components']
const STRING = /\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")\s*,?/y

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)

    if (statSync(path).isDirectory()) {
      return name === 'generated' ? [] : sourceFiles(path)
    }

    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !path.endsWith(join('i18n', 'fr.ts')) ? [path] : []
  })
}

// The string literals that follow position `start`, up to `count` of them.
function stringsAt(text: string, start: number, count: number): string[] {
  const found: string[] = []
  let position = start

  for (let index = 0; index < count; index += 1) {
    STRING.lastIndex = position
    const match = STRING.exec(text)

    if (!match) {
      break
    }

    found.push((match[1] ?? match[2]).replace(/\\(['"])/g, '$1'))
    position = STRING.lastIndex
  }

  return found
}

function textsToTranslate(): Set<string> {
  const texts = new Set<string>()

  for (const path of SOURCE_FOLDERS.flatMap(sourceFiles)) {
    const text = readFileSync(path, 'utf8')
    const collect = (pattern: RegExp, count: number) => {
      for (const match of text.matchAll(pattern)) {
        stringsAt(text, match.index + match[0].length, count).forEach((value) => texts.add(value))
      }
    }

    // t('...'), m('...'), translate('...') and the two wordings of t.plural(count, '...', '...').
    collect(/(?<![\w.])(?:t|m|translate)\(/g, 1)
    collect(/(?<![\w.])t\.plural\(\s*[^,]+,/g, 2)
    // Rule messages written out in full.
    collect(/new (?:Finance|Account|Personal|Career)RuleError\(/g, 1)

    // Validation messages: the sentences in form schemas.
    if (/(schema|fields|registerUser)\.ts$/.test(path)) {
      for (const match of text.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
        const value = match[1] ?? match[2]

        if (value.includes(' ') && value.endsWith('.')) {
          texts.add(value)
        }
      }
    }
  }

  texts.delete('')

  return texts
}

describe('French dictionary', () => {
  it('has a translation for every text the code shows', () => {
    const fr = createTranslator('fr')
    // A text is covered when it is in the dictionary or matched by a pattern.
    // English and French can also simply be the same word.
    const sameInBothLanguages = new Set(['Budget', 'Transport', 'Source', 'Type', 'Administration'])
    const missing = [...textsToTranslate()].filter(
      (text) => !(text in FR.exact) && fr(text) === text && !sameInBothLanguages.has(text),
    )

    expect(missing).toEqual([])
  })

  it('keeps the placeholders of each text', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort()
    const broken = Object.entries(FR.exact).filter(
      ([english, french]) => placeholders(english).join() !== placeholders(french).join(),
    )

    expect(broken).toEqual([])
  })
})
