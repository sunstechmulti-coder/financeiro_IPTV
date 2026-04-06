'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface TopRevenueProps {
  transactions: Transaction[]
  month: number
  year: number
}

export function TopRevenue({ transactions, month, year }: TopRevenueProps) {
  const data = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {}
    transactions
      .filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return t.type === 'income' && d.getMonth() === month && d.getFullYear() === year
      })
      .forEach(t => {
        const key = t.description.trim().toUpperCase()
        if (!map[key]) map[key] = { qty: 0, total: 0 }
        map[key].qty += 1
        map[key].total += t.amount
      })

    return Object.entries(map)
      .map(([desc, { qty, total }]) => ({ desc, qty, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [transactions, month, year])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Top Receitas do Mês</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma receita no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="desc" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: 12 }}
                formatter={(value: number, _: string, props: { payload?: { qty: number } }) => [
                  `${formatCurrency(value)} (${props.payload?.qty ?? 0}x)`,
                  'Receita',
                ]}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={`oklch(0.7 0.18 ${145 + i * 12})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
