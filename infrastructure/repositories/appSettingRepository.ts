import { prisma } from '../prisma/client'

// Settings of the whole app, changed by administrators. Text by key.
export interface AppSettingRepository {
  // The values of those keys that are set.
  getMany: (keys: string[]) => Promise<Record<string, string>>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
}

export const appSettingRepository: AppSettingRepository = {
  getMany: async (keys) => {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } })

    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  },

  set: async (key, value) => {
    await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
  },

  remove: async (key) => {
    await prisma.appSetting.deleteMany({ where: { key } })
  },
}
