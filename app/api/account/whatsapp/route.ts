import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'admin1@sunstech.com'

type UserRole = 'admin' | 'reseller' | 'user'

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

function onlyNumbers(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeWhatsapp(value: unknown) {
  const numbers = onlyNumbers(value)

  if (!numbers) return ''

  // Aceita DDI + DDD + número. Ex.: 5541999999999.
  // Não trava com validação agressiva para evitar bloquear formatos válidos.
  if (numbers.length < 10 || numbers.length > 15) {
    return null
  }

  return numbers
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

  if (error) throw error

  return newProfile
}

// GET /api/account/whatsapp
// Retorna o WhatsApp configurado para a conta logada.
export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const admin = createAdminClient()

  try {
    const profile = await getOrCreateProfile(admin, user)

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email || user.email || null,
        role: profile.role,
        whatsapp_number: profile.whatsapp_number || '',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar perfil.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/account/whatsapp
// Body: { whatsappNumber: string }
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const body = await req.json()
  const whatsappNumber = normalizeWhatsapp(body.whatsappNumber)

  if (whatsappNumber === null) {
    return NextResponse.json(
      {
        error:
          'Informe um WhatsApp válido com DDI e DDD. Exemplo: 5541999999999.',
      },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  try {
    const profile = await getOrCreateProfile(admin, user)

    const { data: updatedProfile, error } = await admin
      .from('user_profiles')
      .update({
        whatsapp_number: whatsappNumber || null,
        updated_at: now,
      })
      .eq('id', profile.id)
      .select('id, email, role, whatsapp_number')
      .single()

    if (error || !updatedProfile) {
      return NextResponse.json(
        { error: error?.message || 'Erro ao salvar WhatsApp.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: whatsappNumber
        ? 'WhatsApp salvo com sucesso.'
        : 'WhatsApp removido com sucesso.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar WhatsApp.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
