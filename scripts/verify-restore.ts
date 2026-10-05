import { readFileSync } from 'node:fs'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../app/generated/prisma/client'

// Restore drill check (docs/durability.md): counts the rows of every table in
// the source database and in the restored branch, side by side. Only reads.
//
//   SOURCE_DATABASE_URL=... RESTORED_DATABASE_URL=... npx tsx scripts/verify-restore.ts

const source = process.env.SOURCE_DATABASE_URL
const restored = process.env.RESTORED_DATABASE_URL

if (!source || !restored || source === restored) {
  console.error('Set SOURCE_DATABASE_URL and RESTORED_DATABASE_URL to two different databases.')
  process.exit(1)
}

const models = [...readFileSync('prisma/schema.prisma', 'utf8').matchAll(/^model (\w+) \{/gm)].map(([, name]) => name)
const client = (url: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
type Counter = Record<string, { count: () => Promise<number> }>

async function counts(db: PrismaClient) {
  const result: Record<string, number> = {}
  for (const name of models) {
    result[name] = await (db as unknown as Counter)[name[0].toLowerCase() + name.slice(1)].count()
  }
  return result
}

async function main() {
  const [a, b] = [client(source!), client(restored!)]
  try {
    const [before, after] = await Promise.all([counts(a), counts(b)])
    const rows = models.map((name) => ({ table: name, source: before[name], restored: after[name], same: before[name] === after[name] }))
    console.table(rows)
    const different = rows.filter((row) => !row.same)
    // Rows written after the restore point are expected to differ.
    console.log(different.length === 0 ? 'Every table matches.' : `${different.length} table(s) differ: check they were written after the restore point.`)
  } finally {
    await Promise.all([a.$disconnect(), b.$disconnect()])
  }
}

main()
