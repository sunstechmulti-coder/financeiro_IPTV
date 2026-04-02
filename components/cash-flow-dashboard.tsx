'use client'

import { useState, useMemo } from 'react'
import { Plus, Wallet, LayoutDashboard, List, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/summary-cards'
import { TransactionsTable } from '@/components/transactions-table'
import { TransactionDialog } from '@/components/transaction-dialog'
import { RevenueHeatmap } from '@/components/revenue-heatmap'
import { CreditsCard } from '@/components/credits-card'
import { ActivationsCard } from '@/components/activations-card'
import { ConfigPage } from '@/components/config/config-page'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/lib/types'
import { useSupabaseData } from '@/hooks/use-supabase-data'

type Tab = 'dashboard' | 'transacoes' | 'configuracoes'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'transacoes',    label: 'Transações',     icon: List },
  { id: 'configuracoes', label: 'Configurações',  icon: Settings },
]

export function CashFlowDashboard() {
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
            <Wallet className="h-5 w-5 text-primary" />
            <span>Cash Flow</span>
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

          {/* New transaction button */}
          <Button
            size="sm"
            onClick={() => {
              setEditingTransaction(null)
              setDialogOpen(true)
            }}
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
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
          {activeTab === 'dashboard' && (
            <>
              <SummaryCards
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                balance={balance}
              />

              <CreditsCard
                servidores={servidores}
                movements={movements}
              />

              <ActivationsCard
                transactions={activationTxs}
                products={activationProducts}
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
        onSave={handleSaveTransaction}
        onAdjustCredits={adjustCreditsBalance}
      />
    </div>
  )
}
