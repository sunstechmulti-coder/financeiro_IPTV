'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface TopExpensesProps {
  transactions: Transaction[]
  month: number
  year: number
}

export function TopExpenses({ transactions, month, year }: TopExpensesProps) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year
      })
      .forEach(t => {
        const key = t.description.trim().toUpperCase()
        map[key] = (map[key] ?? 0) + t.amount
      })

    return Object.entries(map)
      .map(([desc, total]) => ({ desc, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [transactions, month, year])

  const renderYAxisTick = (props: any) => {
    const { x, y, payload } = props
    const value = String(payload?.value ?? '')
    const label = value.length > 18 ? `${value.slice(0, 17)}…` : value

    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fontSize={11}
        fill="var(--color-muted-foreground)"
      >
        {label}
      </text>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Top Despesas do Mês</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
              />
              <YAxis
                type="category"
                dataKey="desc"
                tickLine={false}
                axisLine={false}
                width={132}
                interval={0}
                tick={renderYAxisTick}
              />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: 12, color: 'var(--color-card-foreground)' }}
                labelStyle={{ color: 'var(--color-card-foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--color-card-foreground)' }}
                formatter={(value: number) => [formatCurrency(value), 'Despesa']}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={`oklch(0.65 0.2 ${20 + i * 8})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}