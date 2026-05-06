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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/summary-cards'
import { TransactionsTable } from '@/components/transactions-table'
import { TransactionDialog } from '@/components/transaction-dialog'
import { RevenueHeatmap } from '@/components/revenue-heatmap'
import { CreditsCard } from '@/components/credits-card'
import { QuickEntry } from '@/components/quick-entry'
import { ConfigPage } from '@/components/config/config-page'
import { AnalyticsPage } from '@/components/analytics/analytics-page'
import { DailyRobotAssistant } from '@/components/daily-robot-assistant'
import { ResellerClientsPanel } from '@/components/reseller/reseller-clients-panel'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/lib/types'
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
    addTransaction,
    updateTransaction,
    deleteTransaction,
    adjustCreditsBalance,
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
    const monthTransactions = transactions.filter((t) => {
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
  }, [transactions, selectedMonth, selectedYear])

  const handleSaveTransaction = async (transaction: Transaction) => {
    if (editingTransaction) {
      await updateTransaction(transaction)
    } else {
      await addTransaction(transaction)
    }

    setEditingTransaction(null)
    await refreshData()
  }

  const handleQuickEntrySaveTransaction = async (transaction: Transaction) => {
    await addTransaction(transaction)
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
          {activeTab === 'dashboard' && (
            <>
              <QuickEntry
                planos={planos}
                servidores={servidores}
                onSave={handleQuickEntrySaveTransaction}
                onAdjustCredits={adjustCreditsBalance}
              />

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

              <DailyRobotAssistant transactions={transactions} />

              <SummaryCards
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                balance={balance}
              />

              <CreditsCard servidores={servidores} movements={movements} />

              <RevenueHeatmap transactions={transactions} />
            </>
          )}

          {activeTab === 'clientes' && isReseller && <ResellerClientsPanel />}

          {activeTab === 'transacoes' && (
            <TransactionsTable
              transactions={transactions}
              servidores={servidores}
              onEdit={(tx) => {
                setEditingTransaction(tx)
                setDialogOpen(true)
              }}
              onDelete={handleDeleteTransaction}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage
              transactions={transactions}
              servidores={servidores}
              movements={movements}
              planos={planos}
            />
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

      <TransactionDialog
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
    </div>
  )
}