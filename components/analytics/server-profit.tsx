'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction, Servidor } from '@/lib/types'

interface ServerProfitProps {
  transactions: Transaction[]
  servidores: Servidor[]
  movements: CreditMovement[]
  month: number
  year: number
}

export function ServerProfit({ transactions, servidores, month, year }: ServerProfitProps) {
  const data = useMemo(() => {
    return servidores.map(srv => {
      const txsThisMonth = transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return t.serverId === srv.id && d.getMonth() === month && d.getFullYear() === year
      })

      const revenue = txsThisMonth
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)

      // Custo real = soma dos créditos consumidos × custo unitário do servidor
      // creditsDelta é negativo quando créditos são consumidos (venda de plano)
      const creditsConsumed = txsThisMonth
        .filter(t => t.type === 'income' && t.creditsDelta != null && t.creditsDelta < 0)
        .reduce((s, t) => s + Math.abs(t.creditsDelta!), 0)

      const cost = creditsConsumed * srv.custoUnitario
      const profit = revenue - cost
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0

      return { nome: srv.nome, revenue, cost, profit, margin }
    }).filter(s => s.revenue > 0 || s.cost > 0)
  }, [transactions, servidores, month, year])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Performance por Servidor</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum dado de servidor no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Servidor</th>
                  <th className="pb-2 text-right font-medium">Receita</th>
                  <th className="pb-2 text-right font-medium">Custo créditos</th>
                  <th className="pb-2 text-right font-medium">Lucro est.</th>
                  <th className="pb-2 text-right font-medium">Margem %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map(row => (
                  <tr key={row.nome}>
                    <td className="py-2 font-medium">{row.nome}</td>
                    <td className="py-2 text-right text-income">{formatCurrency(row.revenue)}</td>
                    <td className="py-2 text-right text-expense">{formatCurrency(row.cost)}</td>
                    <td className={`py-2 text-right font-semibold ${row.profit >= 0 ? 'text-income' : 'text-expense'}`}>
                      {formatCurrency(row.profit)}
                    </td>
                    <td className={`py-2 text-right text-sm ${row.margin >= 50 ? 'text-income' : row.margin >= 20 ? 'text-yellow-400' : 'text-expense'}`}>
                      {row.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
