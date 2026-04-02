import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/auth/user - Get current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (err) {
    console.error('[user GET]', err)
    return NextResponse.json({ user: null })
  }
}

// DELETE /api/auth/user - Logout
export async function DELETE() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[user DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
