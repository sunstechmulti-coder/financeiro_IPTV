'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface RevenueChartProps {
  transactions: Transaction[]
  month: number
  year: number
}

const COLORS = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  profit: 'var(--color-primary)',
}

export function RevenueChart({ transactions, month, year }: RevenueChartProps) {
  const data = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: Record<number, { income: number; expense: number }> = {}
    for (let d = 1; d <= daysInMonth; d++) days[d] = { income: 0, expense: 0 }

    transactions.forEach(t => {
      const d = new Date(t.date + 'T00:00:00')
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate()
        if (t.type === 'income') days[day].income += t.amount
        else days[day].expense += t.amount
      }
    })

    return Object.entries(days).map(([day, { income, expense }]) => ({
      dia: Number(day),
      Entradas: income,
      Saídas: expense,
      Lucro: income - expense,
    }))
  }, [transactions, month, year])

  const hasData = data.some(d => d.Entradas > 0 || d['Saídas'] > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Fluxo Financeiro Diário</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum dado para o período selecionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={48} />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: 12 }}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelFormatter={(l) => `Dia ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="Entradas" stroke={COLORS.income} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Saídas" stroke={COLORS.expense} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Lucro" stroke={COLORS.profit} dot={false} strokeWidth={2} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
