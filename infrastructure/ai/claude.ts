import Anthropic from '@anthropic-ai/sdk'

// The language model behind the assistant: Claude, through Anthropic's API.
// The rest of the app only sees the small shapes below, so the model can be
// replaced in tests or swapped for another.

export type TextBlock = { type: 'text'; text: string }
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown }
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export type ModelMessage =
  | { role: 'user'; content: string | ToolResultBlock[] }
  | { role: 'assistant'; content: (TextBlock | ToolUseBlock)[] }

export type ModelTool = { name: string; description: string; input_schema: Record<string, unknown> }

export type ModelRequest = {
  system: string
  messages: ModelMessage[]
  tools: ModelTool[]
  // Makes the model answer by calling this tool.
  forceTool?: string
  maxTokens: number
}

export type ModelReply = { content: (TextBlock | ToolUseBlock)[] }

export type AskModel = (request: ModelRequest) => Promise<ModelReply>

// Set ANTHROPIC_API_KEY to switch the assistant on. ASSISTANT_MODEL picks
// another model, e.g. a cheaper one.
export const isAssistantConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY)

const model = () => process.env.ASSISTANT_MODEL || 'claude-opus-5-5'

let client: Anthropic | null = null

export const askClaude: AskModel = async (request) => {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // The tools and the instructions are the same from one call to the next, so
  // they are cached: each further step of a conversation costs much less.
  const tools: Anthropic.Tool[] = request.tools.map((tool, index) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
    ...(index === request.tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }))

  const response = await client.messages.create({
    model: model(),
    max_tokens: request.maxTokens,
    system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
    messages: request.messages as Anthropic.MessageParam[],
    tools,
    ...(request.forceTool ? { tool_choice: { type: 'tool' as const, name: request.forceTool } } : {}),
  })

  return {
    content: response.content.flatMap((block): (TextBlock | ToolUseBlock)[] => {
      if (block.type === 'text') {
        return [{ type: 'text', text: block.text }]
      }

      if (block.type === 'tool_use') {
        return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }]
      }

      return []
    }),
  }
}
