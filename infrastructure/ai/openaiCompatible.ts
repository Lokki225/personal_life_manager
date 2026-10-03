import {
  AiModelUnavailable,
  AiOutOfCredit,
  type AskModel,
  type ModelMessage,
  type ModelRequest,
  type ModelTool,
  type TextBlock,
  type ToolUseBlock,
} from './model'

// Every provider that speaks OpenAI's "chat completions" format: OpenAI
// itself, DeepSeek, Gemini. Plain HTTP, no SDK.

type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
    }
  | { role: 'tool'; tool_call_id: string; content: string }

// The keywords every provider accepts. Some reject the rest (Gemini refuses
// "additionalProperties", for one); the input is checked again on our side anyway.
const KEPT = new Set(['type', 'description', 'enum', 'required', 'minimum', 'maximum', 'default', 'minItems', 'maxItems'])

export function simplifySchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(simplifySchema)
  }

  if (typeof schema !== 'object' || schema === null) {
    return schema
  }

  const source = schema as Record<string, unknown>
  const simple: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (KEPT.has(key)) {
      simple[key] = value
    } else if (key === 'properties' && typeof value === 'object' && value !== null) {
      simple.properties = Object.fromEntries(Object.entries(value).map(([name, field]) => [name, simplifySchema(field)]))
    } else if (key === 'items') {
      simple.items = simplifySchema(value)
    } else if (key === 'exclusiveMinimum' && typeof value === 'number' && !('minimum' in source)) {
      simple.minimum = value
    }
  }

  return simple
}

export function toChatMessages(system: string, messages: ModelMessage[]): ChatMessage[] {
  const chat: ChatMessage[] = [{ role: 'system', content: system }]

  for (const message of messages) {
    if (message.role === 'user') {
      if (typeof message.content === 'string') {
        chat.push({ role: 'user', content: message.content })
      } else {
        for (const result of message.content) {
          chat.push({
            role: 'tool',
            tool_call_id: result.tool_use_id,
            content: result.is_error ? `Error: ${result.content}` : result.content,
          })
        }
      }
      continue
    }

    const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n')
    const calls = message.content.flatMap((block) =>
      block.type === 'tool_use'
        ? [{ id: block.id, type: 'function' as const, function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) } }]
        : [],
    )

    chat.push({ role: 'assistant', content: text || null, ...(calls.length > 0 ? { tool_calls: calls } : {}) })
  }

  return chat
}

const toChatTools = (tools: ModelTool[]) =>
  tools.map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: simplifySchema(tool.input_schema) },
  }))

type ChatReply = {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: { id: string; function: { name: string; arguments?: string } }[]
    }
  }[]
}

export function fromChatReply(reply: ChatReply): (TextBlock | ToolUseBlock)[] {
  const message = reply.choices?.[0]?.message
  const blocks: (TextBlock | ToolUseBlock)[] = []

  if (message?.content?.trim()) {
    blocks.push({ type: 'text', text: message.content })
  }

  for (const call of message?.tool_calls ?? []) {
    let input: unknown = {}

    try {
      input = JSON.parse(call.function.arguments || '{}')
    } catch {
      // Unreadable arguments: the tool will say what is missing.
    }

    blocks.push({ type: 'tool_use', id: call.id, name: call.function.name, input })
  }

  return blocks
}

// What a provider answers when its account has run dry.
const OUT_OF_CREDIT = /insufficient_quota|insufficient balance|credit balance|billing|exceeded your current quota/i

export function openAiCompatibleModel(options: {
  baseUrl: string
  apiKey: string
  model: string
  // OpenAI's newer models want "max_completion_tokens"; the others "max_tokens".
  tokensField?: 'max_tokens' | 'max_completion_tokens'
}): AskModel {
  return async (request: ModelRequest) => {
    const response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
      body: JSON.stringify({
        model: options.model,
        [options.tokensField ?? 'max_tokens']: request.maxTokens,
        messages: toChatMessages(request.system, request.messages),
        tools: toChatTools(request.tools),
        ...(request.forceTool ? { tool_choice: { type: 'function', function: { name: request.forceTool } } } : {}),
      }),
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)

      if (response.status === 402 || OUT_OF_CREDIT.test(detail)) {
        throw new AiOutOfCredit(detail)
      }

      if (response.status === 404 || /model[^"]*(not found|no longer available|does not exist)/i.test(detail)) {
        throw new AiModelUnavailable(detail)
      }

      throw new Error(`${options.baseUrl} answered ${response.status}: ${detail}`)
    }

    return { content: fromChatReply((await response.json()) as ChatReply) }
  }
}
