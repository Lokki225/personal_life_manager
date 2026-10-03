// What the assistant needs from a language model, whoever provides it. The
// shapes follow Anthropic's; each provider's adapter converts to and from its
// own format, so the rest of the app never sees the difference.

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

// The provider's account has no credit left: nothing will work until it is topped up.
export class AiOutOfCredit extends Error {}

// The model asked for does not exist, or no longer does: its setting needs changing.
export class AiModelUnavailable extends Error {}
