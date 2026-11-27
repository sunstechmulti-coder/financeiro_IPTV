'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  LayoutDashboard,
  List,
  Settings,
  Loader2,
  BarChart2,
  LogOut,
  Clock,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Store,
  AlertTriangle,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/summary-cards'
import { TransactionsTable } from '@/components/transactions-table'
import { TransactionDialog } from '@/components/transaction-dialog'
import { PrintingTransactionDialog } from '@/components/printing-transaction-dialog'
import { ActivityFilter } from '@/components/activity-filter'
import { ActivityOverview } from '@/components/activity-overview'
import { ActivityAnalytics } from '@/components/analytics/activity-analytics'
import { filterActivity } from '@/lib/activity'
import type { ActivityScope } from '@/lib/activity'
import { RevenueHeatmap } from '@/components/revenue-heatmap'
import { CreditsCard } from '@/components/credits-card'
import { QuickEntry } from '@/components/quick-entry'
import { ConfigPage } from '@/components/config/config-page'
import {
  AnalyticsPage,
  buildSalesMixAnalytics,
} from '@/components/analytics/analytics-page'
import { DailyRobotAssistant } from '@/components/daily-robot-assistant'
import { ResellerClientsPanel } from '@/components/reseller/reseller-clients-panel'
import { cn } from '@/lib/utils'
import type { Transaction, CreditMovement } from '@/lib/types'
import { useSupabaseData } from '@/hooks/use-supabase-data'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'admin1@sunstech.com'

type UserRole = 'admin' | 'reseller' | 'user'
type AccessMode = 'admin' | 'reseller' | 'user' | 'user_only' | 'blocked'
type ResellerStatus = 'active' | 'grace' | 'blocked'

interface Subscription {
  id: string
  user_id: string
  plan_type: string
  started_at: string
  expires_at: string | null
  first_access_at: string | null
  is_active: boolean
  is_expired?: boolean
  days_remaining?: number

  user_role?: UserRole
  access_mode?: AccessMode
  reseller_status?: ResellerStatus | null
  reseller_days_until_recharge_deadline?: number | null
  reseller_grace_days_remaining?: number | null
  reseller_grace_until?: string | null

  renewal_whatsapp_number?: string | null
  renewal_whatsapp_owner_email?: string | null
  renewal_whatsapp_owner_role?: 'admin' | 'reseller' | null
  renewal_whatsapp_missing?: boolean
}

interface CashFlowDashboardProps {
  subscription?: Subscription | null
}

type Tab = 'dashboard' | 'clientes' | 'transacoes' | 'analytics' | 'configuracoes'

const BASE_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transacoes', label: 'Transações', icon: List },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
]

const RESELLER_TAB: { id: Tab; label: string; icon: React.ElementType } = {
  id: 'clientes',
  label: 'Meus Clientes',
  icon: Store,
}

function formatDateBR(date: string | null | undefined) {
  if (!date) return 'data desconhecida'

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'data desconhecida'
  }

  return parsedDate.toLocaleDateString('pt-BR')
}

function onlyNumbers(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

export function CashFlowDashboard({ subscription }: CashFlowDashboardProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('user')
  const supabase = createClient()

  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())

  const isResellerProfile = userRole === 'reseller'
  const resellerStatus = subscription?.reseller_status || null
  const resellerAccessMode = subscription?.access_mode || null

  const isReseller =
    isResellerProfile &&
    resellerAccessMode !== 'user_only' &&
    resellerAccessMode !== 'blocked' &&
    resellerStatus !== 'grace' &&
    resellerStatus !== 'blocked'

  const isResellerGrace =
    isResellerProfile &&
    (resellerAccessMode === 'user_only' || resellerStatus === 'grace')

  const tabs = useMemo(() => {
    if (!isReseller) return BASE_TABS

    return [BASE_TABS[0], RESELLER_TAB, ...BASE_TABS.slice(1)]
  }, [isReseller])

  const getSubscriptionBadge = () => {
    if (!subscription) return null
    if (userEmail === ADMIN_EMAIL) return null
    if (isResellerProfile) return null

    if (!subscription.first_access_at) {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Aguardando ativação</span>
        </div>
      )
    }

    const daysRemaining = subscription.days_remaining ?? 0

    if (subscription.is_expired || daysRemaining <= 0) {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/20">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Expirado</span>
        </div>
      )
    }

    if (daysRemaining <= 7) {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-400 ring-1 ring-orange-500/20">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{daysRemaining}d</span>
        </div>
      )
    }

    if (daysRemaining <= 15) {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-medium text-yellow-400 ring-1 ring-yellow-500/20">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{daysRemaining}d</span>
        </div>
      )
    }

    if (subscription.plan_type === 'trial') {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Teste {daysRemaining}d</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">{daysRemaining}d</span>
      </div>
    )
  }

  const getResellerRoleBadge = () => {
    if (!isResellerProfile) return null

    return (
      <div className="flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-xs font-medium text-purple-400 ring-1 ring-purple-500/20">
        <Store className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">Revendedor</span>
      </div>
    )
  }

  const getResellerAccessBadge = () => {
    if (!isResellerProfile) return null

    if (resellerStatus === 'grace' || resellerAccessMode === 'user_only') {
      const days = subscription?.reseller_grace_days_remaining ?? 0

      return (
        <div
          className="flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-medium text-yellow-400 ring-1 ring-yellow-500/20"
          title="Modo tolerância: funções de revenda bloqueadas até nova recarga."
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Tolerância {days}d</span>
        </div>
      )
    }

    if (resellerStatus === 'blocked' || resellerAccessMode === 'blocked') {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/20">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Bloqueado</span>
        </div>
      )
    }

    const days = subscription?.reseller_days_until_recharge_deadline

    return (
      <div
        className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20"
        title="Prazo para nova recarga de créditos da revenda."
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">
          {typeof days === 'number' ? `Recarga em ${days}d` : 'Revenda ativa'}
        </span>
      </div>
    )
  }

  const shouldShowRenewButton = () => {
    if (!subscription) return false
    if (userEmail === ADMIN_EMAIL) return false
    if (isResellerProfile) return false
    if (!subscription.first_access_at) return false
    if (subscription.is_expired) return false

    const daysRemaining = subscription.days_remaining ?? 0
    return daysRemaining > 0 && daysRemaining <= 7
  }

  useEffect(() => {
    const loadUserContext = async (
      authUser: { id: string; email?: string | null } | null | undefined
    ) => {
      const email = authUser?.email ?? null

      setIsAdmin(email === ADMIN_EMAIL)
      setUserEmail(email)

      if (!authUser) {
        setUserRole('user')
        return
      }

      if (email === ADMIN_EMAIL) {
        setUserRole('admin')
        return
      }

      const roleFromSubscription = subscription?.user_role

      if (roleFromSubscription) {
        setUserRole(roleFromSubscription)
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authUser.id)
        .single()

      setUserRole((profile?.role as UserRole | undefined) || 'user')
    }

    supabase.auth.getUser().then(({ data }) => {
      loadUserContext(data.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserContext(session?.user)
    })

    return () => subscription.unsubscribe()
  }, [supabase, subscription?.user_role])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleRenewWhatsapp = () => {
    const renewalWhatsapp = onlyNumbers(subscription?.renewal_whatsapp_number)
    const ownerRole = subscription?.renewal_whatsapp_owner_role
    const ownerEmail = subscription?.renewal_whatsapp_owner_email

    if (!renewalWhatsapp) {
      if (ownerRole === 'reseller') {
        window.alert(
          'O revendedor responsável por esta conta ainda não configurou o WhatsApp de renovação.'
        )
      } else {
        window.alert(
          'O WhatsApp de renovação do administrador ainda não foi configurado.'
        )
      }

      return
    }

    const expiresAt = formatDateBR(subscription?.expires_at)
    const daysRemaining = subscription?.days_remaining ?? 0
    const destination =
      ownerRole === 'reseller'
        ? `Revendedor responsável: ${ownerEmail || 'não informado'}`
        : `Administrador: ${ownerEmail || 'não informado'}`

    const message = encodeURIComponent(
      `Olá, quero renovar meu acesso ao painel Cash Flow.\n\nConta: ${userEmail || 'não informado'}\nVencimento: ${expiresAt}\nDias restantes: ${daysRemaining} dia(s)\n${destination}`
    )

    window.open(`https://wa.me/${renewalWhatsapp}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const {
    transactions,
    servidores,
    creditMovements: movements,
    activationProducts,
    planos,
    saidasRapidas,
    loading,
    activitySchemaReady,
    canUsePrinting,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    adjustCreditsBalance,
    addCreditMovement,
    removeCreditMovementByTransaction,
    removeActivationTransactionByTransactionId,
    getActivationTransactionByTransactionId,
    addServidor,
    updateServidor,
    deleteServidor,
    addPlano,
    updatePlano,
    deletePlano,
    addSaidaRapida,
    updateSaidaRapida,
    deleteSaidaRapida,
    addActivationProduct,
    updateActivationProduct,
    deleteActivationProduct,
    revendaGrupos,
    addRevendaGrupo,
    updateRevendaGrupo,
    deleteRevendaGrupo,
    refreshData,
  } = useSupabaseData()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [activityScope, setActivityScope] = useState<ActivityScope>('all')
  const [transactionMode, setTransactionMode] = useState<'iptv' | 'printing_3d'>('iptv')
  const adminActivities = activitySchemaReady && canUsePrinting
  const viewTransactions = useMemo(
    () => filterActivity(transactions, activityScope, adminActivities),
    [transactions, activityScope, adminActivities],
  )
  const iptvTransactions = useMemo(
    () => adminActivities
      ? filterActivity(transactions, 'iptv')
      : filterActivity(transactions, 'all', false),
    [transactions, adminActivities],
  )
  const unclassifiedCount = transactions.filter(t => !t.activity).length
  const canReclassifyAsPrinting = !editingTransaction || (
    !editingTransaction.serverId && !editingTransaction.creditsDelta
    && editingTransaction.costSnapshot == null
    && !movements.some(m => m.transactionId === editingTransaction.id)
    && !getActivationTransactionByTransactionId(editingTransaction.id)
  )
  const openPrintingEntry = () => {
    if (!adminActivities) return
    setEditingTransaction(null)
    setTransactionMode('printing_3d')
    setDialogOpen(true)
  }

  useEffect(() => {
    if (!adminActivities) {
      setActivityScope('all')
      setTransactionMode('iptv')
    }
  }, [adminActivities])

  useEffect(() => {
    if (activeTab === 'clientes' && !isReseller) {
      setActiveTab('dashboard')
    }
  }, [activeTab, isReseller])

  const selectedMonthLabel = useMemo(() => {
    const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleDateString(
      'pt-BR',
      { month: 'long' }
    )

    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${selectedYear}`
  }, [selectedMonth, selectedYear])

  const handlePreviousMonth = () => {
    const date = new Date(selectedYear, selectedMonth - 1, 1)
    setSelectedMonth(date.getMonth())
    setSelectedYear(date.getFullYear())
  }

  const handleNextMonth = () => {
    const date = new Date(selectedYear, selectedMonth + 1, 1)
    setSelectedMonth(date.getMonth())
    setSelectedYear(date.getFullYear())
  }

  const { totalIncome, totalExpenses, balance } = useMemo(() => {
    const monthTransactions = viewTransactions.filter((t) => {
      const date = new Date(t.date + 'T00:00:00')
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear
    })

    const income = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)

    const expenses = monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses,
    }
  }, [viewTransactions, selectedMonth, selectedYear])

  const newClientsSummary = useMemo(() => {
    const current = buildSalesMixAnalytics(
      iptvTransactions,
      servidores,
      planos,
      selectedMonth,
      selectedYear
    ).newClientCount

    const previousDate = new Date(selectedYear, selectedMonth - 1, 1)
    const previous = buildSalesMixAnalytics(
      iptvTransactions,
      servidores,
      planos,
      previousDate.getMonth(),
      previousDate.getFullYear()
    ).newClientCount

    const variation =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0

    return { current, previous, variation }
  }, [iptvTransactions, servidores, planos, selectedMonth, selectedYear])

  const registerCreditMovementFromTransaction = async (
    transaction: Transaction | null | undefined
  ) => {
    if (!transaction?.serverId || transaction.activity === 'printing_3d') return

    const creditsDelta = Number(transaction.creditsDelta ?? 0)

    if (!Number.isFinite(creditsDelta) || creditsDelta === 0) return

    await addCreditMovement({
      serverId: transaction.serverId,
      date: transaction.date,
      type: (creditsDelta > 0 ? 'purchase' : 'sale') as CreditMovement['type'],
      credits: Math.abs(creditsDelta),
      transactionId: transaction.id,
    })
  }

  const handleSaveTransaction = async (transaction: Transaction) => {
    if (adminActivities) transaction = { ...transaction, activity: 'iptv', printingDetails: null }
    if (editingTransaction) {
      await updateTransaction(transaction)
    } else {
      const savedTransaction = await addTransaction(transaction)
      await registerCreditMovementFromTransaction(savedTransaction)
    }

    setEditingTransaction(null)
    await refreshData()
  }

  const handleQuickEntrySaveTransaction = async (transaction: Transaction) => {
    const savedTransaction = await addTransaction(transaction)
    await registerCreditMovementFromTransaction(savedTransaction)
  }

  const handleSavePrinting = async (transaction: Transaction): Promise<boolean> => {
    if (!adminActivities || !canReclassifyAsPrinting) return false
    if (transaction.serverId || transaction.creditsDelta) return false
    const saved = editingTransaction ? await updateTransaction(transaction) : await addTransaction(transaction)
    return !!saved
  }

  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id)

    if (tx?.creditsDelta && tx.serverId) {
      await adjustCreditsBalance(tx.serverId, -tx.creditsDelta)
      await removeCreditMovementByTransaction(id)
    }

    const actTx = getActivationTransactionByTransactionId(id)

    if (actTx) {
      await removeActivationTransactionByTransactionId(id)
    }

    await deleteTransaction(id)
  }

  const activitySelector = adminActivities && !editingTransaction?.activity ? (
    <div className="flex gap-2" role="group" aria-label="Atividade do lançamento">
      <Button type="button" size="sm" variant={transactionMode === 'iptv' ? 'default' : 'outline'}
        aria-pressed={transactionMode === 'iptv'} onClick={() => setTransactionMode('iptv')}>IPTV</Button>
      <Button type="button" size="sm" variant={transactionMode === 'printing_3d' ? 'default' : 'outline'}
        disabled={!canReclassifyAsPrinting} aria-pressed={transactionMode === 'printing_3d'}
        onClick={() => setTransactionMode('printing_3d')}>Impressão 3D</Button>
    </div>
  ) : null

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando dados...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-2 px-3 py-2 pr-20 sm:px-4 lg:pr-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
            <img
              src="/logo-icon.png"
              alt="Cash Flow"
              className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
            />

            <span className="hidden shrink-0 min-[380px]:inline">Cash Flow</span>

            {subscription && (
              <div className="flex min-w-0 items-center gap-1 border-l border-border pl-2 sm:ml-2 sm:gap-1.5">
                <div className="hidden items-center gap-1.5 sm:flex">
                  {getSubscriptionBadge()}
                  {getResellerRoleBadge()}
                  {getResellerAccessBadge()}

                  {shouldShowRenewButton() && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRenewWhatsapp}
                      className="h-7 rounded-full bg-green-600 px-2.5 text-[11px] font-semibold text-white hover:bg-green-700"
                      title={
                        subscription?.renewal_whatsapp_owner_role === 'reseller'
                          ? 'Renovar pelo WhatsApp do revendedor'
                          : 'Renovar pelo WhatsApp do administrador'
                      }
                    >
                      <MessageCircle className="mr-1 h-3.5 w-3.5" />
                      <span>Renovar</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:hidden">
                  {isResellerProfile ? getResellerAccessBadge() : getSubscriptionBadge()}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Sair"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sair</span>
                </Button>
              </div>
            )}
          </div>

          <nav className="hidden shrink-0 items-center gap-1 lg:flex">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors xl:px-3',
                  activeTab === id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          {activeTab !== 'clientes' && (
            <Button
              size="sm"
              onClick={() => {
                setEditingTransaction(null)
                setTransactionMode(adminActivities && activityScope === 'printing_3d' ? 'printing_3d' : 'iptv')
                setDialogOpen(true)
              }}
              className="hidden shrink-0 lg:flex"
              data-testid="new-transaction-btn"
            >
              <Plus className="mr-1 h-4 w-4" />
              Nova Transação
            </Button>
          )}
        </div>

        <div className="flex border-t overflow-x-auto lg:hidden">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm transition-colors',
                activeTab === id
                  ? 'bg-primary/10 text-primary font-medium border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden min-[430px]:inline">{label}</span>
            </button>
          ))}
        </div>

        {activeTab !== 'clientes' && (
          <div className="fixed right-4 top-2 z-50 lg:hidden">
            <Button
              size="sm"
              onClick={() => {
                setEditingTransaction(null)
                setTransactionMode(adminActivities && activityScope === 'printing_3d' ? 'printing_3d' : 'iptv')
                setDialogOpen(true)
              }}
              className="h-12 w-12 rounded-full p-0 shadow-lg shadow-primary/20"
              data-testid="new-transaction-btn-mobile"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}
      </header>

      {isResellerGrace && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-xs text-yellow-500">
          Sua revenda está em período de tolerância. Você pode usar o painel como usuário comum,
          mas as funções de revenda ficam bloqueadas até uma nova recarga.
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 pb-32 lg:pb-24">
          {adminActivities && (activeTab === 'dashboard' || activeTab === 'transacoes' || activeTab === 'analytics') && (
            <ActivityFilter value={activityScope} unclassified={unclassifiedCount}
              onChange={scope => {
                setActivityScope(scope)
                if (scope === 'unclassified') setActiveTab('transacoes')
              }} />
          )}
          {activeTab === 'dashboard' && (
            <>
              {adminActivities && activityScope === 'printing_3d' ? (
                <Button className="w-full justify-start" variant="outline" onClick={openPrintingEntry}>
                  <Plus className="mr-2 h-4 w-4" />Lançamento Express · Venda 3D
                </Button>
              ) : (
              <QuickEntry
                planos={planos}
                servidores={servidores}
                onSave={handleQuickEntrySaveTransaction}
                onAdjustCredits={adjustCreditsBalance}
              />
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreviousMonth}
                  className="h-8 w-8 p-0"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="min-w-[120px] text-center text-sm font-semibold">
                  {selectedMonthLabel}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextMonth}
                  className="h-8 w-8 p-0"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <DailyRobotAssistant transactions={viewTransactions} />

              <SummaryCards
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                balance={balance}
              />

              {adminActivities && (activityScope === 'printing_3d' || activityScope === 'all') && (
                <ActivityOverview transactions={transactions} scope={activityScope}
                  month={selectedMonth} year={selectedYear} onNew={openPrintingEntry} />
              )}

              {(!adminActivities || activityScope === 'iptv') && (
              <div className="flex flex-col gap-4 rounded-xl border border-blue-500/40 bg-blue-500/[0.06] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30">
                    <UserPlus className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Novos clientes no mês</p>
                    <p className="text-3xl font-bold text-blue-400">
                      {newClientsSummary.current}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  {newClientsSummary.previous > 0 ? (
                    <div
                      className={cn(
                        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                        newClientsSummary.variation >= 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-destructive/15 text-destructive'
                      )}
                    >
                      {newClientsSummary.variation >= 0 ? '+' : ''}
                      {newClientsSummary.variation.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}% vs. mês anterior
                    </div>
                  ) : (
                    <div className="inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-400">
                      Sem base no mês anterior
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {newClientsSummary.previous}{' '}
                    {newClientsSummary.previous === 1 ? 'cliente' : 'clientes'} no mês anterior
                  </p>
                </div>
              </div>
              )}

              {(!adminActivities || activityScope === 'iptv' || activityScope === 'all') && (
                <CreditsCard servidores={servidores} movements={movements} transactions={iptvTransactions} />
              )}

              <RevenueHeatmap transactions={viewTransactions} />
            </>
          )}

          {activeTab === 'clientes' && isReseller && <ResellerClientsPanel />}

          {activeTab === 'transacoes' && (
            <TransactionsTable
              showActivity={adminActivities}
              transactions={viewTransactions}
              servidores={servidores}
              onEdit={(tx) => {
                setEditingTransaction(tx)
                setTransactionMode(tx.activity === 'printing_3d' ? 'printing_3d' : 'iptv')
                setDialogOpen(true)
              }}
              onDelete={handleDeleteTransaction}
            />
          )}

          {activeTab === 'analytics' && (
            adminActivities && activityScope !== 'iptv' ? (
              <ActivityAnalytics transactions={transactions} scope={activityScope} />
            ) : (
              <AnalyticsPage
                transactions={iptvTransactions}
                servidores={servidores}
                movements={movements}
                planos={planos}
              />
            )
          )}

          {activeTab === 'configuracoes' && (
            <ConfigPage
              servidores={servidores}
              planos={planos}
              saidasRapidas={saidasRapidas}
              activationProducts={activationProducts}
              onAddServidor={addServidor}
              onUpdateServidor={updateServidor}
              onDeleteServidor={deleteServidor}
              onAddPlano={addPlano}
              onUpdatePlano={updatePlano}
              onDeletePlano={deletePlano}
              onAddSaidaRapida={addSaidaRapida}
              onUpdateSaidaRapida={updateSaidaRapida}
              onDeleteSaidaRapida={deleteSaidaRapida}
              onAddActivationProduct={addActivationProduct}
              onUpdateActivationProduct={updateActivationProduct}
              onDeleteActivationProduct={deleteActivationProduct}
              revendaGrupos={revendaGrupos}
              onAddRevendaGrupo={addRevendaGrupo}
              onUpdateRevendaGrupo={updateRevendaGrupo}
              onDeleteRevendaGrupo={deleteRevendaGrupo}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 bg-background/80 px-4 py-4 pb-28 text-center text-[11px] leading-relaxed text-muted-foreground lg:pb-4">
        <p>Versão 1.0.0</p>
        <p>© 2026 Cash Flow.</p>
        <p>Desenvolvido por Sun&apos;s Tech.</p>
      </footer>

      {adminActivities && transactionMode === 'printing_3d' ? (
        <PrintingTransactionDialog open={dialogOpen} onOpenChange={setDialogOpen}
          transaction={editingTransaction} activitySelector={activitySelector} onSave={handleSavePrinting} />
      ) : (
      <TransactionDialog
        activitySelector={activitySelector}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTransaction}
        servidores={servidores}
        planos={planos}
        saidasRapidas={saidasRapidas}
        activationProducts={activationProducts}
        revendaGrupos={revendaGrupos}
        onSave={handleSaveTransaction}
        onAdjustCredits={adjustCreditsBalance}
      />
      )}
    </div>
  )
}
