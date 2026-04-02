import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

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

    const supabase = createAdminClient()

    // Send OTP via Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      console.error('[send-otp]', error)
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Muitas tentativas. Aguarde alguns minutos.' },
          { status: 429 }
        )
      }
      
      return NextResponse.json(
        { error: 'Erro ao enviar código. Tente novamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Código enviado para o seu e-mail',
    })
  } catch (err) {
    console.error('[send-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
