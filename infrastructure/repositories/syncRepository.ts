import { prisma } from '../prisma/client'

// Outside accounts that fill a measure (chess.com first), and their syncs.

const CONNECTOR_SELECT = {
  id: true,
  userId: true,
  provider: true,
  accountRef: true,
  config: true,
  lastSyncedAt: true,
  lastError: true,
  user: { select: { timeZone: true } },
  series: {
    select: { id: true, entries: { orderBy: { recordedAt: 'desc' as const }, take: 1, select: { value: true } } },
  },
} as const

type ConnectorRow = Awaited<ReturnType<typeof findConnectors>>[number]

const findConnectors = (where: object) => prisma.syncConnector.findMany({ where, select: CONNECTOR_SELECT })

const toConnector = (row: ConnectorRow) => ({
  id: row.id,
  userId: row.userId,
  provider: row.provider,
  accountRef: row.accountRef,
  timeControl: (row.config as { timeControl?: string }).timeControl ?? 'rapid',
  lastSyncedAt: row.lastSyncedAt,
  lastError: row.lastError,
  timeZone: row.user.timeZone,
  seriesId: row.series[0]?.id ?? null,
  latest: row.series[0]?.entries[0] ? Number(row.series[0].entries[0].value) : null,
})

export type Connector = ReturnType<typeof toConnector>

export const syncRepository = {
  // The connector and its measure, with the first value, all together.
  createConnector: async (
    userId: string,
    data: { provider: string; accountRef: string; timeControl: string; series: { key: string; label: string }; first: { value: number; at: Date } },
  ) => {
    return prisma.$transaction(async (tx) => {
      const connector = await tx.syncConnector.create({
        data: { userId, provider: data.provider, accountRef: data.accountRef, config: { timeControl: data.timeControl } },
        select: { id: true },
      })
      const series = await tx.metricSeries.create({
        data: { userId, key: data.series.key, label: data.series.label, provider: 'SYNC', connectorId: connector.id },
        select: { id: true, unit: true },
      })
      await tx.metricEntry.create({ data: { seriesId: series.id, value: data.first.value, recordedAt: data.first.at, source: data.provider } })
      await tx.syncConnector.update({ where: { id: connector.id }, data: { lastSyncedAt: data.first.at } })
      return { connectorId: connector.id, seriesId: series.id, unit: series.unit }
    })
  },

  listAll: async () => (await findConnectors({})).map(toConnector),

  forSeries: async (userId: string, seriesId: string) => {
    const [row] = await findConnectors({ userId, series: { some: { id: seriesId } } })
    return row ? toConnector(row) : null
  },

  // A sync that worked, with the new value when the rating moved.
  recordSuccess: async (connectorId: string, at: Date, entry: { seriesId: string; value: number; source: string } | null) => {
    await prisma.$transaction([
      ...(entry ? [prisma.metricEntry.create({ data: { seriesId: entry.seriesId, value: entry.value, recordedAt: at, source: entry.source } })] : []),
      prisma.syncConnector.update({ where: { id: connectorId }, data: { lastSyncedAt: at, lastError: null } }),
    ])
  },

  recordFailure: async (connectorId: string, message: string) => {
    await prisma.syncConnector.update({ where: { id: connectorId }, data: { lastError: message.slice(0, 200) } })
  },
}

export type SyncRepository = typeof syncRepository
