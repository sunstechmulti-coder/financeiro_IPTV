'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Wallet, LayoutDashboard, List, Settings, Loader2, BarChart2, Mail, LogOut, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/summary-cards'
import { TransactionsTable } from '@/components/transactions-table'
import { TransactionDialog } from '@/components/transaction-dialog'
import { RevenueHeatmap } from '@/components/revenue-heatmap'
import { CreditsCard } from '@/components/credits-card'
import { QuickEntry } from '@/components/quick-entry'
import { ConfigPage } from '@/components/config/config-page'
import { AnalyticsPage } from '@/components/analytics/analytics-page'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/lib/types'
import { useSupabaseData } from '@/hooks/use-supabase-data'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'admin1@sunstech.com'

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
}

interface CashFlowDashboardProps {
  subscription?: Subscription | null
}

type Tab = 'dashboard' | 'transacoes' | 'analytics' | 'configuracoes'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'transacoes',    label: 'Transações',     icon: List },
  { id: 'analytics',     label: 'Analytics',      icon: BarChart2 },
  { id: 'configuracoes', label: 'Configurações',  icon: Settings },
]

export function CashFlowDashboard({ subscription }: CashFlowDashboardProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const supabase = createClient()

  // Função para obter badge de subscription
  const getSubscriptionBadge = () => {
    if (!subscription) return null

    // Admin não mostra badge
    if (userEmail === ADMIN_EMAIL) return null

    // Ainda não fez primeiro acesso
    if (!subscription.first_access_at) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
          <Clock className="h-3 w-3" />
          <span className="hidden sm:inline">Aguardando ativação</span>
        </div>
      )
    }

    const daysRemaining = subscription.days_remaining ?? 0

    // Expirado
    if (subscription.is_expired || daysRemaining <= 0) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs">
          <Clock className="h-3 w-3" />
          <span>Expirado</span>
        </div>
      )
    }

    // Menos de 7 dias - laranja
    if (daysRemaining <= 7) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs">
          <Clock className="h-3 w-3" />
          <span>{daysRemaining}d</span>
        </div>
      )
    }

    // Menos de 15 dias - amarelo
    if (daysRemaining <= 15) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
          <Clock className="h-3 w-3" />
          <span>{daysRemaining}d</span>
        </div>
      )
    }

    // Trial
    if (subscription.plan_type === 'trial') {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
          <Clock className="h-3 w-3" />
          <span className="hidden sm:inline">Teste</span> {daysRemaining}d
        </div>
      )
    }

    // Ativo normal - verde
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
        <Clock className="h-3 w-3" />
        <span>{daysRemaining}d</span>
      </div>
    )
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.email === ADMIN_EMAIL)
      setUserEmail(data.user?.email ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(session?.user?.email === ADMIN_EMAIL)
      setUserEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const {
    transactions,
    servidores,
    creditMovements: movements,
    activationTransactions: activationTxs,
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

  const { totalIncome, totalExpenses, balance } = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    return { totalIncome: income, totalExpenses: expenses, balance: income - expenses }
  }, [transactions])

  const handleSaveTransaction = async (transaction: Transaction) => {
    if (editingTransaction) {
      await updateTransaction(transaction)
    } else {
      await addTransaction(transaction)
    }
    setEditingTransaction(null)
    // Refresh data to get updated balances
    await refreshData()
  }

  const handleDeleteTransaction = async (id: string) => {
    // Check if the transaction is associated with credits
    const tx = transactions.find(t => t.id === id)
    if (tx?.creditsDelta && tx.serverId) {
      // Reverse the credit adjustment
      await adjustCreditsBalance(tx.serverId, -tx.creditsDelta)
      await removeCreditMovementByTransaction(id)
    }
    // Check if it's an activation transaction
    const actTx = getActivationTransactionByTransactionId(id)
    if (actTx) {
      await removeActivationTransactionByTransactionId(id)
    }
    await deleteTransaction(id)
  }

  // Loading state
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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <img src="/logo-icon.png" alt="Cash Flow" className="h-9 w-9 object-contain" />
            <span>Cash Flow</span>
            {userEmail && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-normal truncate max-w-[140px] hidden sm:inline">
                  {userEmail}
                </span>
                {getSubscriptionBadge()}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  title="Sair"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="sr-only">Sair</span>
                </Button>
              </div>
            )}
          </div>

          {/* Navigation tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
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

          {/* New transaction button - hidden on mobile to avoid email overlap */}
          <Button
            size="sm"
            onClick={() => {
              setEditingTransaction(null)
              setDialogOpen(true)
            }}
            className="hidden sm:flex"
            data-testid="new-transaction-btn"
          >
            <Plus className="mr-1 h-4 w-4" />
            Nova Transação
          </Button>
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex border-t overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm transition-colors',
                activeTab === id
                  ? 'bg-primary/10 text-primary font-medium border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden xs:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Mobile floating new transaction button */}
        <div className="sm:hidden fixed bottom-4 right-4 z-30">
          <Button
            size="sm"
            onClick={() => {
              setEditingTransaction(null)
              setDialogOpen(true)
            }}
            className="rounded-full h-12 w-12 p-0 shadow-lg"
            data-testid="new-transaction-btn-mobile"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
          {activeTab === 'dashboard' && (
            <>
              {/* Quick Entry - Lançamento Express */}
              <QuickEntry
                planos={planos}
                servidores={servidores}
                onSave={handleSaveTransaction}
                onAdjustCredits={adjustCreditsBalance}
              />

              <SummaryCards
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                balance={balance}
              />

              <CreditsCard
                servidores={servidores}
                movements={movements}
              />

              <RevenueHeatmap transactions={transactions} />
            </>
          )}

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

      {/* Transaction dialog */}
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
