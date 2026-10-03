import { z } from 'zod'

import { isAccountRuleError } from '../account/errors'
import { ApiNotFound, type ApiUser, type Operation } from '../api/operation'
import { operationList } from '../api/operations'
import { isFinanceRuleError } from '../../domain/finance/errors'
import type { ModelTool } from '../../infrastructure/ai/claude'

// The assistant works through the same operations as the API: what a program
// can do with a key, the assistant can do in a conversation.

// In a conversation the person is right there: no need to notify them.
export const chatOperations: Operation[] = operationList.filter((operation) => operation.name !== 'send_notification')

// What the model reads about each tool: what it does, and the input it takes.
export function toolsFrom(operations: Operation[]): ModelTool[] {
  return operations.map((operation) => {
    const inputSchema: Record<string, unknown> = { ...z.toJSONSchema(operation.input, { io: 'input' }) }
    // Says which draft of JSON Schema it is; the model does not need it.
    delete inputSchema.$schema

    return {
      name: operation.name,
      description: operation.needs === 'WRITE' ? `${operation.does} Changes the person's data.` : operation.does,
      input_schema: inputSchema,
    }
  })
}

// A tool's answer is cut beyond this, so a long history cannot flood the model.
const MAX_RESULT_LENGTH = 20_000

export type ToolOutcome = { content: string; isError: boolean; changed: boolean }

// Runs the tool the model asked for, as the person, and words the outcome for
// the model, including a refusal it should explain.
export async function runTool(
  user: ApiUser,
  operations: Operation[],
  name: string,
  input: unknown,
): Promise<ToolOutcome> {
  const operation = operations.find((candidate) => candidate.name === name)

  if (!operation) {
    return { content: `There is no tool named "${name}".`, isError: true, changed: false }
  }

  const parsed = operation.input.safeParse(input ?? {})

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path.map(String).join('.')

    return { content: `Invalid input${field ? ` for "${field}"` : ''}: ${issue.message}`, isError: true, changed: false }
  }

  try {
    const result = JSON.stringify(await operation.run(user, parsed.data))

    return {
      content: result.length > MAX_RESULT_LENGTH ? `${result.slice(0, MAX_RESULT_LENGTH)}… (cut)` : result,
      isError: false,
      changed: operation.needs === 'WRITE',
    }
  } catch (error) {
    if (error instanceof ApiNotFound || isFinanceRuleError(error) || isAccountRuleError(error)) {
      return { content: `Refused: ${error.message}`, isError: true, changed: false }
    }

    console.error(`Assistant tool ${name} failed:`, error)
    return { content: 'This failed because of a problem on the server. Nothing was changed.', isError: true, changed: false }
  }
}
