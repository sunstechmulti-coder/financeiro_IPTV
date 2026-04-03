import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Admin endpoint to reset any user's password.
 * Requires the service_role key (server-side only).
 * Body: { email: string, newPassword: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, newPassword } = await req.json()

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email e nova senha são obrigatórios.' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Find user by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json(
        { error: 'Erro ao buscar usuários.' },
        { status: 500 }
      )
    }

    const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 }
      )
    }

    // Update password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Admin reset password error:', updateError)
      return NextResponse.json(
        { error: 'Erro ao redefinir senha.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Senha do usuário ${email} redefinida com sucesso!`,
    })
  } catch (error) {
    console.error('Admin reset error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}
