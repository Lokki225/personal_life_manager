import { z } from 'zod'

import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'

// The actions that can be captured offline (Ressources/offline-mode-codebase-plan.md),
// with the shape of what each one carries. The device checks a payload before
// queueing it and the server checks it again before running it.

const amount = z.number().positive().max(999_999_999_999)
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
const id = z.string().trim().min(1).max(64)

export const OFFLINE_ACTIONS = {
  'finance.addExpense': z.object({
    amount,
    category: z.enum(EXPENSE_CATEGORIES),
    description: optionalText(80),
    cause: z.enum(EXCEPTION_CATEGORIES).nullable().optional(),
    reason: optionalText(160),
    chestId: id.nullable().optional(),
  }),
  'finance.saveRemaining': z.object({
    amount,
    destinationChestId: id.nullable().optional(),
  }),
  'finance.recordException': z.object({
    category: z.enum(EXCEPTION_CATEGORIES),
    reason: optionalText(160),
  }),
} as const

export type OfflineAction = keyof typeof OFFLINE_ACTIONS
export type OfflinePayload<A extends OfflineAction> = z.output<(typeof OFFLINE_ACTIONS)[A]>

export const isOfflineAction = (value: string): value is OfflineAction => value in OFFLINE_ACTIONS

// What the device sends to /api/sync, and what it gets back for each item.
export const syncRequestSchema = z.object({
  items: z
    .array(
      z.object({
        id: id,
        action: z.string().max(64),
        payload: z.unknown(),
        // An instant, as the device's clock gave it (ISO 8601).
        occurredAt: z.string().max(40),
      }),
    )
    .max(100),
})

export type SyncResult =
  | { id: string; status: 'synced' }
  | { id: string; status: 'rejected'; error: string }
  // Something went wrong on the server: the device tries again later.
  | { id: string; status: 'failed' }
