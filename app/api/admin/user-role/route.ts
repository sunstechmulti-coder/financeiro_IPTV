import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'admin1@sunstech.com'

type TargetRole = 'reseller' | 'user'

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

function normalizeTargetRole(value: unknown): TargetRole | null {
  if (value === 'reseller' || value === 'user') return value
  return null
}

// PATCH /api/admin/user-role
// Body:
// {
//   userId: string,
//   role: 'reseller' | 'user'
// }
export async function PATCH(req: NextRequest) {
  const { user: adminUser, response } = await requireAdmin()

  if (response || !adminUser) return response

  const body = await req.json()
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const targetRole = normalizeTargetRole(body.role)

  if (!userId) {
    return NextResponse.json(
      { error: 'ID do usuário é obrigatório.' },
      { status: 400 }
    )
  }

  if (!targetRole) {
    return NextResponse.json(
      { error: 'Tipo de acesso inválido.' },
      { status: 400 }
    )
  }

  if (userId === adminUser.id) {
    return NextResponse.json(
      { error: 'Não é possível alterar o tipo da própria conta administradora.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId)

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: 'Usuário não encontrado.' },
      { status: 404 }
    )
  }

  if (authUser.user.email === ADMIN_EMAIL) {
    return NextResponse.json(
      { error: 'Não é possível alterar o tipo da conta administradora principal.' },
      { status: 400 }
    )
  }

  let { data: profile } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) {
    const { data: createdProfile, error: createProfileError } = await admin
      .from('user_profiles')
      .insert({
        id: userId,
        email: authUser.user.email || null,
        role: 'user',
        is_active: true,
      })
      .select('*')
      .single()

    if (createProfileError || !createdProfile) {
      return NextResponse.json(
        { error: createProfileError?.message || 'Erro ao criar perfil do usuário.' },
        { status: 500 }
      )
    }

    profile = createdProfile
  }

  const currentRole = profile.role

  if (currentRole === 'admin') {
    return NextResponse.json(
      { error: 'Não é possível alterar uma conta administradora.' },
      { status: 400 }
    )
  }

  if (currentRole === targetRole) {
    return NextResponse.json({
      success: true,
      changed: false,
      message: 'O usuário já está com este tipo de acesso.',
      profile,
    })
  }

  const now = new Date().toISOString()

  if (targetRole === 'reseller') {
    const { data: updatedProfile, error: profileError } = await admin
      .from('user_profiles')
      .update({
        role: 'reseller',
        reseller_id: null,
        is_active: true,
        updated_at: now,
      })
      .eq('id', userId)
      .select('*')
      .single()

    if (profileError || !updatedProfile) {
      return NextResponse.json(
        { error: profileError?.message || 'Erro ao transformar usuário em revendedor.' },
        { status: 500 }
      )
    }

    const { data: wallet, error: walletError } = await admin
      .from('reseller_wallets')
      .upsert({
        reseller_id: userId,
        balance: 0,
        last_recharge_at: now,
        grace_until: null,
        status: 'active',
        updated_at: now,
      }, {
        onConflict: 'reseller_id',
      })
      .select('*')
      .single()

    if (walletError) {
      // Rollback simples para manter consistência visual se a carteira falhar.
      await admin
        .from('user_profiles')
        .update({
          role: currentRole,
          updated_at: now,
        })
        .eq('id', userId)

      return NextResponse.json(
        { error: walletError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      changed: true,
      profile: updatedProfile,
      wallet,
      message: 'Usuário transformado em revendedor com carteira ativa.',
    })
  }

  // targetRole === 'user'
  // Segurança: não deixa rebaixar revendedor com qualquer cliente vinculado.
  const { count: linkedClientsCount, error: linkedClientsError } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('reseller_id', userId)
    .eq('role', 'user')

  if (linkedClientsError) {
    return NextResponse.json(
      { error: linkedClientsError.message },
      { status: 500 }
    )
  }

  if ((linkedClientsCount || 0) > 0) {
    return NextResponse.json(
      {
        error:
          `Este revendedor possui ${linkedClientsCount} cliente(s) vinculado(s). ` +
          'Remova ou transfira os clientes antes de alterar para usuário comum.',
        linkedClientsCount,
      },
      { status: 400 }
    )
  }

  const { data: updatedProfile, error: profileError } = await admin
    .from('user_profiles')
    .update({
      role: 'user',
      reseller_id: null,
      is_active: true,
      updated_at: now,
    })
    .eq('id', userId)
    .select('*')
    .single()

  if (profileError || !updatedProfile) {
    return NextResponse.json(
      { error: profileError?.message || 'Erro ao transformar revendedor em usuário comum.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    changed: true,
    profile: updatedProfile,
    message: 'Revendedor transformado em usuário comum.',
  })
}
