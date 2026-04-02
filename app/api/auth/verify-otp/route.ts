import { redis } from '@/lib/redis'
import { NextResponse } from 'next/server'

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30 // 30 days

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json() as { email?: string; otp?: string }

    if (!email || !otp) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const normalized = normalizeEmail(email)
    const otpKey = `otp:code:${normalized}`

    const stored = await redis.get<string>(otpKey)

    if (!stored) {
      return NextResponse.json(
        { error: 'Código expirado. Solicite um novo.' },
        { status: 400 }
      )
    }

    if (stored.toString() !== otp.toString()) {
      return NextResponse.json(
        { error: 'Código incorreto. Tente novamente.' },
        { status: 400 }
      )
    }

    // OTP is valid — delete it immediately (one-time use)
    await redis.del(otpKey)

    // Create session token
    const sessionToken = `${Date.now()}-${Math.random().toString(36).substring(2)}`
    const sessionKey = `session:${sessionToken}`
    await redis.set(sessionKey, normalized, { ex: SESSION_DURATION_SECONDS })

    const response = NextResponse.json({ success: true, email: normalized })

    response.cookies.set('cf_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
