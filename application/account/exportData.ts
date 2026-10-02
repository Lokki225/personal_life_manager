import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { userRepository } from '../../infrastructure/repositories/userRepository'

type ExportDeps = {
  getProfile: typeof userRepository.getProfile
  finance: Pick<
    typeof financeRepository,
    | 'listIncomes'
    | 'listAllocations'
    | 'listExpenses'
    | 'listBudgetExceptions'
    | 'listChests'
    | 'listMovements'
    | 'listGoals'
    | 'listDebts'
    | 'listProjects'
  >
}

const defaultDeps: ExportDeps = { getProfile: userRepository.getProfile, finance: financeRepository }

// A chest's password hash is a secret, not the person's data.
const withoutSecrets = (row: object) =>
  Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'passwordHash'))

// Everything one person recorded, in one object: their own backup, and what
// they would take with them. It holds no password and nobody else's data.
export async function exportUserData(userId: string, deps: ExportDeps = defaultDeps, now: Date = new Date()) {
  const [profile, incomes, allocations, expenses, exceptions, chests, movements, goals, debts, projects] =
    await Promise.all([
      deps.getProfile(userId),
      deps.finance.listIncomes(userId),
      deps.finance.listAllocations(userId),
      deps.finance.listExpenses(userId),
      deps.finance.listBudgetExceptions(userId),
      deps.finance.listChests(userId),
      deps.finance.listMovements(userId),
      deps.finance.listGoals(userId),
      deps.finance.listDebts(userId),
      deps.finance.listProjects(userId),
    ])

  return {
    exportedAt: now.toISOString(),
    app: 'Personal Life Manager',
    profile,
    finance: {
      incomes,
      allocations,
      expenses,
      exceptions,
      chests: chests.map(withoutSecrets),
      movements,
      goals,
      debts,
    },
    projects,
  }
}
