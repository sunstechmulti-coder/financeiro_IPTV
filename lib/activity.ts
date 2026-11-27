import type { Transaction } from './types'

export type ActivityScope = 'all' | 'iptv' | 'printing_3d' | 'unclassified'
export const ACTIVITY_LABELS = {
  all: 'Consolidado', iptv: 'IPTV', printing_3d: 'Impressão 3D', unclassified: 'Não classificados',
} as const

export function transactionActivity(transaction: Transaction): Exclude<ActivityScope, 'all'> {
  return transaction.activity === 'iptv' || transaction.activity === 'printing_3d'
    ? transaction.activity : 'unclassified'
}

export function filterActivity(transactions: Transaction[], scope: ActivityScope, administrator = true) {
  if (!administrator) return transactions.filter(t => t.activity !== 'printing_3d')
  return scope === 'all' ? transactions : transactions.filter(t => transactionActivity(t) === scope)
}

export function monthTransactions(transactions: Transaction[], month: number, year: number) {
  const prefix = year + '-' + String(month + 1).padStart(2, '0')
  return transactions.filter(t => t.date.slice(0, 7) === prefix)
}

export function financialSummary(transactions: Transaction[]) {
  const cents = (amount: number) => Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : 0
  let incomeCents = 0
  let expenseCents = 0
  let sales = 0
  const customers = new Set<string>()
  for (const t of transactions) {
    if (t.type === 'income') {
      incomeCents += cents(t.amount)
      sales++
      const name = t.printingDetails?.customerName?.trim().toLocaleLowerCase('pt-BR')
      if (name) customers.add(name)
    } else expenseCents += cents(t.amount)
  }
  return {
    income: incomeCents / 100, expenses: expenseCents / 100,
    balance: (incomeCents - expenseCents) / 100, sales,
    ticket: sales ? incomeCents / 100 / sales : 0, customers: customers.size,
  }
}

export function activityBreakdown(transactions: Transaction[]) {
  return (['iptv', 'printing_3d', 'unclassified'] as const).map(activity => ({
    activity, label: ACTIVITY_LABELS[activity],
    ...financialSummary(filterActivity(transactions, activity)),
  }))
}

export function monthlySeries(transactions: Transaction[], month: number, year: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 5 + index, 1))
    const rows = monthTransactions(transactions, date.getUTCMonth(), date.getUTCFullYear())
    const byActivity = activityBreakdown(rows)
    return {
      period: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      ...financialSummary(rows),
      iptv: byActivity[0].income, printing_3d: byActivity[1].income, unclassified: byActivity[2].income,
    }
  })
}

export function revenueRanking(transactions: Transaction[]) {
  const groups = new Map<string, number>()
  for (const t of transactions.filter(t => t.type === 'income')) {
    const name = t.printingDetails?.productName?.trim() || t.description.trim() || 'Sem descrição'
    groups.set(name, (groups.get(name) || 0) + Math.round(Number(t.amount) * 100))
  }
  return [...groups].map(([name, cents]) => ({ name, value: cents / 100 })).sort((a, b) => b.value - a.value)
}

export function expenseCategories(transactions: Transaction[]) {
  const groups = new Map<string, number>()
  for (const t of transactions.filter(t => t.type === 'expense')) {
    const name = t.printingDetails?.category?.trim() || 'Sem categoria'
    groups.set(name, (groups.get(name) || 0) + Math.round(Number(t.amount) * 100))
  }
  return [...groups].map(([name, cents]) => ({ name, value: cents / 100 })).sort((a, b) => b.value - a.value)
}

export function parsePrintingAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, '')
  if (normalized.includes(',') && !/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(normalized)) return null
  const decimal = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized
  if (!/^\d+(?:\.\d{1,2})?$/.test(decimal)) return null
  const amount = Number(decimal)
  return Number.isFinite(amount) && amount > 0 && amount <= 9999999999.99 ? amount : null
}
