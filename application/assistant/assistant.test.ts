import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { FinanceRuleError } from '../../domain/finance/errors'
import type { ModelReply, ModelRequest } from '../../infrastructure/ai/model'
import { operation } from '../api/operation'
import { askAssistant, ASSISTANT_DAILY_LIMIT, MAX_TURNS, trimConversation } from './chat'
import { converse } from './converse'
import { noteKindFor, sendAssistantNotes } from './notes'
import { chatOperations, runTool, toolsFrom } from './tools'

const user = {
  id: 'user-1',
  email: 'awa@example.com',
  firstName: 'Awa',
  lastName: 'Koné',
  username: null,
  locale: 'fr',
  timeZone: 'Africa/Abidjan',
  settledThrough: null,
  bufferSweepDay: 0,
}

const getToday = operation({
  name: 'get_today',
  method: 'GET',
  path: '/finance/today',
  needs: 'READ',
  does: 'Today.',
  input: z.object({}),
  run: vi.fn(async () => ({ left: 2500 })),
})

const recordExpense = operation({
  name: 'record_expense',
  method: 'POST',
  path: '/finance/expenses',
  needs: 'WRITE',
  does: 'Records an expense.',
  input: z.object({ amount: z.number().positive() }),
  run: vi.fn(async () => ({ left: 1000 })),
})

const refusing = operation({
  name: 'cover_overspend',
  method: 'POST',
  path: '/finance/today/cover',
  needs: 'WRITE',
  does: 'Covers.',
  input: z.object({}),
  run: async () => {
    throw new FinanceRuleError('The Buffer is empty.')
  },
})

const tools = [getToday, recordExpense, refusing]

// A model that plays back the given replies, one per call.
function scriptedModel(...replies: ModelReply['content'][]) {
  const requests: ModelRequest[] = []
  const ask = vi.fn(async (request: ModelRequest) => {
    requests.push(structuredClone(request))
    return { content: replies.shift() ?? [{ type: 'text' as const, text: 'Done.' }] }
  })

  return { ask, requests }
}

describe('assistant tools', () => {
  it('are the API operations, without notifying the person who is chatting', () => {
    const names = chatOperations.map((tool) => tool.name)

    expect(names).toContain('record_expense')
    expect(names).toContain('get_review')
    expect(names).not.toContain('send_notification')
  })

  it('describe their input as JSON schema and say when they change data', () => {
    const [read, write] = toolsFrom([getToday, recordExpense])

    expect(read.input_schema).toMatchObject({ type: 'object' })
    expect(read.input_schema).not.toHaveProperty('$schema')
    expect(write.description).toMatch(/Changes the person's data/)
    expect(read.description).not.toMatch(/Changes/)
  })

  it('run as the person and report a change', async () => {
    await expect(runTool(user, tools, 'record_expense', { amount: 1500 })).resolves.toEqual({
      content: '{"left":1000}',
      isError: false,
      changed: true,
    })
    expect(recordExpense.run).toHaveBeenCalledWith(user, { amount: 1500 })
  })

  it('explain bad input, refusals and unknown tools to the model', async () => {
    await expect(runTool(user, tools, 'record_expense', { amount: -5 })).resolves.toMatchObject({
      isError: true,
      changed: false,
      content: expect.stringContaining('"amount"'),
    })
    await expect(runTool(user, tools, 'cover_overspend', {})).resolves.toMatchObject({
      isError: true,
      content: 'Refused: The Buffer is empty.',
    })
    await expect(runTool(user, tools, 'drop_tables', {})).resolves.toMatchObject({ isError: true })
  })
})

describe('converse', () => {
  const now = new Date(2026, 9, 3, 20, 15)

  it('lets the model use tools until it answers, and says whether something changed', async () => {
    const { ask, requests } = scriptedModel(
      [{ type: 'tool_use', id: 'call-1', name: 'record_expense', input: { amount: 1500 } }],
      [{ type: 'text', text: "C'est noté : 1 500 XOF pour le déjeuner." }],
    )

    const result = await converse(user, [{ role: 'user', text: "J'ai dépensé 1500 pour le déjeuner" }], { ask, operations: tools }, now)

    expect(result).toEqual({ reply: "C'est noté : 1 500 XOF pour le déjeuner.", changed: true })
    expect(ask).toHaveBeenCalledTimes(2)
    expect(requests[0].system).toContain('Awa Koné')
    expect(requests[0].system).toContain('French')
    expect(requests[0].tools.map((tool) => tool.name)).toEqual(['get_today', 'record_expense', 'cover_overspend'])
    expect(requests[1].messages.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'call-1', content: '{"left":1000}', is_error: false }],
    })
  })

  it('does not count a reading as a change', async () => {
    const { ask } = scriptedModel([{ type: 'tool_use', id: 'call-1', name: 'get_today', input: {} }], [
      { type: 'text', text: 'Il vous reste 2 500 XOF.' },
    ])

    await expect(converse(user, [{ role: 'user', text: 'Combien me reste-t-il ?' }], { ask, operations: tools }, now)).resolves.toEqual({
      reply: 'Il vous reste 2 500 XOF.',
      changed: false,
    })
  })

  it('stops a model that never answers', async () => {
    const ask = vi.fn(async () => ({
      content: [{ type: 'tool_use' as const, id: 'again', name: 'get_today', input: {} }],
    }))

    await expect(converse(user, [{ role: 'user', text: 'Hello' }], { ask, operations: tools }, now)).resolves.toEqual({
      reply: null,
      changed: false,
    })
    expect(ask).toHaveBeenCalledTimes(10)
  })
})

describe('askAssistant', () => {
  it('keeps the latest turns, starting with the person', () => {
    const long = Array.from({ length: 30 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      text: `turn ${index}`,
    }))
    const trimmed = trimConversation([...long, { role: 'user', text: '  latest  ' }])

    expect(trimmed.length).toBeLessThanOrEqual(MAX_TURNS)
    expect(trimmed[0].role).toBe('user')
    expect(trimmed.at(-1)).toEqual({ role: 'user', text: 'latest' })
  })

  it('answers within the daily limit, and refuses beyond it', async () => {
    const converseMock = vi.fn().mockResolvedValue({ reply: 'Bonjour !', changed: false })
    const allowAttempt = vi.fn().mockResolvedValue(true)
    const ask = vi.fn()
    const persona = { name: 'Koffi', role: 'Be a coach.', personal: null }
    const deps = { security: { allowAttempt }, converse: converseMock, contextOf: vi.fn().mockResolvedValue({ ask, persona }) }

    await expect(askAssistant(user, [{ role: 'user', text: 'Bonjour' }], deps)).resolves.toEqual({
      reply: 'Bonjour !',
      changed: false,
    })
    expect(allowAttempt).toHaveBeenCalledWith('assistant:user-1', ASSISTANT_DAILY_LIMIT, 24 * 60 * 60 * 1000)
    expect(converseMock).toHaveBeenCalledWith(user, [{ role: 'user', text: 'Bonjour' }], {
      ask,
      persona,
      operations: chatOperations,
    })

    allowAttempt.mockResolvedValue(false)
    await expect(askAssistant(user, [{ role: 'user', text: 'Encore' }], deps)).rejects.toThrow(/for today/)
  })

  it('needs something to answer', async () => {
    const deps = { security: { allowAttempt: vi.fn() }, converse: vi.fn(), contextOf: vi.fn() }

    await expect(askAssistant(user, [{ role: 'user', text: '   ' }], deps)).rejects.toThrow('Write a message first.')
    expect(deps.security.allowAttempt).not.toHaveBeenCalled()
  })
})

describe('assistant notes', () => {
  it('reviews the month on its last day, the week on Sundays, the day otherwise', () => {
    expect(noteKindFor(new Date(2026, 9, 31, 19))).toBe('monthly')
    expect(noteKindFor(new Date(2026, 1, 28, 19))).toBe('monthly')
    expect(noteKindFor(new Date(2026, 9, 4, 19))).toBe('weekly')
    expect(noteKindFor(new Date(2026, 9, 3, 19))).toBe('daily')
  })

  const recipient = {
    ...user,
    assistantProvider: 'deepseek',
    assistantName: 'Nana',
    assistantInstructions: 'Parle-moi simplement.',
    subscriptions: [{ endpoint: 'https://push.example/1', p256dh: 'key', auth: 'auth' }],
  }
  const app = { name: 'Koffi', role: 'Be a coach.', isDefault: false, personalAllowed: true }
  const note = { kind: 'daily' as const, title: 'Belle journée', summary: 'Vous êtes sous le budget.', details: 'Le détail.' }

  it('writes, keeps and sends a note to each person who asked for one', async () => {
    const deps = {
      configured: () => true,
      repository: {
        listNoteRecipients: vi.fn().mockResolvedValue([recipient]),
        addNote: vi.fn(),
        pruneNotes: vi.fn(),
      },
      write: vi.fn().mockResolvedValue(note),
      modelFor: vi.fn().mockReturnValue('deepseek model'),
      appPersona: vi.fn().mockResolvedValue(app),
      notify: vi.fn().mockResolvedValue(1),
    }

    const result = await sendAssistantNotes(deps)

    expect(result.written).toBe(1)
    expect([...result.notified]).toEqual(['user-1'])
    expect(deps.modelFor).toHaveBeenCalledWith('deepseek')
    expect(deps.write).toHaveBeenCalledWith(recipient, expect.any(String), expect.any(Date), 'deepseek model', {
      name: 'Nana',
      role: 'Be a coach.',
      personal: 'Parle-moi simplement.',
    })
    expect(deps.repository.addNote).toHaveBeenCalledWith('user-1', { kind: 'daily', title: 'Belle journée', body: 'Le détail.' })
    expect(deps.notify).toHaveBeenCalledWith(recipient.subscriptions, {
      title: 'Belle journée',
      body: 'Vous êtes sous le budget.',
      url: '/finance?assistant=notes',
    })
  })

  it('does nothing without an AI key, and carries on past one failure', async () => {
    const listNoteRecipients = vi.fn().mockResolvedValue([recipient, { ...recipient, id: 'user-2' }])
    const repository = { listNoteRecipients, addNote: vi.fn(), pruneNotes: vi.fn() }
    const write = vi.fn().mockRejectedValueOnce(new Error('model down')).mockResolvedValue(note)
    const notify = vi.fn().mockResolvedValue(0)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const modelFor = vi.fn()
    const appPersona = vi.fn().mockResolvedValue(app)

    await expect(sendAssistantNotes({ configured: () => false, repository, write, modelFor, appPersona, notify })).resolves.toMatchObject({
      written: 0,
    })
    expect(listNoteRecipients).not.toHaveBeenCalled()

    const result = await sendAssistantNotes({ configured: () => true, repository, write, modelFor, appPersona, notify })

    expect(result.written).toBe(1)
    expect(result.notified.size).toBe(0)
  })
})
