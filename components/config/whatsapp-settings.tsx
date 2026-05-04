'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, MessageCircle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type UserRole = 'admin' | 'reseller' | 'user'

interface AccountProfile {
  id: string
  email: string | null
  role: UserRole
  whatsapp_number: string | null
}

function onlyNumbers(value: string) {
  return value.replace(/\D/g, '')
}

function getDescription(role?: UserRole | null) {
  if (role === 'admin') {
    return 'Este número será usado quando um usuário comum sem revendedor solicitar renovação.'
  }

  if (role === 'reseller') {
    return 'Este número será usado pelos seus clientes quando eles solicitarem renovação.'
  }

  return 'Seu WhatsApp cadastrado na conta.'
}

export function WhatsappSettings() {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await fetch('/api/account/whatsapp')
        const json = await res.json()

        if (!res.ok) {
          setError(json.error || 'Erro ao carregar WhatsApp.')
          return
        }

        if (!cancelled) {
          setProfile(json.profile)
          setWhatsappNumber(json.profile?.whatsapp_number || '')
        }
      } catch {
        if (!cancelled) {
          setError('Erro ao conectar ao servidor.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    const normalized = onlyNumbers(whatsappNumber)

    if (normalized && (normalized.length < 10 || normalized.length > 15)) {
      setError('Informe um WhatsApp válido com DDI e DDD. Exemplo: 5541999999999.')
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/account/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNumber: normalized,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Erro ao salvar WhatsApp.')
        return
      }

      setProfile(json.profile)
      setWhatsappNumber(json.profile?.whatsapp_number || '')
      setSuccess(json.message || 'WhatsApp salvo com sucesso.')

      setTimeout(() => setSuccess(''), 2500)
    } catch {
      setError('Erro ao conectar ao servidor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="h-4 w-4 text-green-500" />
          WhatsApp de Renovação
        </CardTitle>
        <CardDescription>
          {getDescription(profile?.role)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando WhatsApp...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="account-whatsapp">Número do WhatsApp</Label>
              <Input
                id="account-whatsapp"
                inputMode="numeric"
                placeholder="Ex.: 5541999999999"
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(onlyNumbers(event.target.value))}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Use apenas números, com DDI e DDD. Exemplo: 55 + DDD + número.
              </p>
            </div>

            {profile?.role === 'reseller' && (
              <div className="rounded-md border border-green-500/20 bg-green-500/10 p-3 text-xs text-muted-foreground">
                Clientes vinculados à sua revenda serão direcionados para este WhatsApp ao clicar em renovar.
              </div>
            )}

            {profile?.role === 'admin' && (
              <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-muted-foreground">
                Usuários sem revendedor e revendedores bloqueados serão direcionados para este WhatsApp.
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                <Check className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar WhatsApp
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
