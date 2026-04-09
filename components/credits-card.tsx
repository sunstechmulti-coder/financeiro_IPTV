'use client'

import { Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Servidor } from '@/lib/types'
import type { CreditMovement } from '@/lib/types'
import { formatDate } from '@/lib/format'

interface CreditsCardProps {
  servidores: Servidor[]
  movements: CreditMovement[]
}

export function CreditsCard({ servidores, movements }: CreditsCardProps) {
  const withBalance = servidores.filter((s) => (s.creditsBalance ?? 0) > 0)
  const totalCredits = servidores.reduce((sum, s) => sum + (s.creditsBalance ?? 0), 0)

  // Last 8 movements, most recent first
  const recentMovements = [...movements]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  const getServidorNome = (id: string) =>
    servidores.find((s) => s.id === id)?.nome ?? id

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Créditos por Servidor</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total geral</p>
            <p className="text-lg font-bold tabular-nums text-primary">
              {totalCredits.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Balances grid */}
        {servidores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum servidor cadastrado.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {servidores.map((s) => {
              const bal = s.creditsBalance ?? 0
              const low = bal > 0 && bal <= 10
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 text-center ${bal === 0
                      ? 'border-border bg-muted/30'
                      : low
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-income/30 bg-income/5'
                    }`}
                >
                  <p className="text-xs font-medium text-muted-foreground truncate">{s.nome}</p>
                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${bal === 0 ? 'text-muted-foreground' : low ? 'text-amber-500' : 'text-income'
                      }`}
                  >
                    {bal.toLocaleString('pt-BR')}
                  </p>
                  {low && bal > 0 && (
                    <p className="text-xs text-amber-500 mt-0.5">baixo</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Recent movements */}
        {recentMovements.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Últimas movimentações
            </p>
            <div className="rounded-lg border divide-y">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.type === 'purchase' ? 'bg-income' : 'bg-expense'
                        }`}
                    />
                    <span className="text-xs text-muted-foreground truncate">
                      {formatDate(m.date)} — {getServidorNome(m.serverId)}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums shrink-0 ml-2 ${m.type === 'purchase' ? 'text-income' : 'text-expense'
                      }`}
                  >
                    {m.type === 'purchase' ? '+' : '−'}{m.credits}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}


      </CardContent>
    </Card>
  )
}
