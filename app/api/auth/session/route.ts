import { redis } from '@/lib/redis'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// GET /api/auth/session — returns the logged-in email or null
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('cf_session')?.value

    if (!token) {
      return NextResponse.json({ email: null })
    }

    const email = await redis.get<string>(`session:${token}`)
    return NextResponse.json({ email: email ?? null })
  } catch (err) {
    console.error('[session GET]', err)
    return NextResponse.json({ email: null })
  }
}

// DELETE /api/auth/session — logout
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('cf_session')?.value

    if (token) {
      await redis.del(`session:${token}`)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('cf_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[session DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
