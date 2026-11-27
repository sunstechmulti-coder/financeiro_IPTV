'use client'

import { useEffect, useState } from 'react'
import { Box } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { SummaryCards } from '../../components/summary-cards'
import { ActivityFilter } from '../../components/activity-filter'
import { ActivityOverview } from '../../components/activity-overview'
import { PrintingTransactionDialog } from '../../components/printing-transaction-dialog'
import { ActivityAnalytics } from '../../components/analytics/activity-analytics'
import { TransactionsTable } from '../../components/transactions-table'
import { filterActivity, financialSummary, monthTransactions } from '../../lib/activity'
import type { ActivityScope } from '../../lib/activity'
import type { Transaction } from '../../lib/types'

const initialRows: Transaction[] = [
  { id: 'i1', date: '2026-11-27', type: 'income', description: 'Vendas IPTV de exemplo', amount: 17000, activity: 'iptv', createdAt: '2026-11-27T10:00:00Z' },
  { id: 'i2', date: '2026-11-27', type: 'expense', description: 'Despesas IPTV de exemplo', amount: 8400, activity: 'iptv', createdAt: '2026-11-27T10:00:00Z' },
  { id: 'p1', date: '2026-11-26', type: 'income', description: 'Chaveiros personalizados', amount: 180, activity: 'printing_3d', printingDetails: { customerName: 'Cliente exemplo A', productName: 'Chaveiros', paymentMethod: 'Pix' }, createdAt: '2026-11-26T10:00:00Z' },
  { id: 'p2', date: '2026-11-25', type: 'income', description: 'Peça personalizada', amount: 200, activity: 'printing_3d', printingDetails: { customerName: 'Cliente exemplo B', productName: 'Peças personalizadas', paymentMethod: 'Pix' }, createdAt: '2026-11-25T10:00:00Z' },
  { id: 'p3', date: '2026-11-24', type: 'income', description: 'Lote de miniaturas', amount: 1620, activity: 'printing_3d', printingDetails: { customerName: 'Cliente exemplo C', productName: 'Miniaturas', paymentMethod: 'Pix' }, createdAt: '2026-11-24T10:00:00Z' },
  { id: 'p4', date: '2026-11-24', type: 'expense', description: 'Filamentos e materiais', amount: 600, activity: 'printing_3d', printingDetails: { category: 'Filamentos' }, createdAt: '2026-11-24T10:00:00Z' },
  { id: 'u1', date: '2026-11-23', type: 'income', description: 'Histórico ainda não classificado', amount: 300, createdAt: '2026-11-23T10:00:00Z' },
]

export default function ReviewFixture() {
  const [rows, setRows] = useState(initialRows)
  const [scope, setScope] = useState<ActivityScope>('all')
  const [tab, setTab] = useState('Dashboard')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [failure, setFailure] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  useEffect(() => { document.documentElement.classList.add('dark') }, [])
  const selected = filterActivity(rows, scope)
  const summary = financialSummary(monthTransactions(selected, 10, 2026))
  return <div className="min-h-screen bg-background text-foreground">
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-400">
      Ambiente de teste visual · dados fictícios · nenhuma conexão com o banco real
    </div>
    <header className="border-b border-border bg-card px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-lg font-bold"><Box className="h-7 w-7 text-primary" />Cash Flow</span>
      <nav className="flex gap-2">{['Dashboard', 'Transações', 'Analytics'].map(name => <Button key={name} size="sm" variant={tab === name ? 'secondary' : 'ghost'} onClick={() => setTab(name)}>{name}</Button>)}</nav>
      <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>Nova venda 3D</Button>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 p-5">
      <ActivityFilter value={scope} unclassified={rows.filter(t => !t.activity).length} onChange={value => { setScope(value); if (value === 'unclassified') setTab('Transações') }} />
      {tab === 'Dashboard' && <>
        <p className="text-right text-sm font-semibold">Novembro 2026</p>
        <SummaryCards totalIncome={summary.income} totalExpenses={summary.expenses} balance={summary.balance} />
        <ActivityOverview transactions={rows} scope={scope} month={10} year={2026} onNew={() => { setEditing(null); setOpen(true) }} />
      </>}
      {tab === 'Analytics' && <ActivityAnalytics transactions={rows} scope={scope} />}
      {tab === 'Transações' && <TransactionsTable transactions={selected} showActivity
        onEdit={transaction => { if (transaction.activity === 'printing_3d') { setEditing(transaction); setOpen(true) } }}
        onDelete={id => setRows(previous => previous.filter(t => t.id !== id))} />}
      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        <label><input type="checkbox" checked={failure} onChange={event => setFailure(event.target.checked)} /> Simular falha de envio (somente teste)</label>
        <p>Salvamentos fictícios: <span data-testid="save-count">{saveCount}</span></p>
      </footer>
    </main>
    <PrintingTransactionDialog open={open} onOpenChange={setOpen} transaction={editing}
      onSave={async transaction => {
        await new Promise(resolve => setTimeout(resolve, 800))
        if (failure) throw new Error('Falha simulada')
        setRows(previous => editing ? previous.map(t => t.id === transaction.id ? transaction : t) : [transaction, ...previous])
        setSaveCount(previous => previous + 1)
        return true
      }} />
  </div>
}
