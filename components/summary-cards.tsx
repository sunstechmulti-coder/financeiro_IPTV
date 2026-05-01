'use client'

import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'

interface SummaryCardsProps {
  totalIncome: number
  totalExpenses: number
  balance: number
}

export function SummaryCards({
  totalIncome,
  totalExpenses,
  balance,
}: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-income-muted bg-income-muted/20">
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Entradas</p>
              <p className="text-2xl font-bold text-income">
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-income/10">
              <TrendingUp className="h-6 w-6 text-income" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-expense-muted bg-expense-muted/20">
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Saídas</p>
              <p className="text-2xl font-bold text-expense">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-expense/10">
              <TrendingDown className="h-6 w-6 text-expense" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/10">
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo do Mês</p>
              <p
                className={`text-2xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}`}
              >
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
