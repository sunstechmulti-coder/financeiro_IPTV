import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'admin1@sunstech.com'

const DAY_MS = 24 * 60 * 60 * 1000
const TRIAL_DAYS = 30
const DEFAULT_RESELLER_ACTIVE_DAYS = 60
const DEFAULT_RESELLER_GRACE_DAYS = 30

type UserRole = 'admin' | 'reseller' | 'user'
type ResellerStatus = 'active' | 'grace' | 'blocked'

interface ResellerSettings {
  recharge_deadline_days: number
  grace_days: number
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function getDaysRemaining(targetDate: Date, now = new Date()) {
  if (Number.isNaN(targetDate.getTime())) return 0

  return Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / DAY_MS))
}

function getSubscriptionStatus(subscription: any) {
  if (!subscription?.expires_at) {
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

  return {
    is_expired: expiresAt < now,
    days_remaining: getDaysRemaining(expiresAt, now),
  }
}

async function getResellerSettings(
  admin: ReturnType<typeof createAdminClient>
): Promise<ResellerSettings> {
  const fallback = {
    recharge_deadline_days: DEFAULT_RESELLER_ACTIVE_DAYS,
    grace_days: DEFAULT_RESELLER_GRACE_DAYS,
  }

  const { data } = await admin
    .from('reseller_settings')
    .select('recharge_deadline_days, grace_days')
    .eq('id', 'default')
    .single()

  const rechargeDeadlineDays = Number(data?.recharge_deadline_days)
  const graceDays = Number(data?.grace_days)

  return {
    recharge_deadline_days:
      Number.isFinite(rechargeDeadlineDays) && rechargeDeadlineDays > 0
        ? rechargeDeadlineDays
        : fallback.recharge_deadline_days,
    grace_days:
      Number.isFinite(graceDays) && graceDays >= 0
        ? graceDays
        : fallback.grace_days,
  }
}

async function getOrCreateProfile(
  admin: ReturnType<typeof createAdminClient>,
  user: any
) {
  const { data: profile } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile) return profile

  const role: UserRole = user.email === ADMIN_EMAIL ? 'admin' : 'user'

  const { data: newProfile, error } = await admin
    .from('user_profiles')
    .insert({
      id: user.id,
      email: user.email || null,
      role,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) return null

  return newProfile
}

function calculateResellerStatus(
  wallet: any,
  settings: ResellerSettings,
  now = new Date()
) {
  const activeDays = settings.recharge_deadline_days
  const graceDays = settings.grace_days
  const blockDays = activeDays + graceDays

  const rawBaseDate = wallet?.last_recharge_at || wallet?.created_at
  const baseDate = rawBaseDate ? new Date(rawBaseDate) : now

  if (Number.isNaN(baseDate.getTime())) {
    const fallbackDeadline = addDays(now, activeDays)

    return {
      status: 'active' as ResellerStatus,
      rechargeDeadlineAt: fallbackDeadline,
      graceUntil: null as Date | null,
      daysUntilRechargeDeadline: activeDays,
      graceDaysRemaining: 0,
      activeDays,
      graceDays,
    }
  }

  const rechargeDeadlineAt = addDays(baseDate, activeDays)
  const blockAt = addDays(baseDate, blockDays)

  if (now.getTime() <= rechargeDeadlineAt.getTime()) {
    return {
      status: 'active' as ResellerStatus,
      rechargeDeadlineAt,
      graceUntil: null as Date | null,
      daysUntilRechargeDeadline: getDaysRemaining(rechargeDeadlineAt, now),
      graceDaysRemaining: 0,
      activeDays,
      graceDays,
    }
  }

  if (now.getTime() <= blockAt.getTime()) {
    return {
      status: 'grace' as ResellerStatus,
      rechargeDeadlineAt,
      graceUntil: blockAt,
      daysUntilRechargeDeadline: 0,
      graceDaysRemaining: getDaysRemaining(blockAt, now),
      activeDays,
      graceDays,
    }
  }

  return {
    status: 'blocked' as ResellerStatus,
    rechargeDeadlineAt,
    graceUntil: blockAt,
    daysUntilRechargeDeadline: 0,
    graceDaysRemaining: 0,
    activeDays,
    graceDays,
  }
}

async function getOrCreateAndSyncResellerWallet(
  admin: ReturnType<typeof createAdminClient>,
  resellerId: string,
  settings: ResellerSettings
) {
  let { data: wallet } = await admin
    .from('reseller_wallets')
    .select('*')
    .eq('reseller_id', resellerId)
    .single()

  if (!wallet) {
    const { data: newWallet } = await admin
      .from('reseller_wallets')
      .insert({
        reseller_id: resellerId,
        balance: 0,
        status: 'active',
      })
      .select('*')
      .single()

    wallet = newWallet
  }

  if (!wallet) return null

  const statusInfo = calculateResellerStatus(wallet, settings)
  const graceUntilIso = statusInfo.graceUntil
    ? statusInfo.graceUntil.toISOString()
    : null

  const currentGraceUntil = wallet.grace_until || null

  const needsUpdate =
    wallet.status !== statusInfo.status ||
    currentGraceUntil !== graceUntilIso

  if (needsUpdate) {
    const { data: updatedWallet } = await admin
      .from('reseller_wallets')
      .update({
        status: statusInfo.status,
        grace_until: graceUntilIso,
        updated_at: new Date().toISOString(),
      })
      .eq('reseller_id', resellerId)
      .select('*')
      .single()

    if (updatedWallet) {
      wallet = updatedWallet
    }
  }

  return {
    wallet,
    statusInfo,
  }
}

function buildResellerExtraFields(
  resellerAccess: Awaited<ReturnType<typeof getOrCreateAndSyncResellerWallet>> | null
) {
  if (!resellerAccess) {
    return {
      reseller_status: null,
      reseller_wallet: null,
      reseller_days_until_recharge_deadline: null,
      reseller_grace_days_remaining: null,
      reseller_grace_until: null,
      reseller_recharge_deadline_at: null,
      reseller_recharge_deadline_days: null,
      reseller_grace_days: null,
    }
  }

  return {
    reseller_status: resellerAccess.statusInfo.status,
    reseller_wallet: resellerAccess.wallet,
    reseller_days_until_recharge_deadline:
      resellerAccess.statusInfo.daysUntilRechargeDeadline,
    reseller_grace_days_remaining:
      resellerAccess.statusInfo.graceDaysRemaining,
    reseller_grace_until:
      resellerAccess.statusInfo.graceUntil?.toISOString() || null,
    reseller_recharge_deadline_at:
      resellerAccess.statusInfo.rechargeDeadlineAt.toISOString(),
    reseller_recharge_deadline_days: resellerAccess.statusInfo.activeDays,
    reseller_grace_days: resellerAccess.statusInfo.graceDays,
  }
}

function getAccessMode(userRole: UserRole, resellerStatus?: ResellerStatus | null) {
  if (userRole === 'admin') return 'admin'
  if (userRole !== 'reseller') return 'user'

  if (resellerStatus === 'blocked') return 'blocked'
  if (resellerStatus === 'grace') return 'user_only'

  return 'reseller'
}

// GET /api/subscription — retorna a subscription do usuário logado
export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Admin nunca expira
  if (user.email === ADMIN_EMAIL) {
    return NextResponse.json({
      subscription: {
        id: 'admin',
        user_id: user.id,
        plan_type: 'admin',
        started_at: user.created_at,
        expires_at: null,
        first_access_at: user.created_at,
        is_active: true,
        is_expired: false,
        days_remaining: 999999,
        user_role: 'admin',
        access_mode: 'admin',
      },
    })
  }

  const profile = await getOrCreateProfile(admin, user)
  const userRole: UserRole = (profile?.role as UserRole) || 'user'

  const resellerSettings = await getResellerSettings(admin)

  let resellerAccess:
    | Awaited<ReturnType<typeof getOrCreateAndSyncResellerWallet>>
    | null = null

  if (userRole === 'reseller') {
    resellerAccess = await getOrCreateAndSyncResellerWallet(
      admin,
      user.id,
      resellerSettings
    )
  }

  const resellerStatus = resellerAccess?.statusInfo.status || null
  const accessMode = getAccessMode(userRole, resellerStatus)
  const resellerExtraFields = buildResellerExtraFields(resellerAccess)

  if (userRole === 'reseller' && accessMode === 'blocked') {
    const blockedAt =
      resellerAccess?.statusInfo.graceUntil ||
      resellerAccess?.statusInfo.rechargeDeadlineAt ||
      new Date()

    return NextResponse.json({
      subscription: {
        id: 'reseller-blocked',
        user_id: user.id,
        plan_type: 'reseller_blocked',
        started_at: user.created_at,
        expires_at: blockedAt.toISOString(),
        first_access_at: user.created_at,
        is_active: false,
        is_expired: true,
        days_remaining: 0,
        user_role: 'reseller',
        access_mode: 'blocked',
        ...resellerExtraFields,
        reseller_message:
          'Sua revenda está bloqueada por falta de recarga. Faça uma nova recarga para reativar o painel.',
      },
    })
  }

  // Buscar subscription do usuário
  const { data: subscription } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!subscription) {
    const now = new Date()

    const { data: newSub, error } = await admin
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_type: 'trial',
        started_at: now.toISOString(),
        expires_at: null,
        first_access_at: null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      subscription: {
        ...newSub,
        is_expired: false,
        days_remaining: 0,
        user_role: userRole,
        access_mode: accessMode,
        ...resellerExtraFields,
      },
    })
  }

  if (!subscription.first_access_at) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS)

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

    return NextResponse.json({
      subscription: {
        ...updatedSub,
        is_expired: false,
        days_remaining: userRole === 'reseller' ? 0 : TRIAL_DAYS,
        user_role: userRole,
        access_mode: accessMode,
        ...resellerExtraFields,
      },
      firstAccess: true,
    })
  }

  const subscriptionStatus = getSubscriptionStatus(subscription)

  // Regra importante:
  // Revendedor ativo ou em tolerância NÃO deve ser bloqueado pela assinatura antiga/trial.
  // O bloqueio do revendedor vem apenas da regra de recarga: active / grace / blocked.
  const safeSubscriptionStatus =
    userRole === 'reseller'
      ? {
          is_expired: false,
          days_remaining: resellerAccess?.statusInfo.daysUntilRechargeDeadline || 0,
        }
      : subscriptionStatus

  return NextResponse.json({
    subscription: {
      ...subscription,
      ...safeSubscriptionStatus,
      user_role: userRole,
      access_mode: accessMode,
      ...resellerExtraFields,
    },
  })
}
