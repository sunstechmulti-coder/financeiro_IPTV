import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { currentPassword, newPassword } = await req.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      )
    }

    // Get the access token from the Authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.split(' ')[1]

    // Create a Supabase client with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    )

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      )
    }

    // If currentPassword provided, verify it first by attempting a sign in
    if (currentPassword) {
      const verifyClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: signInError } = await verifyClient.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      })
      if (signInError) {
        return NextResponse.json(
          { error: 'Senha atual incorreta.' },
          { status: 400 }
        )
      }
    }

    // Use admin client to update the password
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

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar senha. Tente novamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso!' })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}
