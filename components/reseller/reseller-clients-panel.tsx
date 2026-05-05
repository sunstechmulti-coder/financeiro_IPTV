'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Store,
  UserPlus,
  Users,
  Wallet,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ResellerStatus = 'active' | 'grace' | 'blocked'

interface ResellerWallet {
  id: string
  reseller_id: string
  balance: number
  last_recharge_at: string | null
  grace_until: string | null
  status: ResellerStatus
  created_at: string
  updated_at: string
}

interface ClientSubscription {
  id: string
  user_id: string
  plan_type: string
  started_at: string
  expires_at: string | null
  first_access_at: string | null
  is_active: boolean
  is_expired?: boolean
  days_remaining?: number
}

interface ResellerClient {
  id: string
  email: string | null
  created_at: string
  subscription: ClientSubscription | null
}

interface RenewalPlan {
  id: string
  label: string
  days: number
  credits: number
}

interface AdminContact {
  id: string | null
  email: string | null
  whatsappNumber: string | null
}

const STATUS_LABELS: Record<ResellerStatus, string> = {
  active: 'Ativo',
  grace: 'Tolerância',
  blocked: 'Bloqueado',
}

const RENEWAL_PLANS: RenewalPlan[] = [
  { id: '1_month', label: '1 mês', days: 30, credits: 1 },
  { id: '2_months', label: '2 meses', days: 60, credits: 2 },
  { id: '3_months', label: '3 meses', days: 90, credits: 3 },
  { id: '6_months', label: '6 meses', days: 180, credits: 5 },
  { id: '12_months', label: '12 meses', days: 365, credits: 10 },
]

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'

  const date = new Date(dateStr)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('pt-BR')
}

function normalizeWhatsappNumber(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

function getSubscriptionBadge(subscription: ClientSubscription | null) {
  if (!subscription) {
    return (
      <Badge variant="outline" className="text-xs">
        Sem plano
      </Badge>
    )
  }

  const daysRemaining = subscription.days_remaining ?? 0

  if (subscription.is_expired || daysRemaining <= 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Expirado
      </Badge>
    )
  }

  if (daysRemaining <= 7) {
    return (
      <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
        {daysRemaining}d restantes
      </Badge>
    )
  }

  if (daysRemaining <= 15) {
    return (
      <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        {daysRemaining}d restantes
      </Badge>
    )
  }

  if (subscription.plan_type === 'trial') {
    return (
      <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
        Teste - {daysRemaining}d
      </Badge>
    )
  }

  return (
    <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
      Ativo - {daysRemaining}d
    </Badge>
  )
}

function getWalletStatusBadge(wallet: ResellerWallet | null) {
  if (!wallet) {
    return (
      <Badge variant="outline" className="border-orange-500/40 text-orange-400">
        Sem carteira
      </Badge>
    )
  }

  const statusClass =
    wallet.status === 'blocked'
      ? 'bg-destructive/20 text-destructive border-destructive/30'
      : wallet.status === 'grace'
        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'

  return (
    <Badge className={statusClass}>
      {STATUS_LABELS[wallet.status]}
    </Badge>
  )
}

export function ResellerClientsPanel() {
  const [clients, setClients] = useState<ResellerClient[]>([])
  const [wallet, setWallet] = useState<ResellerWallet | null>(null)
  const [adminContact, setAdminContact] = useState<AdminContact | null>(null)
  const [resellerEmail, setResellerEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [renewingClient, setRenewingClient] = useState<ResellerClient | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('1_month')
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState('')
  const [renewSuccess, setRenewSuccess] = useState('')

  const fetchClients = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const res = await fetch('/api/reseller/clients')
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Erro ao carregar clientes.')
        return
      }

      setClients(json.clients || [])
      setWallet(json.wallet || null)
      setAdminContact(json.adminContact || null)
      setResellerEmail(json.reseller?.email || '')
    } catch {
      setError('Erro ao conectar ao servidor.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const stats = useMemo(() => {
    const active = clients.filter((client) => {
      const sub = client.subscription
      return sub && !sub.is_expired && (sub.days_remaining ?? 0) > 7
    }).length

    const expiring = clients.filter((client) => {
      const sub = client.subscription
      const days = sub?.days_remaining ?? 0
      return sub && !sub.is_expired && days > 0 && days <= 7
    }).length

    const expired = clients.filter((client) => {
      const sub = client.subscription
      return !sub || sub.is_expired || (sub.days_remaining ?? 0) <= 0
    }).length

    return {
      total: clients.length,
      active,
      expiring,
      expired,
    }
  }, [clients])

  const walletBalance = Number(wallet?.balance ?? 0)
  const walletStatusLabel = wallet ? STATUS_LABELS[wallet.status] : 'Sem carteira'

  const rechargeWhatsappUrl = useMemo(() => {
    const phone = normalizeWhatsappNumber(adminContact?.whatsappNumber)

    if (!phone) return ''

    const message = [
      'Olá, preciso solicitar recarga de créditos para minha conta de revendedor.',
      '',
      `E-mail: ${resellerEmail || 'não informado'}`,
      `Saldo atual: ${walletBalance} crédito(s)`,
      `Status: ${walletStatusLabel}`,
    ].join('\n')

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }, [adminContact?.whatsappNumber, resellerEmail, walletBalance, walletStatusLabel])

  const canCreateClient = wallet?.status === 'active' && walletBalance > 0
  const canRenewClient = wallet?.status === 'active'

  const selectedPlan = useMemo(() => {
    return RENEWAL_PLANS.find((plan) => plan.id === selectedPlanId) || RENEWAL_PLANS[0]
  }, [selectedPlanId])

  const hasEnoughCredits = walletBalance >= selectedPlan.credits

  const handleRequestRecharge = () => {
    if (!rechargeWhatsappUrl) return

    window.open(rechargeWhatsappUrl, '_blank', 'noopener,noreferrer')
  }

  const handleCreateClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setCreateError('')
    setCreateSuccess('')
    setCreating(true)

    try {
      const res = await fetch('/api/reseller/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setCreateError(json.error || 'Erro ao criar cliente.')
        return
      }

      setCreateSuccess(`Cliente ${json.client.email} criado com teste de 30 dias.`)
      setNewEmail('')
      setNewPassword('')
      await fetchClients(true)

      setTimeout(() => {
        setDialogOpen(false)
        setCreateSuccess('')
      }, 1500)
    } catch {
      setCreateError('Erro ao conectar ao servidor.')
    } finally {
      setCreating(false)
    }
  }

  const openRenewDialog = (client: ResellerClient) => {
    setRenewingClient(client)
    setSelectedPlanId('1_month')
    setRenewError('')
    setRenewSuccess('')
    setRenewDialogOpen(true)
  }

  const handleRenewClient = async () => {
    if (!renewingClient) return

    setRenewError('')
    setRenewSuccess('')
    setRenewing(true)

    try {
      const res = await fetch('/api/reseller/renew-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: renewingClient.id,
          planId: selectedPlanId,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setRenewError(json.error || 'Erro ao renovar cliente.')
        return
      }

      setRenewSuccess(
        `Cliente renovado por ${json.plan.label}. Foram usados ${json.plan.credits} crédito(s).`
      )

      await fetchClients(true)

      setTimeout(() => {
        setRenewDialogOpen(false)
        setRenewingClient(null)
        setSelectedPlanId('1_month')
        setRenewSuccess('')
      }, 1500)
    } catch {
      setRenewError('Erro ao conectar ao servidor.')
    } finally {
      setRenewing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando clientes...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Store className="h-4 w-4" />
            Meus Clientes
          </h3>
          <p className="text-sm text-muted-foreground">
            Cadastre, acompanhe e renove os clientes vinculados à sua revenda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={walletBalance <= 0 ? 'default' : 'outline'}
            size="sm"
            onClick={handleRequestRecharge}
            disabled={!rechargeWhatsappUrl}
            title={
              !rechargeWhatsappUrl
                ? 'WhatsApp do administrador não configurado.'
                : 'Solicitar recarga de créditos pelo WhatsApp.'
            }
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Solicitar Recarga
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchClients(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)

              if (!open) {
                setNewEmail('')
                setNewPassword('')
                setCreateError('')
                setCreateSuccess('')
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canCreateClient}>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Cliente</DialogTitle>
                <DialogDescription>
                  O cliente será vinculado à sua revenda e receberá teste de 30 dias.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateClient} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="client-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="client-email"
                      type="email"
                      placeholder="cliente@email.com"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      className="pl-9"
                      disabled={creating}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="client-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="pr-10"
                      disabled={creating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {createError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </div>
                )}

                {createSuccess && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <Check className="h-4 w-4 shrink-0" />
                    {createSuccess}
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar Cliente
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!adminContact?.whatsappNumber && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          WhatsApp do administrador não configurado. Cadastre o número no painel admin para liberar a solicitação de recarga.
        </div>
      )}

      {wallet?.status === 'active' && walletBalance <= 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Você está sem créditos. Solicite uma recarga para criar novos clientes ou renovar acessos.
          </div>
          <Button
            size="sm"
            onClick={handleRequestRecharge}
            disabled={!rechargeWhatsappUrl}
            className="w-full sm:w-auto"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Solicitar Recarga
          </Button>
        </div>
      )}

      {wallet && wallet.status !== 'active' && (
        <div className="flex flex-col gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Sua revenda está em modo {wallet.status === 'grace' ? 'tolerância' : 'bloqueado'}.
            Você pode acompanhar seus clientes, mas não pode criar novos ou renovar até regularizar sua recarga.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRequestRecharge}
            disabled={!rechargeWhatsappUrl}
            className="w-full sm:w-auto"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Solicitar Recarga
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Créditos</p>
                <p className="text-lg font-semibold">{walletBalance}</p>
              </div>
            </div>

            {walletBalance <= 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequestRecharge}
                disabled={!rechargeWhatsappUrl}
                className="h-8 px-2 text-xs"
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                Recarga
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">{getWalletStatusBadge(wallet)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-lg font-semibold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-lg font-semibold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencendo</p>
              <p className="text-lg font-semibold">{stats.expiring}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {wallet?.last_recharge_at && (
        <p className="text-xs text-muted-foreground">
          Última recarga de créditos: {formatDate(wallet.last_recharge_at)}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Clientes cadastrados
          </CardTitle>
          <CardDescription>
            Clientes criados e vinculados à sua conta de revendedor.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
            </div>
          ) : (
            <div className="divide-y">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {client.email}
                      </span>
                      {getSubscriptionBadge(client.subscription)}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Criado em {formatDate(client.created_at)}</span>

                      {client.subscription?.expires_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expira: {formatDate(client.subscription.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-start sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRenewDialog(client)}
                      disabled={!canRenewClient}
                    >
                      <RotateCw className="mr-2 h-3.5 w-3.5" />
                      Renovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={renewDialogOpen}
        onOpenChange={(open) => {
          setRenewDialogOpen(open)

          if (!open) {
            setRenewingClient(null)
            setSelectedPlanId('1_month')
            setRenewError('')
            setRenewSuccess('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar Cliente</DialogTitle>
            <DialogDescription>
              Use créditos da sua carteira para renovar o acesso do cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{renewingClient?.email}</p>
              <p className="text-xs text-muted-foreground">
                Vencimento atual: {formatDate(renewingClient?.subscription?.expires_at)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Saldo atual</p>
                <p className="font-semibold">{walletBalance} crédito(s)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">{getWalletStatusBadge(wallet)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="renewal-plan">Plano de renovação</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger id="renewal-plan">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {RENEWAL_PLANS.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.label} · {plan.credits} crédito(s)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O plano selecionado adiciona {selectedPlan.days} dias e consome{' '}
                <strong>{selectedPlan.credits} crédito(s)</strong>.
              </p>
            </div>

            {!hasEnoughCredits && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Saldo insuficiente para este plano. Solicite uma recarga para continuar.
              </div>
            )}

            {renewError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {renewError}
              </div>
            )}

            {renewSuccess && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                <Check className="h-4 w-4 shrink-0" />
                {renewSuccess}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenewDialogOpen(false)}
              disabled={renewing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRenewClient}
              disabled={renewing || !canRenewClient || !hasEnoughCredits}
            >
              {renewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renovando...
                </>
              ) : (
                <>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Renovar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}