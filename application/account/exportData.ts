import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { exportCareer } from '../../infrastructure/repositories/careerRepository'
import { exportPersonal } from '../../infrastructure/repositories/personalRepository'
import { userRepository } from '../../infrastructure/repositories/userRepository'

type ExportDeps = {
  getProfile: typeof userRepository.getProfile
  finance: Pick<
    typeof financeRepository,
    | 'listIncomes'
    | 'listOneOffIncomes'
    | 'listAllocations'
    | 'listExpenses'
    | 'listBudgetExceptions'
    | 'listChests'
    | 'listMovements'
    | 'listGoals'
    | 'listDebts'
    | 'listProjects'
  >
  personal?: typeof exportPersonal
  career?: typeof exportCareer
}

const defaultDeps: ExportDeps = { getProfile: userRepository.getProfile, finance: financeRepository, personal: exportPersonal, career: exportCareer }

// A chest's password hash is a secret, not the person's data.
const withoutSecrets = (row: object) =>
  Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'passwordHash'))

// Everything one person recorded, in one object: their own backup, and what
// they would take with them. It holds no password and nobody else's data.
export async function exportUserData(userId: string, deps: ExportDeps = defaultDeps, now: Date = new Date()) {
  const [profile, incomes, oneOffIncomes, allocations, expenses, exceptions, chests, movements, goals, debts, projects, personal, career] =
    await Promise.all([
      deps.getProfile(userId),
      deps.finance.listIncomes(userId),
      deps.finance.listOneOffIncomes(userId),
      deps.finance.listAllocations(userId),
      deps.finance.listExpenses(userId),
      deps.finance.listBudgetExceptions(userId),
      deps.finance.listChests(userId),
      deps.finance.listMovements(userId),
      deps.finance.listGoals(userId),
      deps.finance.listDebts(userId),
      deps.finance.listProjects(userId),
      deps.personal ? deps.personal(userId) : Promise.resolve(null),
      deps.career ? deps.career(userId) : Promise.resolve(null),
    ])

  return {
    exportedAt: now.toISOString(),
    app: 'Personal Life Manager',
    profile,
    finance: {
      incomes,
      oneOffIncomes,
      allocations,
      expenses,
      exceptions,
      chests: chests.map(withoutSecrets),
      movements,
      goals,
      debts,
    },
    projects,
    personal,
    career,
  }
}
