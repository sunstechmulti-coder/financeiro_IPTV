import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

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

function normalizeId(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

async function listActiveResellers(admin: ReturnType<typeof createAdminClient>) {
  const { data: profiles, error } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active, created_at')
    .eq('role', 'reseller')
    .eq('is_active', true)
    .order('email', { ascending: true })

  if (error) throw error

  const resellerIds = (profiles || []).map((profile) => profile.id)

  let wallets: any[] = []

  if (resellerIds.length > 0) {
    const { data: walletRows, error: walletError } = await admin
      .from('reseller_wallets')
      .select('*')
      .in('reseller_id', resellerIds)

    if (walletError) throw walletError

    wallets = walletRows || []
  }

  const walletMap = new Map(wallets.map((wallet) => [wallet.reseller_id, wallet]))

  return (profiles || []).map((profile) => ({
    ...profile,
    reseller_wallet: walletMap.get(profile.id) || null,
  }))
}

// GET /api/admin/client-reseller?clientId=...
// Retorna dados do cliente e lista de revendedores disponíveis para migração.
export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()

  if (response) return response

  const admin = createAdminClient()
  const clientId = req.nextUrl.searchParams.get('clientId')

  try {
    const resellers = await listActiveResellers(admin)

    if (!clientId) {
      return NextResponse.json({
        client: null,
        current_reseller: null,
        resellers,
      })
    }

    const { data: client, error: clientError } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado.' },
        { status: 404 }
      )
    }

    if (client.role !== 'user') {
      return NextResponse.json(
        { error: 'Apenas usuários comuns podem ser migrados entre revendedores.' },
        { status: 400 }
      )
    }

    let currentReseller = null

    if (client.reseller_id) {
      const { data } = await admin
        .from('user_profiles')
        .select('id, email, role, is_active')
        .eq('id', client.reseller_id)
        .single()

      currentReseller = data || null
    }

    return NextResponse.json({
      client,
      current_reseller: currentReseller,
      resellers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar dados de migração.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/admin/client-reseller
// Body:
// {
//   clientId: string,
//   resellerId: string
// }
export async function PATCH(req: NextRequest) {
  const { user: adminUser, response } = await requireAdmin()

  if (response || !adminUser) return response

  const admin = createAdminClient()
  const body = await req.json()

  const clientId = normalizeId(body.clientId)
  const resellerId = normalizeId(body.resellerId)

  if (!clientId) {
    return NextResponse.json(
      { error: 'ID do cliente é obrigatório.' },
      { status: 400 }
    )
  }

  if (!resellerId) {
    return NextResponse.json(
      { error: 'Selecione o revendedor de destino.' },
      { status: 400 }
    )
  }

  if (clientId === resellerId) {
    return NextResponse.json(
      { error: 'Cliente e revendedor de destino não podem ser a mesma conta.' },
      { status: 400 }
    )
  }

  const { data: client, error: clientError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return NextResponse.json(
      { error: 'Cliente não encontrado.' },
      { status: 404 }
    )
  }

  if (client.role !== 'user') {
    return NextResponse.json(
      { error: 'Apenas usuários comuns podem ser migrados entre revendedores.' },
      { status: 400 }
    )
  }

  const { data: targetReseller, error: targetError } = await admin
    .from('user_profiles')
    .select('id, email, role, is_active')
    .eq('id', resellerId)
    .single()

  if (targetError || !targetReseller) {
    return NextResponse.json(
      { error: 'Revendedor de destino não encontrado.' },
      { status: 404 }
    )
  }

  if (targetReseller.role !== 'reseller') {
    return NextResponse.json(
      { error: 'A conta de destino não é um revendedor.' },
      { status: 400 }
    )
  }

  if (!targetReseller.is_active) {
    return NextResponse.json(
      { error: 'O revendedor de destino está inativo.' },
      { status: 400 }
    )
  }

  const previousResellerId = client.reseller_id || null

  if (previousResellerId === resellerId) {
    return NextResponse.json({
      success: true,
      changed: false,
      message: 'Este cliente já está vinculado a este revendedor.',
      client,
      previous_reseller_id: previousResellerId,
      new_reseller: targetReseller,
    })
  }

  // Garante que o revendedor de destino tem carteira.
  const { data: existingWallet } = await admin
    .from('reseller_wallets')
    .select('*')
    .eq('reseller_id', resellerId)
    .single()

  if (!existingWallet) {
    const { error: walletError } = await admin
      .from('reseller_wallets')
      .insert({
        reseller_id: resellerId,
        balance: 0,
        status: 'active',
        last_recharge_at: new Date().toISOString(),
      })

    if (walletError) {
      return NextResponse.json(
        { error: walletError.message },
        { status: 500 }
      )
    }
  }

  const now = new Date().toISOString()

  const { data: updatedClient, error: updateError } = await admin
    .from('user_profiles')
    .update({
      reseller_id: resellerId,
      updated_at: now,
    })
    .eq('id', clientId)
    .select('*')
    .single()

  if (updateError || !updatedClient) {
    return NextResponse.json(
      { error: updateError?.message || 'Erro ao migrar cliente.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    changed: true,
    message: `Cliente migrado para ${targetReseller.email}.`,
    client: updatedClient,
    previous_reseller_id: previousResellerId,
    new_reseller: targetReseller,
  })
}
