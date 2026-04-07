import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'admin1@sunstech.com'

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

// GET /api/admin/users — lista todos os usuários com subscriptions
export async function GET() {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Buscar subscriptions de todos os usuários
  const { data: subscriptions } = await admin
    .from('user_subscriptions')
    .select('*')

  const subscriptionMap = new Map(
    (subscriptions || []).map((s: { user_id: string }) => [s.user_id, s])
  )

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    subscription: subscriptionMap.get(u.id) || null,
  }))

  return NextResponse.json({ users })
}

// POST /api/admin/users — cria um novo usuário
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await req.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios.' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Criar subscription trial para o novo usuário (30 dias a partir do primeiro acesso)
  await admin.from('user_subscriptions').insert({
    user_id: data.user.id,
    plan_type: 'trial',
    started_at: new Date().toISOString(),
    expires_at: null, // Será definido no primeiro acesso
    first_access_at: null,
    is_active: true,
  })

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    },
  })
}

// PATCH /api/admin/users — atualiza a subscription de um usuário
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, planType, customExpiresAt } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 })
  }

  // Precisa ter ou planType ou customExpiresAt
  if (!planType && !customExpiresAt) {
    return NextResponse.json({ error: 'planType ou customExpiresAt são obrigatórios.' }, { status: 400 })
  }

  const validPlans = ['trial', '1_month', '2_months', '3_months', '6_months', '12_months']
  if (planType && !validPlans.includes(planType)) {
    return NextResponse.json({ error: 'Tipo de plano inválido.' }, { status: 400 })
  }

  // Dias por tipo de plano
  const planDays: Record<string, number> = {
    trial: 30,
    '1_month': 30,
    '2_months': 60,
    '3_months': 90,
    '6_months': 180,
    '12_months': 365,
  }

  const now = new Date()
  const admin = createAdminClient()

  // Verificar se já existe subscription para o usuário
  const { data: existingSub } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  let expiresAt: Date
  let daysAdded = 0

  // Se tem data customizada, usa ela como base
  if (customExpiresAt) {
    expiresAt = new Date(customExpiresAt)
    // Se também tem planType, adiciona os dias à data customizada
    if (planType) {
      daysAdded = planDays[planType] || 0
      expiresAt = new Date(expiresAt.getTime() + daysAdded * 24 * 60 * 60 * 1000)
    }
  } else if (planType) {
    // Só planType: adiciona dias ao vencimento atual ou hoje
    daysAdded = planDays[planType] || 30
    let baseDate: Date

    if (existingSub && existingSub.expires_at) {
      const currentExpiration = new Date(existingSub.expires_at)
      baseDate = currentExpiration > now ? currentExpiration : now
    } else {
      baseDate = now
    }

    expiresAt = new Date(baseDate.getTime() + daysAdded * 24 * 60 * 60 * 1000)
  } else {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  // Determinar o plan_type a salvar
  const newPlanType = planType || existingSub?.plan_type || 'custom'

  if (existingSub) {
    // Atualizar subscription existente
    const { error } = await admin
      .from('user_subscriptions')
      .update({
        plan_type: newPlanType,
        expires_at: expiresAt.toISOString(),
        first_access_at: existingSub.first_access_at || now.toISOString(),
        is_active: true,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    // Criar nova subscription
    const { error } = await admin.from('user_subscriptions').insert({
      user_id: userId,
      plan_type: newPlanType,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      first_access_at: now.toISOString(),
      is_active: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ 
    success: true, 
    expiresAt: expiresAt.toISOString(),
    daysAdded,
  })
}

// DELETE /api/admin/users — remove um usuário pelo ID
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await req.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 })
  }

  // Impede deletar a própria conta admin
  if (userId === user.id) {
    return NextResponse.json({ error: 'Não é possível remover a conta administradora.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
