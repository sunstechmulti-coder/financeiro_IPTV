'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction, Servidor, CreditMovement } from '@/lib/types'

interface ServerProfitProps {
  transactions: Transaction[]
  servidores: Servidor[]
  movements: CreditMovement[]
  month: number
  year: number
}

export function ServerProfit({ transactions, servidores, movements, month, year }: ServerProfitProps) {
  const data = useMemo(() => {
    return servidores.map(srv => {
      const txsThisMonth = transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return t.serverId === srv.id && d.getMonth() === month && d.getFullYear() === year
      })

      const revenue = txsThisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

      // Cost = sum of credits sold (sale movements) * unit cost
      const creditsSold = movements
        .filter(m => {
          const d = new Date(m.date + 'T00:00:00')
          return m.serverId === srv.id && m.type === 'sale' && d.getMonth() === month && d.getFullYear() === year
        })
        .reduce((s, m) => s + m.credits, 0)

      const cost = creditsSold * srv.custoUnitario
      const profit = revenue - cost

      return { nome: srv.nome, revenue, cost, profit }
    }).filter(s => s.revenue > 0 || s.cost > 0)
  }, [transactions, servidores, movements, month, year])

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
