import type { ActivationProduct, ActivationTransaction, PricingRule } from './types'
import { generateId } from './storage'
import { scopedGet, scopedSet } from './scoped-storage'

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_ACTIVATION_PRODUCTS: ActivationProduct[] = [
  {
    id: 'ativa-app',
    nome: 'ATIVA APP',
    validadeMeses: 12,
    linkedServerId: 'ativaapp',
    custosPermitidos: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
    regrasPreco: [
      { minCost: 0.5, maxCost: 1.0, salePrice: 20.00 },
      { minCost: 1.1, maxCost: 1.9, salePrice: 25.00 },
    ],
  },
]

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEY_PRODUCTS     = 'cashflow-activation-products'
const KEY_TRANSACTIONS = 'cashflow-activation-transactions'

// ─── Products ────────────────────────────────────────────────────────────────

export function getActivationProducts(): ActivationProduct[] {
  if (typeof window === 'undefined') return DEFAULT_ACTIVATION_PRODUCTS
  try {
    const stored = scopedGet(KEY_PRODUCTS)
    return stored ? JSON.parse(stored) : DEFAULT_ACTIVATION_PRODUCTS
  } catch { return DEFAULT_ACTIVATION_PRODUCTS }
}

export function saveActivationProducts(list: ActivationProduct[]): void {
  if (typeof window === 'undefined') return
  scopedSet(KEY_PRODUCTS, JSON.stringify(list))
}

export function addActivationProduct(p: Omit<ActivationProduct, 'id'>): ActivationProduct[] {
  const list = getActivationProducts()
  const novo = { ...p, id: generateId() }
  const updated = [...list, novo]
  saveActivationProducts(updated)
  return updated
}

export function updateActivationProduct(p: ActivationProduct): ActivationProduct[] {
  const list = getActivationProducts().map((x) => (x.id === p.id ? p : x))
  saveActivationProducts(list)
  return list
}

export function deleteActivationProduct(id: string): ActivationProduct[] {
  const list = getActivationProducts().filter((x) => x.id !== id)
  saveActivationProducts(list)
  return list
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function getActivationTransactions(): ActivationTransaction[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = scopedGet(KEY_TRANSACTIONS)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

export function saveActivationTransactions(list: ActivationTransaction[]): void {
  if (typeof window === 'undefined') return
  scopedSet(KEY_TRANSACTIONS, JSON.stringify(list))
}

export function addActivationTransaction(
  t: Omit<ActivationTransaction, 'id' | 'createdAt'>
): ActivationTransaction[] {
  const list = getActivationTransactions()
  const novo: ActivationTransaction = { ...t, id: generateId(), createdAt: new Date().toISOString() }
  const updated = [...list, novo]
  saveActivationTransactions(updated)
  return updated
}

/**
 * Find and return the ActivationTransaction linked to a given Transaction id.
 * Used to retrieve custo/linkedServerId before deleting.
 */
export function getActivationTransactionByTransactionId(
  transactionId: string
): ActivationTransaction | undefined {
  return getActivationTransactions().find((t) => t.transactionId === transactionId)
}

/**
 * Remove the ActivationTransaction whose transactionId matches.
 * Call this when the parent Transaction is deleted — before adjusting balance.
 */
export function removeActivationTransactionByTransactionId(
  transactionId: string
): ActivationTransaction[] {
  const list = getActivationTransactions().filter(
    (t) => t.transactionId !== transactionId
  )
  saveActivationTransactions(list)
  return list
}

// ─── Pricing Helper ──────────────────────────────────────────────────────────

/**
 * Returns the sale price for a given cost based on the product's pricing rules.
 * Returns 0 if no rule matches.
 */
export function getSalePrice(product: ActivationProduct, custo: number): number {
  const rule = product.regrasPreco.find(
    (r) => custo >= r.minCost && custo <= r.maxCost
  )
  return rule?.salePrice ?? 0
}
