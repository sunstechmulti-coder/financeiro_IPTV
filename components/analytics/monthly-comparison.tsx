'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface MonthlyComparisonProps {
  transactions: Transaction[]
  currentMonth: number
  currentYear: number
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function MonthlyComparison({ transactions, currentMonth, currentYear }: MonthlyComparisonProps) {
  const data = useMemo(() => {
    const months: { month: number; year: number; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      months.push({ month: d.getMonth(), year: d.getFullYear(), label: MONTH_NAMES[d.getMonth()] })
    }

    return months.map(({ month, year, label }) => {
      const filtered = transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return d.getMonth() === month && d.getFullYear() === year
      })
      const income   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { label, Receita: income, Despesa: expenses, Lucro: income - expenses }
    })
  }, [transactions, currentMonth, currentYear])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Comparação — Últimos 6 meses</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={48} />
            <Tooltip
              contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: 12 }}
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Receita" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesa" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Lucro"   fill="var(--color-primary)"  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
