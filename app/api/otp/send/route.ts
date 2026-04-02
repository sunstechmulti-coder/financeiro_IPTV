import { redis } from '@/lib/redis'
import { NextResponse } from 'next/server'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json() as { email?: string }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Formato de e-mail inválido' }, { status: 400 })
    }

    const normalized = normalizeEmail(email)

    // Rate limit: max 3 OTPs per 10 minutes
    const rateLimitKey = `otp:ratelimit:${normalized}`
    const attempts = await redis.incr(rateLimitKey)
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 600)
    }
    if (attempts > 3) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde 10 minutos.' },
        { status: 429 }
      )
    }

    const otp = generateOTP()
    const otpKey = `otp:code:${normalized}`
    await redis.set(otpKey, otp, { ex: 600 })

    // TODO: integrate email provider (e.g. Resend) and remove _devOtp from response
    console.log(`[OTP] ${normalized} → ${otp}`)

    return NextResponse.json({
      success: true,
      message: 'Código enviado para o seu e-mail',
      _devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
