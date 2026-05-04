import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'admin1@sunstech.com'

type CreditAction = 'add' | 'remove'

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

function normalizeAmount(value: unknown) {
  const amount = Number(value)

  if (!Number.isFinite(amount)) return null
  if (!Number.isInteger(amount)) return null
  if (amount <= 0) return null

  return amount
}

async function requireAdmin() {
  const user = await getSessionUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }),
    }
  }

  return { user, response: null }
}

// GET /api/admin/reseller-credits?resellerId=...
// Retorna carteira e histórico de créditos do revendedor
export async function GET(req: NextRequest) {
  const { user, response } = await requireAdmin()

  if (response || !user) {
    return response
  }

  const resellerId = req.nextUrl.searchParams.get('resellerId')

  if (!resellerId) {
    return NextResponse.json(
      { error: 'resellerId é obrigatório.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active')
    .eq('id', resellerId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Revendedor não encontrado.' },
      { status: 404 }
    )
  }

  if (profile.role !== 'reseller') {
    return NextResponse.json(
      { error: 'O usuário informado não é um revendedor.' },
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

  const { data: ledger, error: ledgerError } = await admin
    .from('reseller_credit_ledger')
    .select('*')
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (ledgerError) {
    return NextResponse.json(
      { error: ledgerError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    reseller: profile,
    wallet,
    ledger: ledger || [],
  })
}

// POST /api/admin/reseller-credits
// Body:
// {
//   resellerId: string,
//   action: 'add' | 'remove',
//   amount: number,
//   note?: string
// }
export async function POST(req: NextRequest) {
  const { user, response } = await requireAdmin()

  if (response || !user) {
    return response
  }

  const body = await req.json()
  const resellerId = String(body.resellerId || '').trim()
  const action = String(body.action || '').trim() as CreditAction
  const amount = normalizeAmount(body.amount)
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (!resellerId) {
    return NextResponse.json(
      { error: 'resellerId é obrigatório.' },
      { status: 400 }
    )
  }

  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json(
      { error: 'A ação deve ser add ou remove.' },
      { status: 400 }
    )
  }

  if (!amount) {
    return NextResponse.json(
      { error: 'Informe uma quantidade válida de créditos.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active')
    .eq('id', resellerId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Revendedor não encontrado.' },
      { status: 404 }
    )
  }

  if (profile.role !== 'reseller') {
    return NextResponse.json(
      { error: 'O usuário informado não é um revendedor.' },
      { status: 400 }
    )
  }

  let { data: wallet, error: walletError } = await admin
    .from('reseller_wallets')
    .select('*')
    .eq('reseller_id', resellerId)
    .single()

  if (walletError || !wallet) {
    const { data: newWallet, error: createWalletError } = await admin
      .from('reseller_wallets')
      .insert({
        reseller_id: resellerId,
        balance: 0,
        status: 'active',
      })
      .select('*')
      .single()

    if (createWalletError || !newWallet) {
      return NextResponse.json(
        {
          error:
            createWalletError?.message ||
            'Erro ao criar carteira do revendedor.',
        },
        { status: 500 }
      )
    }

    wallet = newWallet
  }

  const previousBalance = Number(wallet.balance || 0)
  const signedAmount = action === 'add' ? amount : -amount
  const newBalance = previousBalance + signedAmount

  if (newBalance < 0) {
    return NextResponse.json(
      {
        error: `Saldo insuficiente. Saldo atual: ${previousBalance} crédito(s).`,
      },
      { status: 400 }
    )
  }

  const previousWalletState = {
    balance: previousBalance,
    last_recharge_at: wallet.last_recharge_at,
    grace_until: wallet.grace_until,
    status: wallet.status,
  }

  const walletUpdate: Record<string, unknown> = {
    balance: newBalance,
    updated_at: now,
  }

  if (action === 'add') {
    walletUpdate.last_recharge_at = now
    walletUpdate.grace_until = null
    walletUpdate.status = 'active'
  }

  const { data: updatedWallet, error: updateWalletError } = await admin
    .from('reseller_wallets')
    .update(walletUpdate)
    .eq('reseller_id', resellerId)
    .select('*')
    .single()

  if (updateWalletError || !updatedWallet) {
    return NextResponse.json(
      {
        error:
          updateWalletError?.message ||
          'Erro ao atualizar carteira do revendedor.',
      },
      { status: 500 }
    )
  }

  const ledgerType = action === 'add' ? 'admin_add' : 'admin_remove'

  const { data: ledgerEntry, error: ledgerError } = await admin
    .from('reseller_credit_ledger')
    .insert({
      reseller_id: resellerId,
      type: ledgerType,
      amount: signedAmount,
      balance_after: newBalance,
      target_user_id: null,
      created_by: user.id,
      note:
        note ||
        (action === 'add'
          ? `Admin adicionou ${amount} crédito(s).`
          : `Admin removeu ${amount} crédito(s).`),
      metadata: {
        action,
        previous_balance: previousBalance,
        new_balance: newBalance,
      },
    })
    .select('*')
    .single()

  if (ledgerError) {
    await admin
      .from('reseller_wallets')
      .update({
        balance: previousWalletState.balance,
        last_recharge_at: previousWalletState.last_recharge_at,
        grace_until: previousWalletState.grace_until,
        status: previousWalletState.status,
        updated_at: now,
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

  return NextResponse.json({
    success: true,
    reseller: profile,
    wallet: updatedWallet,
    ledger: ledgerEntry,
  })
}