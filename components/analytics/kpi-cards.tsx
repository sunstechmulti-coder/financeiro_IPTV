'use client'

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  BarChart2,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface KpiCardsProps {
  transactions: Transaction[]
  month: number
  year: number
  prevTransactions: Transaction[]
}

interface HistoricalMonth {
  totalIncome: number
  progressRatio: number
  weight: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

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

  const today = new Date()
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth
  const avgDailyIncome = elapsedDays > 0 ? income / elapsedDays : 0
  const paceProjection = isCurrentMonth ? avgDailyIncome * daysInMonth : income

  /*
   * Analisa os três meses completos anteriores ao mês selecionado.
   * Os meses mais recentes recebem peso maior: 3, 2 e 1.
   */
  const historicalMonths: HistoricalMonth[] = [1, 2, 3]
    .map(monthOffset => {
      const historicalDate = new Date(year, month - monthOffset, 1)
      const historicalMonth = historicalDate.getMonth()
      const historicalYear = historicalDate.getFullYear()
      const historicalDays = new Date(historicalYear, historicalMonth + 1, 0).getDate()
      const comparableDay = Math.min(elapsedDays, historicalDays)

      const historicalIncomeTransactions = transactions.filter(t => {
        if (t.type !== 'income') return false
        const d = new Date(t.date + 'T00:00:00')
        return d.getMonth() === historicalMonth && d.getFullYear() === historicalYear
      })

      const totalIncome = historicalIncomeTransactions.reduce((sum, t) => sum + t.amount, 0)
      const incomeUntilComparableDay = historicalIncomeTransactions
        .filter(t => new Date(t.date + 'T00:00:00').getDate() <= comparableDay)
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        totalIncome,
        progressRatio: totalIncome > 0 ? incomeUntilComparableDay / totalIncome : 0,
        weight: 4 - monthOffset,
      }
    })
    .filter(item => item.totalIncome > 0 && item.progressRatio > 0)

  const totalHistoricalWeight = historicalMonths.reduce((sum, item) => sum + item.weight, 0)
  const weightedHistoricalProgress =
    totalHistoricalWeight > 0
      ? historicalMonths.reduce(
          (sum, item) => sum + item.progressRatio * item.weight,
          0,
        ) / totalHistoricalWeight
      : 0

  const historicalProjection =
    weightedHistoricalProgress > 0 ? income / weightedHistoricalProgress : paceProjection

  /*
   * A projeção combina o ritmo atual com o padrão dos meses anteriores.
   * O histórico pode representar até 60% do cálculo quando os três meses existem.
   */
  const historyWeight = (historicalMonths.length / 3) * 0.6
  const blendedProjection =
    paceProjection * (1 - historyWeight) + historicalProjection * historyWeight

  const projectedIncome = isCurrentMonth
    ? Math.max(income, blendedProjection)
    : income

  const historicalProgressAverage =
    historicalMonths.length > 0
      ? historicalMonths.reduce((sum, item) => sum + item.progressRatio, 0) /
        historicalMonths.length
      : 0

  const historicalVariation =
    historicalMonths.length > 1 && historicalProgressAverage > 0
      ? Math.sqrt(
          historicalMonths.reduce(
            (sum, item) => sum + Math.pow(item.progressRatio - historicalProgressAverage, 2),
            0,
          ) / historicalMonths.length,
        ) / historicalProgressAverage
      : historicalMonths.length === 1
        ? 0.35
        : 1

  const projectionDifference =
    paceProjection > 0
      ? Math.abs(historicalProjection - paceProjection) / paceProjection
      : 1

  const progressScore = (elapsedDays / daysInMonth) * 45
  const historyScore = (historicalMonths.length / 3) * 25
  const stabilityScore = (1 - clamp(historicalVariation, 0, 1)) * 20
  const agreementScore = (1 - clamp(projectionDifference, 0, 1)) * 10

  const confidence = isCurrentMonth
    ? Math.round(clamp(progressScore + historyScore + stabilityScore + agreementScore, 10, 99))
    : 100

  const confidenceLabel =
    confidence >= 90
      ? 'Muito alta'
      : confidence >= 75
        ? 'Alta'
        : confidence >= 50
          ? 'Moderada'
          : 'Baixa'

  const uncertainty = isCurrentMonth
    ? clamp((1 - confidence / 100) * 0.25 + projectionDifference * 0.15, 0.04, 0.25)
    : 0

  const probableMinimum = isCurrentMonth
    ? Math.max(income, projectedIncome * (1 - uncertainty))
    : income
  const probableMaximum = isCurrentMonth
    ? Math.max(projectedIncome, projectedIncome * (1 + uncertainty))
    : income

  const historyLabel =
    historicalMonths.length === 3
      ? 'Últimos 3 meses'
      : historicalMonths.length === 2
        ? 'Últimos 2 meses'
        : historicalMonths.length === 1
          ? 'Último mês'
          : 'Sem histórico'

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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map(({ label, value, icon: Icon, iconClass, bgClass, borderClass, cardBg, pct, invertPct }) => {
          const isPositive = pct !== null && (invertPct ? pct <= 0 : pct >= 0)

          return (
            <Card key={label} className={`${borderClass} ${cardBg}`}>
              <CardContent className="pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                    {pct !== null && (
                      <div
                        className={`flex items-center gap-0.5 text-xs font-medium ${
                          isPositive ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
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

      <Card className="border-primary/30 bg-card">
        <CardContent className="pt-0">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr_0.8fr] lg:items-stretch">
            <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">Média diária de entradas</p>

                <div className="flex flex-wrap items-end gap-2">
                  <p className="text-2xl font-bold sm:text-3xl">{formatCurrency(avgDailyIncome)}</p>
                  <span className="pb-1 text-sm text-muted-foreground sm:text-base">/ dia</span>
                </div>

                <p className="text-xs text-muted-foreground sm:text-sm">
                  {isCurrentMonth
                    ? `Baseado em ${elapsedDays} dias corridos de ${daysInMonth} do mês`
                    : `Baseado em ${daysInMonth} dias corridos do mês`}
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <BarChart2 className="h-5 w-5 text-primary" />
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isCurrentMonth ? 'Projeção inteligente do mês' : 'Fechamento do mês'}
                    </p>

                    {isCurrentMonth && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {historyLabel}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-2xl font-bold text-income sm:text-3xl">
                    {formatCurrency(projectedIncome)}
                  </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                {isCurrentMonth
                  ? historicalMonths.length > 0
                    ? `Ritmo atual + comportamento de ${historicalMonths.length === 1 ? '1 mês' : `${historicalMonths.length} meses`}`
                    : 'Mantendo o ritmo atual até formar histórico'
                  : 'Resultado consolidado do período selecionado'}
              </p>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-income/20 bg-income/5 px-3 py-2 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 shrink-0 text-income" />
                <span>
                  {isCurrentMonth
                    ? `Faixa provável: ${formatCurrency(probableMinimum)} a ${formatCurrency(probableMaximum)}`
                    : `Valor realizado: ${formatCurrency(income)}`}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">
                  {isCurrentMonth ? 'Confiabilidade' : 'Consolidado'}
                </p>
                <p className="text-3xl font-bold text-income">{confidence}%</p>
                <p className="font-medium text-income">{confidenceLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {isCurrentMonth
                    ? 'Baseada no histórico e na estabilidade das vendas'
                    : 'Mês encerrado'}
                </p>
              </div>

              <div
                className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(hsl(var(--income)) ${confidence * 3.6}deg, hsl(var(--muted)) 0deg)`,
                }}
                aria-label={`${confidence}% de confiabilidade`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card">
                  <ShieldCheck className="h-7 w-7 text-income" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}