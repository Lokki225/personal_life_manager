'use server'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { createAllocation } from '../../../application/finance/createAllocation'
import { createIncome } from '../../../application/finance/createIncome'
import { summarizeSetupPlan, type SetupPeriod } from '../../../application/finance/setupFinancePlan'
import { prisma } from '../../../infrastructure/prisma/client'
import {
  financeRepository,
  type AllocationRepository,
  type IncomeRepository,
} from '../../../infrastructure/repositories/financeRepository'
import { authOptions } from '../../api/auth/[...nextauth]/route'

export async function resolveSessionUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: unknown; email?: unknown } | undefined

  if (typeof sessionUser?.id === 'string' && sessionUser.id.length > 0) {
    return sessionUser.id
  }

  if (typeof sessionUser?.email === 'string' && sessionUser.email.length > 0) {
    const user = await prisma.user.findUnique({
      where: { email: sessionUser.email.toLowerCase() },
    })

    if (user) {
      return user.id
    }
  }

  const configuredUserId = process.env.DEFAULT_USER_ID

  if (configuredUserId) {
    return configuredUserId
  }

  throw new Error('No authenticated user found for finance setup.')
}

export async function saveSetupPlan(
  formData: FormData,
  incomeRepository: IncomeRepository = financeRepository,
  allocationRepository: AllocationRepository = financeRepository,
): Promise<void> {
  const userId = await resolveSessionUserId()
  const incomeAmount = Number(formData.get('incomeAmount') ?? 0)
  const incomeFrequency = String(formData.get('incomeFrequency') ?? 'monthly')
  const incomeSource = String(formData.get('incomeSource') ?? 'Salary')

  const allocationNames = formData
    .getAll('allocationName')
    .map((value) => String(value ?? '').trim())
  const allocationAmounts = formData
    .getAll('allocationAmount')
    .map((value) => Number(value ?? 0))
  const allocationPeriods = formData
    .getAll('allocationPeriod')
    .map((value) => String(value ?? 'monthly'))
  const allocationCategories = formData
    .getAll('allocationCategory')
    .map((value) => String(value ?? 'daily_living'))

  const allocationEntries = allocationNames.length
    ? allocationNames
        .map((name, index) => ({
          name,
          amount: Number(allocationAmounts[index] ?? allocationAmounts[0] ?? 0),
          period: (allocationPeriods[index] ?? allocationPeriods[0] ?? 'monthly') as SetupPeriod,
          category:
            allocationCategories[index] ?? allocationCategories[0] ?? 'daily_living',
        }))
        .filter((entry) => entry.name && Number.isFinite(entry.amount))
    : [
        {
          name: String(formData.get('allocationName') ?? 'Daily Living'),
          amount: Number(formData.get('allocationAmount') ?? 0),
          period:
            ((String(formData.get('allocationPeriod') ?? 'monthly') as SetupPeriod) ||
              'monthly') as SetupPeriod,
          category: String(formData.get('allocationCategory') ?? 'daily_living'),
        },
      ]

  const allocationTotal = allocationEntries.reduce(
    (total, entry) => total + Number(entry.amount || 0),
    0,
  )

  const allocationPeriod =
    allocationEntries[0]?.period ||
    ((String(formData.get('allocationPeriod') ?? 'monthly') as SetupPeriod) ||
      'monthly')

  const incomePromise = createIncome(
    {
      userId,
      source: incomeSource,
      amount: incomeAmount,
      frequency: incomeFrequency,
      status: 'expected',
    },
    incomeRepository,
  )

  const allocationPromises = allocationEntries.map((entry) =>
    createAllocation(
      {
        userId,
        name: entry.name,
        amount: entry.amount,
        period: entry.period,
        category: entry.category,
        startDate: new Date(),
      },
      allocationRepository,
    ),
  )

  await Promise.all([incomePromise, ...allocationPromises])

  summarizeSetupPlan({
    incomeAmount,
    allocationAmount: allocationTotal,
    allocationPeriod,
  })

  return redirect('/finance')
}
