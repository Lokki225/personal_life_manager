import Anthropic from '@anthropic-ai/sdk'

import { AiModelUnavailable, AiOutOfCredit, type AskModel, type TextBlock, type ToolUseBlock } from './model'

// Claude, through Anthropic's API.
export function claudeModel(apiKey: string, model: string): AskModel {
  const client = new Anthropic({ apiKey })

  return async (request) => {
    // The tools and the instructions are the same from one call to the next, so
    // they are cached: each further step of a conversation costs much less.
    const tools: Anthropic.Tool[] = request.tools.map((tool, index) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
      ...(index === request.tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }))

    try {
      const response = await client.messages.create({
        model,
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
    } catch (error) {
      if (error instanceof Anthropic.APIError && /credit balance/i.test(error.message)) {
        throw new AiOutOfCredit(error.message)
      }

      if (error instanceof Anthropic.NotFoundError) {
        throw new AiModelUnavailable(error.message)
      }

      throw error
    }
  }
}
