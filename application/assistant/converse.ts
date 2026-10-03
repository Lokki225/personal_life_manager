import type { ApiUser, Operation } from '../api/operation'
import type { AskModel, ModelMessage, ToolResultBlock } from '../../infrastructure/ai/model'
import { now as clockNow } from '../../lib/clock'
import { chatInstructions } from './instructions'
import type { Persona } from './persona'
import { runTool, toolsFrom } from './tools'

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

// How many times the model may use tools before it must answer. Plenty for
// "read, then change, then read again".
const MAX_STEPS = 10
const MAX_TOKENS = 2048

// The model to talk to, the operations it may use, and who it is.
export type ConverseDeps = { ask: AskModel; operations: Operation[]; persona?: Persona }

// Answers the last thing the person said. The model reads and changes their
// data through the tools until it has its answer. `changed` says whether
// anything was recorded or changed, so the pages can refresh.
export async function converse(
  user: ApiUser,
  history: ChatTurn[],
  deps: ConverseDeps,
  now: Date = clockNow(),
): Promise<{ reply: string | null; changed: boolean }> {
  const messages: ModelMessage[] = history.map((turn) =>
    turn.role === 'user'
      ? { role: 'user', content: turn.text }
      : { role: 'assistant', content: [{ type: 'text', text: turn.text }] },
  )
  const tools = toolsFrom(deps.operations)
  const system = chatInstructions(user, now, deps.persona)
  let changed = false

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const { content } = await deps.ask({ system, messages, tools, maxTokens: MAX_TOKENS })
    const toolUses = content.filter((block) => block.type === 'tool_use')

    messages.push({ role: 'assistant', content })

    if (toolUses.length === 0) {
      const reply = content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim()

      return { reply: reply || null, changed }
    }

    const results: ToolResultBlock[] = []

    // One after the other: a later change may depend on an earlier one.
    for (const toolUse of toolUses) {
      const outcome = await runTool(user, deps.operations, toolUse.name, toolUse.input)

      changed ||= outcome.changed
      results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: outcome.content, is_error: outcome.isError })
    }

    messages.push({ role: 'user', content: results })
  }

  // Ran out of steps: whatever was done stays done, and the caller says so.
  return { reply: null, changed }
}
