'use client'

import { Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ActivationTransaction } from '@/lib/types'
import { formatDate } from '@/lib/format'

interface ActivationsCardProps {
  transactions: ActivationTransaction[]
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function ActivationsCard({ transactions }: ActivationsCardProps) {
  const totalVendas   = transactions.length
  const totalLucro    = transactions.reduce((s, t) => s + t.lucro, 0)
  const totalReceita  = transactions.reduce((s, t) => s + t.valorVenda, 0)

  // Contagem por faixa de custo
  const byRange = transactions.reduce<Record<string, { count: number; lucro: number }>>((acc, t) => {
    const faixa = t.custo <= 1.0 ? 'Faixa 0.5–1.0' : 'Faixa 1.1–1.9'
    if (!acc[faixa]) acc[faixa] = { count: 0, lucro: 0 }
    acc[faixa].count++
    acc[faixa].lucro += t.lucro
    return acc
  }, {})

  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Ativações</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total de ativações</p>
            <p className="text-lg font-bold tabular-nums text-primary">{totalVendas}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Resumo geral */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-income/5 border-income/20 p-3">
            <p className="text-xs text-muted-foreground">Receita total</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-income">
              {formatCurrency(totalReceita)}
            </p>
          </div>
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
            <p className="text-xs text-muted-foreground">Lucro total</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">
              {formatCurrency(totalLucro)}
            </p>
          </div>
        </div>

        {/* Por faixa */}
        {Object.keys(byRange).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Por faixa de custo
            </p>
            <div className="space-y-1.5">
              {Object.entries(byRange).map(([faixa, data]) => (
                <div key={faixa} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{faixa}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{data.count} {data.count === 1 ? 'ativação' : 'ativações'}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-income">
                    {formatCurrency(data.lucro)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Últimas ativações */}
        {recent.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Últimas ativações
            </p>
            <div className="rounded-lg border divide-y">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.productNome}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(t.date)} — custo {formatCurrency(t.custo)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold tabular-nums text-income">
                      {formatCurrency(t.valorVenda)}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      lucro {formatCurrency(t.lucro)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {transactions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma ativação registrada ainda.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
