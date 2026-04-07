import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

async function getSessionUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/subscription — retorna a subscription do usuário logado
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const admin = createAdminClient()
  
  // Buscar subscription do usuário
  const { data: subscription } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!subscription) {
    // Usuário não tem subscription - criar uma trial
    const now = new Date()
    const { data: newSub, error } = await admin
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_type: 'trial',
        started_at: now.toISOString(),
        expires_at: null, // Será definido no primeiro acesso
        first_access_at: null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ subscription: newSub })
  }

  // Se é o primeiro acesso (first_access_at é null), ativar o trial
  if (!subscription.first_access_at) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias

    const { data: updatedSub, error } = await admin
      .from('user_subscriptions')
      .update({
        first_access_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ subscription: updatedSub, firstAccess: true })
  }

  // Verificar se expirou
  const now = new Date()
  const expiresAt = new Date(subscription.expires_at)
  const isExpired = expiresAt < now

  return NextResponse.json({
    subscription: {
      ...subscription,
      is_expired: isExpired,
      days_remaining: Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
    },
  })
}
