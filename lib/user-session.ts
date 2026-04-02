/**
 * Client-side session helpers.
 * The actual session token lives in an httpOnly cookie managed by the server.
 * We keep a copy of the email in sessionStorage so the UI can render it
 * without an extra round-trip after the initial load.
 */

const SESSION_EMAIL_KEY = 'cf_email'

export function getSessionEmail(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(SESSION_EMAIL_KEY)
}

export function setSessionEmail(email: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_EMAIL_KEY, email)
}

export function clearSessionEmail(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_EMAIL_KEY)
}

/** Fetch the authenticated email from the server session (validates cookie). */
export async function fetchSessionEmail(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data.email ?? null
  } catch {
    return null
  }
}

/** Send OTP to email. Returns { success, _devOtp? } or throws. */
export async function sendOtp(email: string): Promise<{ success: boolean; _devOtp?: string }> {
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar código')
  return data
}

/** Verify OTP. On success sets session cookie server-side and returns email. */
export async function verifyOtp(email: string, otp: string): Promise<string> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, otp }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Código inválido')
  return data.email as string
}

/** Logout: deletes server session and clears local cache. */
export async function logout(): Promise<void> {
  clearSessionEmail()
  await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' })
}
