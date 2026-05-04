import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

type UserRole = 'admin' | 'reseller' | 'user'

const ADMIN_EMAIL = 'admin1@sunstech.com'
const TRIAL_DAYS = 30

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.toLowerCase().trim()
}

function normalizePassword(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

async function getCurrentProfile(userId: string, email?: string | null) {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profile) return profile

  const role: UserRole = email === ADMIN_EMAIL ? 'admin' : 'user'

  const { data: newProfile, error } = await admin
    .from('user_profiles')
    .insert({
      id: userId,
      email: email || null,
      role,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) return null

  return newProfile
}

async function requireResellerOrAdmin() {
  const user = await getSessionUser()

  if (!user) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      ),
    }
  }

  const profile = await getCurrentProfile(user.id, user.email)

  if (!profile || !profile.is_active) {
    return {
      user,
      profile,
      response: NextResponse.json(
        { error: 'Perfil sem permissão de acesso.' },
        { status: 403 }
      ),
    }
  }

  const isAdmin = user.email === ADMIN_EMAIL || profile.role === 'admin'
  const isReseller = profile.role === 'reseller'

  if (!isAdmin && !isReseller) {
    return {
      user,
      profile,
      response: NextResponse.json(
        { error: 'Acesso permitido apenas para revendedores.' },
        { status: 403 }
      ),
    }
  }

  return { user, profile, response: null }
}

async function getResellerWalletStatus(resellerId: string) {
  const admin = createAdminClient()

  const { data: wallet } = await admin
    .from('reseller_wallets')
    .select('*')
    .eq('reseller_id', resellerId)
    .single()

  return wallet
}

function getSubscriptionStatus(subscription: any) {
  if (!subscription) {
    return {
      is_expired: false,
      days_remaining: 0,
    }
  }

  if (!subscription.expires_at) {
    return {
      is_expired: false,
      days_remaining: 0,
    }
  }

  const now = new Date()
  const expiresAt = new Date(subscription.expires_at)

  if (Number.isNaN(expiresAt.getTime())) {
    return {
      is_expired: false,
      days_remaining: 0,
    }
  }

  const diffMs = expiresAt.getTime() - now.getTime()
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

  return {
    is_expired: daysRemaining <= 0,
    days_remaining: Math.max(0, daysRemaining),
  }
}

// GET /api/reseller/clients
// Lista clientes do revendedor logado.
// Admin pode usar ?resellerId=... para consultar clientes de um revendedor específico.
export async function GET(req: NextRequest) {
  const { user, profile, response } = await requireResellerOrAdmin()

  if (response || !user || !profile) {
    return response
  }

  const admin = createAdminClient()
  const isAdmin = user.email === ADMIN_EMAIL || profile.role === 'admin'
  const requestedResellerId = req.nextUrl.searchParams.get('resellerId')
  const resellerId = isAdmin && requestedResellerId ? requestedResellerId : user.id

  if (!resellerId) {
    return NextResponse.json(
      { error: 'Revendedor não informado.' },
      { status: 400 }
    )
  }

  if (!isAdmin && resellerId !== user.id) {
    return NextResponse.json(
      { error: 'Você só pode consultar seus próprios clientes.' },
      { status: 403 }
    )
  }

  const { data: resellerProfile, error: resellerProfileError } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active')
    .eq('id', resellerId)
    .single()

  if (resellerProfileError || !resellerProfile) {
    return NextResponse.json(
      { error: 'Revendedor não encontrado.' },
      { status: 404 }
    )
  }

  if (resellerProfile.role !== 'reseller') {
    return NextResponse.json(
      { error: 'O usuário informado não é um revendedor.' },
      { status: 400 }
    )
  }

  const { data: clientProfiles, error: clientsError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('role', 'user')
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false })

  if (clientsError) {
    return NextResponse.json(
      { error: clientsError.message },
      { status: 500 }
    )
  }

  const clientIds = (clientProfiles || []).map((client) => client.id)

  let subscriptions: any[] = []

  if (clientIds.length > 0) {
    const { data: subs, error: subscriptionsError } = await admin
      .from('user_subscriptions')
      .select('*')
      .in('user_id', clientIds)

    if (subscriptionsError) {
      return NextResponse.json(
        { error: subscriptionsError.message },
        { status: 500 }
      )
    }

    subscriptions = subs || []
  }

  const subscriptionMap = new Map(
    subscriptions.map((subscription) => [subscription.user_id, subscription])
  )

  const clients = (clientProfiles || []).map((client) => {
    const subscription = subscriptionMap.get(client.id) || null
    const subscriptionStatus = getSubscriptionStatus(subscription)

    return {
      id: client.id,
      email: client.email,
      created_at: client.created_at,
      profile: client,
      subscription: subscription
        ? {
            ...subscription,
            ...subscriptionStatus,
          }
        : null,
    }
  })

  const wallet = await getResellerWalletStatus(resellerId)

  return NextResponse.json({
    reseller: resellerProfile,
    wallet,
    clients,
  })
}

// POST /api/reseller/clients
// Cria usuário comum vinculado ao revendedor logado.
// Cliente recebe trial de 30 dias a partir da criação.
export async function POST(req: NextRequest) {
  const { user, profile, response } = await requireResellerOrAdmin()

  if (response || !user || !profile) {
    return response
  }

  const admin = createAdminClient()
  const isAdmin = user.email === ADMIN_EMAIL || profile.role === 'admin'

  const body = await req.json()
  const email = normalizeEmail(body.email)
  const password = normalizePassword(body.password)
  const requestedResellerId =
    typeof body.resellerId === 'string' ? body.resellerId.trim() : ''

  const resellerId = isAdmin && requestedResellerId ? requestedResellerId : user.id

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email e senha são obrigatórios.' },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'A senha deve ter pelo menos 6 caracteres.' },
      { status: 400 }
    )
  }

  if (!isAdmin && resellerId !== user.id) {
    return NextResponse.json(
      { error: 'Você só pode criar clientes para a sua própria revenda.' },
      { status: 403 }
    )
  }

  const { data: resellerProfile, error: resellerProfileError } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active')
    .eq('id', resellerId)
    .single()

  if (resellerProfileError || !resellerProfile) {
    return NextResponse.json(
      { error: 'Revendedor não encontrado.' },
      { status: 404 }
    )
  }

  if (resellerProfile.role !== 'reseller') {
    return NextResponse.json(
      { error: 'O usuário informado não é um revendedor.' },
      { status: 400 }
    )
  }

  if (!resellerProfile.is_active) {
    return NextResponse.json(
      { error: 'Revendedor inativo. Não é possível criar clientes.' },
      { status: 403 }
    )
  }

  const wallet = await getResellerWalletStatus(resellerId)

  if (!wallet) {
    return NextResponse.json(
      { error: 'Carteira do revendedor não encontrada.' },
      { status: 404 }
    )
  }

  if (!isAdmin && wallet.status !== 'active') {
    return NextResponse.json(
      {
        error:
          wallet.status === 'grace'
            ? 'Sua revenda está em período de tolerância. Você pode usar o painel como usuário comum, mas não pode criar clientes.'
            : 'Sua revenda está bloqueada. Regularize sua recarga para criar clientes.',
      },
      { status: 403 }
    )
  }

  // Regra comercial:
  // Revendedor precisa ter pelo menos 1 crédito para liberar novo teste de 30 dias.
  // Não desconta crédito aqui; o crédito será usado apenas na renovação.
  if (!isAdmin && Number(wallet.balance || 0) <= 0) {
    return NextResponse.json(
      {
        error:
          'Você precisa ter créditos disponíveis para criar um novo cliente teste. Faça uma recarga com o administrador.',
      },
      { status: 403 }
    )
  }

  const { data: createdAuthUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (createUserError || !createdAuthUser.user) {
    const message = createUserError?.message || 'Erro ao criar cliente.'

    if (
      message.includes('already registered') ||
      message.includes('already been registered') ||
      message.includes('User already registered')
    ) {
      return NextResponse.json(
        { error: 'Este e-mail já está cadastrado.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }

  const clientUser = createdAuthUser.user
  const now = new Date()
  const expiresAt = addDays(now, TRIAL_DAYS)

  const { error: profileError } = await admin.from('user_profiles').upsert({
    id: clientUser.id,
    email: clientUser.email,
    role: 'user',
    created_by: user.id,
    reseller_id: resellerId,
    is_active: true,
    updated_at: now.toISOString(),
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(clientUser.id)

    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from('user_subscriptions')
    .insert({
      user_id: clientUser.id,
      plan_type: 'trial',
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      first_access_at: now.toISOString(),
      is_active: true,
    })
    .select('*')
    .single()

  if (subscriptionError) {
    await admin.from('user_profiles').delete().eq('id', clientUser.id)
    await admin.auth.admin.deleteUser(clientUser.id)

    return NextResponse.json(
      { error: subscriptionError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    client: {
      id: clientUser.id,
      email: clientUser.email,
      created_at: clientUser.created_at,
      profile: {
        id: clientUser.id,
        email: clientUser.email,
        role: 'user',
        created_by: user.id,
        reseller_id: resellerId,
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      subscription: {
        ...subscription,
        is_expired: false,
        days_remaining: TRIAL_DAYS,
      },
    },
  })
}
