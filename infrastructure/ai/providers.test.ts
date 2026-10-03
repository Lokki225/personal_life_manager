import { describe, expect, it } from 'vitest'

import { fromChatReply, simplifySchema, toChatMessages } from './openaiCompatible'
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
