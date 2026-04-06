'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiCards } from '@/components/analytics/kpi-cards'
import { RevenueChart } from '@/components/analytics/revenue-chart'
import { TopRevenue } from '@/components/analytics/top-revenue'
import { TopExpenses } from '@/components/analytics/top-expenses'
import { ServerProfit } from '@/components/analytics/server-profit'
import { RevenueDistribution } from '@/components/analytics/revenue-distribution'
import { MonthlyComparison } from '@/components/analytics/monthly-comparison'
import { InsightsPanel } from '@/components/analytics/insights-panel'
import type { Transaction, Servidor, CreditMovement, PlanoEntrada } from '@/lib/types'

interface AnalyticsPageProps {
  transactions: Transaction[]
  servidores: Servidor[]
  movements: CreditMovement[]
  planos: PlanoEntrada[]
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function AnalyticsPage({ transactions, servidores, movements, planos }: AnalyticsPageProps) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year,  setYear]  = useState(today.getFullYear())

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={nextMonth}
            disabled={isCurrentMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards
        transactions={transactions}
        month={month}
        year={year}
        prevTransactions={transactions}
      />

      {/* Daily flow chart */}
      <RevenueChart transactions={transactions} month={month} year={year} />

      {/* Top revenue & expenses side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopRevenue   transactions={transactions} month={month} year={year} />
        <TopExpenses  transactions={transactions} month={month} year={year} />
      </div>

      {/* Server profit & revenue distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ServerProfit
          transactions={transactions}
          servidores={servidores}
          movements={movements}
          month={month}
          year={year}
        />
        <RevenueDistribution
          transactions={transactions}
          planos={planos}
          month={month}
          year={year}
        />
      </div>

      {/* Monthly comparison */}
      <MonthlyComparison
        transactions={transactions}
        currentMonth={month}
        currentYear={year}
      />

      {/* Insights */}
      <InsightsPanel transactions={transactions} month={month} year={year} />
    </div>
  )
}
