import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json() as { email?: string; token?: string }

    if (!email || !token) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify OTP token
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: token.trim(),
      type: 'email',
    })

    if (error) {
      console.error('[verify-otp]', error)
      
      if (error.message.includes('expired')) {
        return NextResponse.json(
          { error: 'Código expirado. Solicite um novo.' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('invalid')) {
        return NextResponse.json(
          { error: 'Código inválido. Tente novamente.' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'Erro na verificação. Tente novamente.' },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Falha na autenticação' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
