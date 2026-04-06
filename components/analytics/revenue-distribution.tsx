'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction, PlanoEntrada } from '@/lib/types'

interface RevenueDistributionProps {
  transactions: Transaction[]
  planos: PlanoEntrada[]
  month: number
  year: number
}

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

function classify(description: string, planos: PlanoEntrada[]): string {
  const desc = description.toLowerCase()
  const plano = planos.find(p => desc.includes(p.codigo.toLowerCase()) || desc.includes(p.descricao.toLowerCase()))
  if (plano) {
    if (plano.tipo === 'renovacao') return 'Renovação'
    if (plano.tipo === 'novo') return 'Cliente Novo'
  }
  if (desc.includes('trimest') || desc.includes('3 mes') || desc.includes('3mes')) return 'Trimestral'
  if (desc.includes('revend')) return 'Revendedor'
  return 'Outros'
}

export function RevenueDistribution({ transactions, planos, month, year }: RevenueDistributionProps) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return t.type === 'income' && d.getMonth() === month && d.getFullYear() === year
      })
      .forEach(t => {
        const cat = classify(t.description, planos)
        map[cat] = (map[cat] ?? 0) + t.amount
      })

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, planos, month, year])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição da Receita</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma receita no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: 12, color: 'var(--color-card-foreground)' }}
                labelStyle={{ color: 'var(--color-card-foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--color-card-foreground)' }}
                formatter={(value: number) => [formatCurrency(value)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
