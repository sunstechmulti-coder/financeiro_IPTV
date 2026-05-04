import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

type UserRole = 'admin' | 'reseller' | 'user'

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function normalizeId(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
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

// POST /api/reseller/renew-client
// Body:
// {
//   clientId: string,
//   planId: '1_month' | '2_months' | '3_months' | '6_months' | '12_months',
//   resellerId?: string // opcional; admin pode informar para testes/gestão
// }
export async function POST(req: NextRequest) {
  const { user, profile, response } = await requireResellerOrAdmin()

  if (response || !user || !profile) {
    return response
  }

  const admin = createAdminClient()
  const body = await req.json()

  const clientId = normalizeId(body.clientId)
  const planId = normalizeId(body.planId)
  const requestedResellerId = normalizeId(body.resellerId)

  const isAdmin = user.email === ADMIN_EMAIL || profile.role === 'admin'

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId é obrigatório.' },
      { status: 400 }
    )
  }

  if (!planId) {
    return NextResponse.json(
      { error: 'planId é obrigatório.' },
      { status: 400 }
    )
  }

  const { data: clientProfile, error: clientProfileError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientProfileError || !clientProfile) {
    return NextResponse.json(
      { error: 'Cliente não encontrado.' },
      { status: 404 }
    )
  }

  if (clientProfile.role !== 'user') {
    return NextResponse.json(
      { error: 'A renovação por créditos só pode ser aplicada em usuário comum.' },
      { status: 400 }
    )
  }

  const resellerId =
    isAdmin && requestedResellerId
      ? requestedResellerId
      : clientProfile.reseller_id || user.id

  if (!resellerId) {
    return NextResponse.json(
      { error: 'Cliente não está vinculado a nenhum revendedor.' },
      { status: 400 }
    )
  }

  if (!isAdmin && resellerId !== user.id) {
    return NextResponse.json(
      { error: 'Você só pode renovar clientes da sua própria revenda.' },
      { status: 403 }
    )
  }

  if (clientProfile.reseller_id !== resellerId) {
    return NextResponse.json(
      { error: 'Este cliente não pertence ao revendedor informado.' },
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
      { error: 'O usuário responsável pelo cliente não é um revendedor.' },
      { status: 400 }
    )
  }

  if (!resellerProfile.is_active) {
    return NextResponse.json(
      { error: 'Revendedor inativo. Não é possível renovar clientes.' },
      { status: 403 }
    )
  }

  const { data: plan, error: planError } = await admin
    .from('reseller_renewal_plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .single()

  if (planError || !plan) {
    return NextResponse.json(
      { error: 'Plano de renovação inválido ou inativo.' },
      { status: 400 }
    )
  }

  const creditsNeeded = Number(plan.credits || 0)
  const daysToAdd = Number(plan.days || 0)

  if (!Number.isFinite(creditsNeeded) || creditsNeeded <= 0) {
    return NextResponse.json(
      { error: 'Plano sem quantidade válida de créditos.' },
      { status: 400 }
    )
  }

  if (!Number.isFinite(daysToAdd) || daysToAdd <= 0) {
    return NextResponse.json(
      { error: 'Plano sem quantidade válida de dias.' },
      { status: 400 }
    )
  }

  const { data: wallet, error: walletError } = await admin
    .from('reseller_wallets')
    .select('*')
    .eq('reseller_id', resellerId)
    .single()

  if (walletError || !wallet) {
    return NextResponse.json(
      { error: 'Carteira do revendedor não encontrada.' },
      { status: 404 }
    )
  }

  if (wallet.status !== 'active') {
    return NextResponse.json(
      {
        error:
          wallet.status === 'grace'
            ? 'Revenda em período de tolerância. Renovações por crédito estão bloqueadas até nova recarga.'
            : 'Revenda bloqueada. Regularize a recarga para renovar clientes.',
      },
      { status: 403 }
    )
  }

  const previousBalance = Number(wallet.balance || 0)

  if (previousBalance < creditsNeeded) {
    return NextResponse.json(
      {
        error: `Saldo insuficiente. Necessário: ${creditsNeeded} crédito(s). Saldo atual: ${previousBalance} crédito(s).`,
      },
      { status: 400 }
    )
  }

  const { data: existingSub } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', clientId)
    .single()

  const now = new Date()
  const nowIso = now.toISOString()

  let baseDate = now

  if (existingSub?.expires_at) {
    const currentExpiration = new Date(existingSub.expires_at)

    if (!Number.isNaN(currentExpiration.getTime()) && currentExpiration > now) {
      baseDate = currentExpiration
    }
  }

  const previousExpiresAt = existingSub?.expires_at || null
  const newExpiresAt = addDays(baseDate, daysToAdd)
  const newBalance = previousBalance - creditsNeeded

  // 1) Desconta créditos primeiro, com proteção contra saldo alterado por outra ação.
  const { data: updatedWallet, error: walletUpdateError } = await admin
    .from('reseller_wallets')
    .update({
      balance: newBalance,
      updated_at: nowIso,
    })
    .eq('reseller_id', resellerId)
    .eq('balance', previousBalance)
    .select('*')
    .single()

  if (walletUpdateError || !updatedWallet) {
    return NextResponse.json(
      {
        error:
          'Não foi possível descontar os créditos. Atualize a página e tente novamente.',
      },
      { status: 409 }
    )
  }

  // 2) Registra histórico da saída de créditos.
  const { data: ledgerEntry, error: ledgerError } = await admin
    .from('reseller_credit_ledger')
    .insert({
      reseller_id: resellerId,
      type: 'renewal',
      amount: -creditsNeeded,
      balance_after: newBalance,
      target_user_id: clientId,
      created_by: user.id,
      note: `Renovação de ${clientProfile.email || 'cliente'} por ${plan.label}.`,
      metadata: {
        plan_id: plan.id,
        plan_label: plan.label,
        plan_days: daysToAdd,
        credits_used: creditsNeeded,
        previous_expires_at: previousExpiresAt,
        new_expires_at: newExpiresAt.toISOString(),
      },
    })
    .select('*')
    .single()

  if (ledgerError || !ledgerEntry) {
    await admin
      .from('reseller_wallets')
      .update({
        balance: previousBalance,
        updated_at: nowIso,
      })
      .eq('reseller_id', resellerId)

    return NextResponse.json(
      {
        error:
          'Erro ao registrar histórico de créditos. A carteira foi revertida.',
      },
      { status: 500 }
    )
  }

  // 3) Atualiza ou cria assinatura do cliente.
  let savedSubscription = null
  let subscriptionError = null

  if (existingSub) {
    const { data, error } = await admin
      .from('user_subscriptions')
      .update({
        plan_type: plan.id,
        expires_at: newExpiresAt.toISOString(),
        first_access_at: existingSub.first_access_at || nowIso,
        is_active: true,
        updated_at: nowIso,
      })
      .eq('user_id', clientId)
      .select('*')
      .single()

    savedSubscription = data
    subscriptionError = error
  } else {
    const { data, error } = await admin
      .from('user_subscriptions')
      .insert({
        user_id: clientId,
        plan_type: plan.id,
        started_at: nowIso,
        expires_at: newExpiresAt.toISOString(),
        first_access_at: nowIso,
        is_active: true,
      })
      .select('*')
      .single()

    savedSubscription = data
    subscriptionError = error
  }

  if (subscriptionError || !savedSubscription) {
    await admin
      .from('reseller_wallets')
      .update({
        balance: previousBalance,
        updated_at: nowIso,
      })
      .eq('reseller_id', resellerId)

    await admin
      .from('reseller_credit_ledger')
      .delete()
      .eq('id', ledgerEntry.id)

    return NextResponse.json(
      {
        error:
          'Erro ao renovar assinatura. Os créditos foram revertidos.',
      },
      { status: 500 }
    )
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((newExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  )

  return NextResponse.json({
    success: true,
    client: {
      id: clientProfile.id,
      email: clientProfile.email,
      reseller_id: resellerId,
    },
    plan: {
      id: plan.id,
      label: plan.label,
      days: daysToAdd,
      credits: creditsNeeded,
    },
    wallet: updatedWallet,
    ledger: ledgerEntry,
    subscription: {
      ...savedSubscription,
      is_expired: false,
      days_remaining: daysRemaining,
    },
  })
}
