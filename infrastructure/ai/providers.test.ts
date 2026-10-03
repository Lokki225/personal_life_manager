import { afterEach, describe, expect, it, vi } from 'vitest'

import { AiBusy } from './model'
import { fromChatReply, openAiCompatibleModel, simplifySchema, toChatMessages } from './openaiCompatible'
import { availableProviders, isAssistantConfigured, resolveProvider } from './providers'

describe('AI providers', () => {
  it('are available when their key is set, with their model', () => {
    const env = { OPENAI_API_KEY: 'sk-1', GEMINI_API_KEY: 'g-1', GEMINI_MODEL: 'gemini-pro' }

    expect(availableProviders(env)).toEqual([
      { id: 'openai', name: 'GPT', model: 'gpt-5' },
      { id: 'gemini', name: 'Gemini', model: 'gemini-pro' },
    ])
    expect(isAssistantConfigured({})).toBe(false)
    expect(availableProviders({ ANTHROPIC_API_KEY: 'a', ASSISTANT_MODEL: 'claude-haiku-4-5-20251001' })[0].model).toBe(
      'claude-haiku-4-5-20251001',
    )
  })

  it('follow the person’s choice, or fall back to the first with a key', () => {
    const env = { ANTHROPIC_API_KEY: 'a', DEEPSEEK_API_KEY: 'd' }

    expect(resolveProvider('deepseek', env)?.id).toBe('deepseek')
    expect(resolveProvider('openai', env)?.id).toBe('anthropic')
    expect(resolveProvider(null, env)?.id).toBe('anthropic')
    expect(resolveProvider('anthropic', {})).toBeNull()
  })
})

describe('OpenAI-compatible format', () => {
  it('turns a conversation with tools into chat messages', () => {
    expect(
      toChatMessages('Be brief.', [
        { role: 'user', content: 'I spent 1500' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Recording it.' },
            { type: 'tool_use', id: 'call-1', name: 'record_expense', input: { amount: 1500 } },
          ],
        },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1', content: 'Refused: no', is_error: true }] },
      ]),
    ).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'I spent 1500' },
      {
        role: 'assistant',
        content: 'Recording it.',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'record_expense', arguments: '{"amount":1500}' } }],
      },
      { role: 'tool', tool_call_id: 'call-1', content: 'Error: Refused: no' },
    ])
  })

  it('reads text and tool calls from a reply, even with broken arguments', () => {
    expect(
      fromChatReply({
        choices: [
          {
            message: {
              content: 'Let me check.',
              tool_calls: [
                { id: 'a', function: { name: 'get_today', arguments: '{}' } },
                { id: 'b', function: { name: 'record_expense', arguments: '{oops' } },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      { type: 'text', text: 'Let me check.' },
      { type: 'tool_use', id: 'a', name: 'get_today', input: {} },
      { type: 'tool_use', id: 'b', name: 'record_expense', input: {} },
    ])
    expect(fromChatReply({ choices: [{ message: { content: '  ' } }] })).toEqual([])
  })

  it('keeps only the schema keywords every provider accepts', () => {
    expect(
      simplifySchema({
        type: 'object',
        additionalProperties: false,
        properties: {
          amount: { type: 'number', exclusiveMinimum: 0, maximum: 10 },
          day: { type: 'string', pattern: '^\\d+$', description: 'A day.' },
          tags: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
        },
        required: ['amount'],
      }),
    ).toEqual({
      type: 'object',
      properties: {
        amount: { type: 'number', minimum: 0, maximum: 10 },
        day: { type: 'string', description: 'A day.' },
        tags: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
      },
      required: ['amount'],
    })
  })
})

describe('Gemini thought signatures', () => {
  it('are kept from a tool call and sent back with it', () => {
    const signature = { google: { thought_signature: 'sig-1' } }
    const [call] = fromChatReply({
      choices: [
        { message: { tool_calls: [{ id: 'a', function: { name: 'get_goals', arguments: '{}' }, extra_content: signature }] } },
      ],
    })

    expect(call).toEqual({ type: 'tool_use', id: 'a', name: 'get_goals', input: {}, echo: signature })
    expect(toChatMessages('', [{ role: 'assistant', content: [call] }])[1]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'a', type: 'function', function: { name: 'get_goals', arguments: '{}' }, extra_content: signature }],
    })
  })
})

describe('an overloaded provider', () => {
  afterEach(() => vi.unstubAllGlobals())

  const request = { system: 'Be brief.', messages: [{ role: 'user' as const, content: 'Hi' }], tools: [], maxTokens: 100 }
  const busy = () => new Response('{"error":{"message":"high demand"}}', { status: 503 })
  const answer = () => Response.json({ choices: [{ message: { content: 'Hello!' } }] })

  it('is tried again, and answers when it recovers', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(answer())
    const wait = vi.fn(async () => {})
    vi.stubGlobal('fetch', fetch)

    const ask = openAiCompatibleModel({ baseUrl: 'https://ai.example', apiKey: 'k', model: 'm', wait })

    await expect(ask(request)).resolves.toEqual({ content: [{ type: 'text', text: 'Hello!' }] })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledTimes(1)
  })

  it('is reported as busy after three attempts', async () => {
    const fetch = vi.fn().mockImplementation(async () => busy())
    vi.stubGlobal('fetch', fetch)

    const ask = openAiCompatibleModel({ baseUrl: 'https://ai.example', apiKey: 'k', model: 'm', wait: async () => {} })

    await expect(ask(request)).rejects.toBeInstanceOf(AiBusy)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
