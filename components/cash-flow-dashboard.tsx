'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Wallet, LayoutDashboard, List, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/summary-cards'
import { TransactionsTable } from '@/components/transactions-table'
import { TransactionDialog } from '@/components/transaction-dialog'
import { RevenueHeatmap } from '@/components/revenue-heatmap'
import { CreditsCard } from '@/components/credits-card'
import { ActivationsCard } from '@/components/activations-card'
import { ConfigPage } from '@/components/config/config-page'
import { cn } from '@/lib/utils'
import type { Transaction, Servidor } from '@/lib/types'
import type { ActivationTransaction } from '@/lib/types'
import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  saveTransactions,
} from '@/lib/storage'
import { getServidores, adjustCreditsBalance } from '@/lib/config-storage'
import { getCreditMovements, removeCreditMovementByTransaction } from '@/lib/credit-storage'
import {
  getActivationTransactions,
  getActivationProducts,
  getActivationTransactionByTransactionId,
  removeActivationTransactionByTransactionId,
} from '@/lib/activation-storage'
import type { CreditMovement } from '@/lib/types'

type Tab = 'dashboard' | 'transacoes' | 'configuracoes'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'transacoes',    label: 'Transações',     icon: List },
  { id: 'configuracoes', label: 'Configurações',  icon: Settings },
]

export function CashFlowDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [movements, setMovements] = useState<CreditMovement[]>([])
  const [activationTxs, setActivationTxs] = useState<ActivationTransaction[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  useEffect(() => {
    setTransactions(getTransactions())
    setServidores(getServidores())
    setMovements(getCreditMovements())
    setActivationTxs(getActivationTransactions())
    setMounted(true)
  }, [])

  const { totalIncome, totalExpenses, balance } = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    return { totalIncome: income, totalExpenses: expenses, balance: income - expenses }
  }, [transactions])

  const handleSaveTransaction = (transaction: Transaction) => {
    if (editingTransaction) {
      setTransactions(updateTransaction(transaction))
    } else {
      setTransactions(addTransaction(transaction))
    }
    setEditingTransaction(null)
    // Refresh activation transactions and servidores in case balance was updated
    setActivationTxs(getActivationTransactions())
    setServidores(getServidores())
    setMovements(getCreditMovements())
  }

  const handleSaveMultiple = (txs: Transaction[]) => {
    const current = getTransactions()
    const updated = [...current, ...txs]
    saveTransactions(updated)
    setTransactions(updated)
    // Sync related state
    setActivationTxs(getActivationTransactions())
    setServidores(getServidores())
    setMovements(getCreditMovements())
  }

  const handleServidoresChange = (list: Servidor[]) => {
    setServidores(list)
    // Re-read movements too since they may have been updated
    setMovements(getCreditMovements())
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    // Estornar créditos se for ativação com servidor vinculado
    const activationTx = getActivationTransactionByTransactionId(id)
    if (activationTx) {
      const products = getActivationProducts()
      const product = products.find((p) => p.id === activationTx.productId)
      if (product?.linkedServerId) {
        const updated = adjustCreditsBalance(product.linkedServerId, activationTx.custo)
        setServidores(updated)
      }
      removeActivationTransactionByTransactionId(id)
    }
    // Remover movimento de crédito (cobre planos rápidos e ativações)
    removeCreditMovementByTransaction(id)
    setMovements(getCreditMovements())
    setActivationTxs(getActivationTransactions())
    setTransactions(deleteTransaction(id))
  }

  const handleNew = () => {
    setEditingTransaction(null)
    setDialogOpen(true)
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-5 w-5 animate-pulse" />
          <span>Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Cash Flow</h1>
          </div>

          {/* Nav tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <Button onClick={handleNew} disabled={activeTab === 'configuracoes'}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transação
          </Button>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                activeTab === id ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Dashboard tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <SummaryCards
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              balance={balance}
            />

            <CreditsCard servidores={servidores} movements={movements} />

            <ActivationsCard transactions={activationTxs} />

            {transactions.length > 0 && (
              <RevenueHeatmap transactions={transactions} />
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Últimas Transações</h2>
                  <p className="text-sm text-muted-foreground">
                    {transactions.length}{' '}
                    {transactions.length === 1 ? 'transação registrada' : 'transações registradas'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('transacoes')}>
                  Ver todas
                </Button>
              </div>
              <TransactionsTable
                transactions={transactions.slice(-10).reverse()}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          </div>
        )}

        {/* Transações tab */}
        {activeTab === 'transacoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Transações</h2>
                <p className="text-sm text-muted-foreground">
                  {transactions.length}{' '}
                  {transactions.length === 1 ? 'transação registrada' : 'transações registradas'}
                </p>
              </div>
            </div>
            <TransactionsTable
              transactions={transactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        )}

        {/* Configurações tab */}
        {activeTab === 'configuracoes' && <ConfigPage />}
      </main>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveTransaction}
        onSaveMultiple={handleSaveMultiple}
        onServidoresChange={handleServidoresChange}
        transaction={editingTransaction}
      />
    </div>
  )
}
