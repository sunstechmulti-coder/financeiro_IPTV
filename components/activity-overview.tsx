'use client'

import { Box, Plus, ShoppingBag, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { activityBreakdown, filterActivity, financialSummary, monthTransactions } from '@/lib/activity'
import type { ActivityScope } from '@/lib/activity'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface Props {
  transactions: Transaction[]
  scope: ActivityScope
  month: number
  year: number
  onNew: () => void
}

export function ActivityOverview({ transactions, scope, month, year, onNew }: Props) {
  const monthly = monthTransactions(transactions, month, year)
  const printing = filterActivity(monthly, 'printing_3d')
  const summary = financialSummary(printing)
  const recent = [...printing].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  return <div className="space-y-4">
    {scope === 'all' && <Card>
      <CardHeader><CardTitle className="text-base">Resultado por atividade</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground"><tr><th className="pb-3 text-left">Atividade</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>{activityBreakdown(monthly).map(row => <tr key={row.activity} className="border-t border-border">
            <td className="py-3 pr-3">{row.label}</td><td className="text-right text-income">{formatCurrency(row.income)}</td>
            <td className="text-right text-expense">{formatCurrency(row.expenses)}</td>
            <td className="text-right font-semibold">{formatCurrency(row.balance)}</td>
          </tr>)}</tbody>
        </table>
      </CardContent>
    </Card>}
    {(scope === 'printing_3d' || scope === 'all') && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="flex items-center gap-3">
          <ShoppingBag className="h-6 w-6 text-primary" /><div><p className="text-sm text-muted-foreground">Vendas 3D no mês</p><p className="text-2xl font-bold">{summary.sales}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" /><div><p className="text-sm text-muted-foreground">Clientes identificados nas vendas 3D</p><p className="text-2xl font-bold">{summary.customers}</p></div>
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><Box className="h-5 w-5 text-primary" />Impressão 3D</CardTitle>
          <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" />Venda 3D</Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lançamento 3D neste mês.</p> :
            <div className="divide-y divide-border">{recent.map(t => <div key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">{t.printingDetails?.customerName || 'Cliente não informado'} · {formatDate(t.date)}</p></div>
              <span className={t.type === 'income' ? 'shrink-0 text-sm font-semibold text-income' : 'shrink-0 text-sm font-semibold text-expense'}>
                {t.type === 'expense' ? '− ' : ''}{formatCurrency(t.amount)}
              </span>
            </div>)}</div>}
        </CardContent>
      </Card>
    </>}
  </div>
}
