import type { PersonalTask } from '@/application/personal/tasks'

// What the task components need to draw a task, safe to pass to the client.
export type TaskView = {
  id: string
  title: string
  category: string | null
  repeats: boolean
  carryCount: number
  carryReason: string | null
  // yyyy-mm-dd on the person's clock, or null in the inbox.
  dueDate: string | null
}

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function toTaskView(task: PersonalTask): TaskView {
  return {
    id: task.id,
    title: task.title,
    category: task.category?.name ?? null,
    repeats: task.recurrence !== null,
    carryCount: task.carryCount,
    carryReason: task.carryReason,
    dueDate: task.dueDate ? isoDay(task.dueDate) : null,
  }
}
