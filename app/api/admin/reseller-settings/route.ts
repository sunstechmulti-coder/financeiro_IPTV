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

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return null
  if (!Number.isInteger(parsed)) return null
  if (parsed <= 0) return null

  return parsed
}

function normalizeNonNegativeInteger(value: unknown) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return null
  if (!Number.isInteger(parsed)) return null
  if (parsed < 0) return null

  return parsed
}

async function ensureSettings(admin: ReturnType<typeof createAdminClient>) {
  const { data: existing } = await admin
    .from('reseller_settings')
    .select('*')
    .eq('id', 'default')
    .single()

  if (existing) return existing

  const { data: created, error } = await admin
    .from('reseller_settings')
    .insert({
      id: 'default',
      recharge_deadline_days: 60,
      grace_days: 30,
    })
    .select('*')
    .single()

  if (error) throw error

  return created
}

// GET /api/admin/reseller-settings
// Retorna as configurações atuais da revenda.
export async function GET() {
  const { response } = await requireAdmin()

  if (response) return response

  const admin = createAdminClient()

  try {
    const settings = await ensureSettings(admin)

    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar configurações.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/admin/reseller-settings
// Body:
// {
//   rechargeDeadlineDays: number,
//   graceDays?: number
// }
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAdmin()

  if (response || !user) return response

  const body = await req.json()

  const rechargeDeadlineDays = normalizePositiveInteger(body.rechargeDeadlineDays)
  const graceDays =
    body.graceDays === undefined || body.graceDays === null
      ? null
      : normalizeNonNegativeInteger(body.graceDays)

  if (!rechargeDeadlineDays) {
    return NextResponse.json(
      { error: 'Informe um prazo de recarga válido, em dias.' },
      { status: 400 }
    )
  }

  if (body.graceDays !== undefined && body.graceDays !== null && graceDays === null) {
    return NextResponse.json(
      { error: 'Informe um período de tolerância válido, em dias.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const updatePayload: Record<string, unknown> = {
    recharge_deadline_days: rechargeDeadlineDays,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (graceDays !== null) {
    updatePayload.grace_days = graceDays
  }

  const { data: settings, error } = await admin
    .from('reseller_settings')
    .upsert({
      id: 'default',
      ...updatePayload,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    settings,
  })
}
