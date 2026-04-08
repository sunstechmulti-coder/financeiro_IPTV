'use client'

import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface KpiCardsProps {
  transactions: Transaction[]
  month: number
  year: number
  prevTransactions: Transaction[]
}

export function KpiCards({ transactions, month, year, prevTransactions }: KpiCardsProps) {
  const filtered = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    return d.getMonth() === month && d.getFullYear() === year
  })

  const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const profit = income - expenses
  const sales = filtered.filter(t => t.type === 'income').length
  const ticket = sales > 0 ? income / sales : 0

  const prevFiltered = prevTransactions.filter(t => {
    const prev = new Date(year, month - 1, 1)
    const d = new Date(t.date + 'T00:00:00')
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear()
  })
  const prevIncome = prevFiltered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const prevExpenses = prevFiltered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const prevProfit = prevIncome - prevExpenses

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return null
    return ((curr - prev) / Math.abs(prev)) * 100
  }

  const incomePct = pctChange(income, prevIncome)
  const expensesPct = pctChange(expenses, prevExpenses)
  const profitPct = pctChange(profit, prevProfit)

  const kpis = [
    {
      label: 'Receita do mês',
      value: formatCurrency(income),
      icon: TrendingUp,
      iconClass: 'text-income',
      bgClass: 'bg-income/10',
      borderClass: 'border-income-muted',
      cardBg: 'bg-income-muted/20',
      pct: incomePct,
    },
    {
      label: 'Despesas do mês',
      value: formatCurrency(expenses),
      icon: TrendingDown,
      iconClass: 'text-expense',
      bgClass: 'bg-expense/10',
      borderClass: 'border-expense-muted',
      cardBg: 'bg-expense-muted/20',
      pct: expensesPct,
      invertPct: true,
    },
    {
      label: 'Lucro do mês',
      value: formatCurrency(profit),
      icon: DollarSign,
      iconClass: profit >= 0 ? 'text-income' : 'text-expense',
      bgClass: profit >= 0 ? 'bg-income/10' : 'bg-expense/10',
      borderClass: 'border-primary/30',
      cardBg: 'bg-primary/10',
      pct: profitPct,
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(ticket),
      icon: BarChart2,
      iconClass: 'text-primary',
      bgClass: 'bg-primary/10',
      borderClass: 'border-primary/30',
      cardBg: 'bg-primary/5',
      pct: null,
    },
    {
      label: 'Qtd. de vendas',
      value: sales.toString(),
      icon: ShoppingCart,
      iconClass: 'text-primary',
      bgClass: 'bg-primary/10',
      borderClass: 'border-primary/30',
      cardBg: 'bg-primary/5',
      pct: null,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {kpis.map(({ label, value, icon: Icon, iconClass, bgClass, borderClass, cardBg, pct, invertPct }) => {
        const isPositive = pct !== null && (invertPct ? pct <= 0 : pct >= 0)
        return (
          <Card key={label} className={`${borderClass} ${cardBg}`}>
            <CardContent className="pt-0">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                  {pct !== null && (
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-income' : 'text-expense'}`}>
                      {isPositive
                        ? <ArrowUpRight className="h-3 w-3" />
                        : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(pct).toFixed(1)}% vs mês ant.
                    </div>
                  )}
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bgClass}`}>
                  <Icon className={`h-5 w-5 ${iconClass}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}