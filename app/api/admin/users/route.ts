import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'admin1@sunstech.com'

type UserRole = 'admin' | 'reseller' | 'user'

interface UserProfile {
  id: string
  email: string | null
  role: UserRole
  created_by: string | null
  reseller_id: string | null
  is_active: boolean
}

interface ResellerWallet {
  reseller_id: string
  balance: number
  last_recharge_at: string | null
  grace_until: string | null
  status: 'active' | 'grace' | 'blocked'
}

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

function getSafeRole(value: unknown): UserRole {
  if (value === 'reseller') return 'reseller'
  return 'user'
}

// GET /api/admin/users — lista todos os usuários com subscriptions, perfil e carteira de revendedor
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

  // Buscar perfis de todos os usuários
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, email, role, created_by, reseller_id, is_active')

  const profileMap = new Map(
    ((profiles || []) as UserProfile[]).map((profile) => [profile.id, profile])
  )

  // Buscar carteiras dos revendedores
  const { data: wallets } = await admin
    .from('reseller_wallets')
    .select('reseller_id, balance, last_recharge_at, grace_until, status')

  const walletMap = new Map(
    ((wallets || []) as ResellerWallet[]).map((wallet) => [
      wallet.reseller_id,
      wallet,
    ])
  )

  const users = data.users.map((u) => {
    const profile = profileMap.get(u.id)
    const fallbackRole: UserRole = u.email === ADMIN_EMAIL ? 'admin' : 'user'
    const role = profile?.role || fallbackRole

    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role,
      profile: profile || {
        id: u.id,
        email: u.email || null,
        role,
        created_by: null,
        reseller_id: null,
        is_active: true,
      },
      reseller_wallet: walletMap.get(u.id) || null,
      subscription: subscriptionMap.get(u.id) || null,
    }
  })

  return NextResponse.json({ users })
}

// POST /api/admin/users — cria um novo usuário comum ou revendedor
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await req.json()
  const { email, password } = body
  const role = getSafeRole(body.role || body.userRole)

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios.' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  if (!['user', 'reseller'].includes(role)) {
    return NextResponse.json({ error: 'Tipo de usuário inválido.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const normalizedEmail = email.toLowerCase().trim()

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const createdUserId = data.user.id
  const now = new Date().toISOString()

  // Criar subscription trial para o novo usuário (30 dias a partir do primeiro acesso)
  const { error: subscriptionError } = await admin.from('user_subscriptions').insert({
    user_id: createdUserId,
    plan_type: 'trial',
    started_at: now,
    expires_at: null, // Será definido no primeiro acesso
    first_access_at: null,
    is_active: true,
  })

  if (subscriptionError) {
    await admin.auth.admin.deleteUser(createdUserId)
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 })
  }

  // Criar/atualizar perfil do usuário
  const { error: profileError } = await admin.from('user_profiles').upsert({
    id: createdUserId,
    email: data.user.email || normalizedEmail,
    role,
    created_by: user.id,
    reseller_id: null,
    is_active: true,
    updated_at: now,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(createdUserId)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Se for revendedor, criar carteira zerada
  if (role === 'reseller') {
    const { error: walletError } = await admin.from('reseller_wallets').insert({
      reseller_id: createdUserId,
      balance: 0,
      last_recharge_at: null,
      grace_until: null,
      status: 'active',
    })

    if (walletError) {
      await admin.auth.admin.deleteUser(createdUserId)
      return NextResponse.json({ error: walletError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
      role,
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
