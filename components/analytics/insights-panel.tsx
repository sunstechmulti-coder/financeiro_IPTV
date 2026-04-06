'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Star, AlertTriangle, DollarSign, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface InsightsPanelProps {
  transactions: Transaction[]
  month: number
  year: number
}

export function InsightsPanel({ transactions, month, year }: InsightsPanelProps) {
  const insights = useMemo(() => {
    const curr = transactions.filter(t => {
      const d = new Date(t.date + 'T00:00:00')
      return d.getMonth() === month && d.getFullYear() === year
    })

    const prev = transactions.filter(t => {
      const prevDate = new Date(year, month - 1, 1)
      const d = new Date(t.date + 'T00:00:00')
      return d.getMonth() === prevDate.getMonth() && d.getFullYear() === prevDate.getFullYear()
    })

    const incomes  = curr.filter(t => t.type === 'income')
    const expenses = curr.filter(t => t.type === 'expense')

    const income  = incomes.reduce((s, t) => s + t.amount, 0)
    const expense = expenses.reduce((s, t) => s + t.amount, 0)
    const profit  = income - expense

    const prevIncome  = prev.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const prevProfit  = prevIncome - prev.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    // Most sold product
    const salesMap: Record<string, number> = {}
    incomes.forEach(t => {
      const key = t.description.trim().toUpperCase()
      salesMap[key] = (salesMap[key] ?? 0) + 1
    })
    const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1])
    const topSeller    = sorted[0]
    const bottomSeller = sorted[sorted.length - 1]

    // Biggest single transaction
    const biggestSale    = incomes.length  ? incomes.reduce((a, b) => a.amount > b.amount ? a : b)  : null
    const biggestExpense = expenses.length ? expenses.reduce((a, b) => a.amount > b.amount ? a : b) : null

    const variation = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : null

    return { profit, topSeller, bottomSeller, biggestSale, biggestExpense, variation }
  }, [transactions, month, year])

  const items = [
    {
      icon: Star,
      iconClass: 'text-income',
      label: 'Produto mais vendido',
      value: insights.topSeller ? `${insights.topSeller[0]} (${insights.topSeller[1]}x)` : '—',
    },
    {
      icon: BarChart2,
      iconClass: 'text-muted-foreground',
      label: 'Produto menos vendido',
      value: insights.bottomSeller && insights.bottomSeller !== insights.topSeller
        ? `${insights.bottomSeller[0]} (${insights.bottomSeller[1]}x)` : '—',
    },
    {
      icon: TrendingUp,
      iconClass: 'text-income',
      label: 'Maior venda',
      value: insights.biggestSale ? `${formatCurrency(insights.biggestSale.amount)} — ${insights.biggestSale.description}` : '—',
    },
    {
      icon: AlertTriangle,
      iconClass: 'text-expense',
      label: 'Maior despesa',
      value: insights.biggestExpense ? `${formatCurrency(insights.biggestExpense.amount)} — ${insights.biggestExpense.description}` : '—',
    },
    {
      icon: DollarSign,
      iconClass: insights.profit >= 0 ? 'text-income' : 'text-expense',
      label: 'Lucro do mês',
      value: formatCurrency(insights.profit),
    },
    {
      icon: insights.variation !== null && insights.variation >= 0 ? TrendingUp : TrendingDown,
      iconClass: insights.variation !== null && insights.variation >= 0 ? 'text-income' : 'text-expense',
      label: 'Variação vs mês anterior',
      value: insights.variation !== null ? `${insights.variation >= 0 ? '+' : ''}${insights.variation.toFixed(1)}%` : '—',
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Insights Automáticos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, iconClass, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card">
                <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                <p className="break-words text-sm font-semibold leading-snug">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
