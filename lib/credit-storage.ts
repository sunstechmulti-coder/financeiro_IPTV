import type { CreditMovement } from './types'
import { generateId } from './storage'
import { scopedGet, scopedSet } from './scoped-storage'

const KEY_MOVEMENTS = 'cashflow-credit-movements'

export function getCreditMovements(): CreditMovement[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = scopedGet(KEY_MOVEMENTS)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

export function saveCreditMovements(list: CreditMovement[]): void {
  if (typeof window === 'undefined') return
  scopedSet(KEY_MOVEMENTS, JSON.stringify(list))
}

export function addCreditMovement(
  m: Omit<CreditMovement, 'id'>
): CreditMovement[] {
  const list = getCreditMovements()
  const novo: CreditMovement = { ...m, id: generateId() }
  const updated = [...list, novo]
  saveCreditMovements(updated)
  return updated
}

/**
 * Remove a movement by its linked transactionId (used on delete/edit).
 */
export function removeCreditMovementByTransaction(
  transactionId: string
): CreditMovement[] {
  const list = getCreditMovements().filter(
    (m) => m.transactionId !== transactionId
  )
  saveCreditMovements(list)
  return list
}

export function getCreditMovementsByServer(
  serverId: string
): CreditMovement[] {
  return getCreditMovements().filter((m) => m.serverId === serverId)
}

