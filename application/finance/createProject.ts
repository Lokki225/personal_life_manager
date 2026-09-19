import {
  financeRepository,
  type CreateProjectData,
  type ProjectRepository,
  type ProjectRecord,
} from '../../infrastructure/repositories/financeRepository'

export type CreateProjectInput = {
  userId: string
  name: string
  notes?: string | null
}

export async function createProject(
  input: CreateProjectInput,
  repository: ProjectRepository = financeRepository,
): Promise<ProjectRecord> {
  const { userId, ...rest } = input

  const payload: CreateProjectData = {
    name: rest.name,
    notes: rest.notes ?? undefined,
  }

  return repository.createProject(userId, payload)
}
