import { describe, expect, it } from 'vitest'

import { chestBalance } from './chests'

describe('chestBalance', () => {
  const movements = [
    { sourceChestId: null, destinationChestId: 'buffer', amount: 800 },
    { sourceChestId: null, destinationChestId: 'buffer', amount: 200 },
    { sourceChestId: 'buffer', destinationChestId: 'base', amount: 300 },
    { sourceChestId: 'base', destinationChestId: null, amount: 100 },
    { sourceChestId: null, destinationChestId: null, amount: 999 },
  ]

  it('adds what comes in and subtracts what goes out', () => {
    expect(chestBalance('buffer', movements)).toBe(700)
    expect(chestBalance('base', movements)).toBe(200)
  })

  it('is zero for a chest with no movement, and ignores movements linked to no chest', () => {
    expect(chestBalance('headphones', movements)).toBe(0)
    expect(chestBalance('buffer', [])).toBe(0)
  })

  it('keeps money constant across a transfer', () => {
    const before = chestBalance('buffer', movements.slice(0, 2)) + chestBalance('base', movements.slice(0, 2))
    const after = chestBalance('buffer', movements.slice(0, 3)) + chestBalance('base', movements.slice(0, 3))

    expect(after).toBe(before)
  })
})
