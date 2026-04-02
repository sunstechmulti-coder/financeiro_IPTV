import type { Transaction } from './types'
import { scopedGet, scopedSet } from './scoped-storage'

const STORAGE_KEY = 'cashflow-transactions'

export function getTransactions(): Transaction[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = scopedGet(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  if (typeof window === 'undefined') return
  scopedSet(STORAGE_KEY, JSON.stringify(transactions))
}

export function addTransaction(transaction: Transaction): Transaction[] {
  const transactions = getTransactions()
  const updated = [...transactions, transaction]
  saveTransactions(updated)
  return updated
}

export function updateTransaction(transaction: Transaction): Transaction[] {
  const transactions = getTransactions()
  const updated = transactions.map((t) =>
    t.id === transaction.id ? transaction : t
  )
  saveTransactions(updated)
  return updated
}

export function deleteTransaction(id: string): Transaction[] {
  const transactions = getTransactions()
  const updated = transactions.filter((t) => t.id !== id)
  saveTransactions(updated)
  return updated
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
