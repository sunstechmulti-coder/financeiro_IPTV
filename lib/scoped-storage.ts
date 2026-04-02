/**
 * Scoped localStorage helpers.
 *
 * Every localStorage key is prefixed with the authenticated user's email so
 * that data from one account never bleeds into another.
 *
 * Pattern:  cashflow:{email}:{key}
 *
 * Usage:
 *   import { scopedGet, scopedSet, scopedRemove } from '@/lib/scoped-storage'
 *
 *   const raw = scopedGet('cashflow-transactions')     // reads scoped key
 *   scopedSet('cashflow-transactions', JSON.stringify(data))
 */

import { getSessionEmail } from './user-session'

function buildKey(key: string): string {
  const email = getSessionEmail()
  // Em modo local, usar um email padrão para scoping
  const effectiveEmail = email || 'usuario@local.dev'
  // Sanitise email for use in a key (replace chars that could be ambiguous)
  const sanitized = effectiveEmail.toLowerCase().replace(/[^a-z0-9@._-]/g, '_')
  return `cashflow:${sanitized}:${key}`
}

export function scopedGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(buildKey(key))
}

export function scopedSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(buildKey(key), value)
}

export function scopedRemove(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(buildKey(key))
}

/**
 * Returns the full scoped key for a given base key.
 * Useful for reading the active scope key in migrations/debug.
 */
export function getScopedKey(key: string): string {
  return buildKey(key)
}
