'use client'

import { Database, MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Servidor } from '@/lib/types'
import type { CreditMovement } from '@/lib/types'
import { formatDate } from '@/lib/format'

interface CreditsCardProps {
  servidores: Servidor[]
  movements: CreditMovement[]
}

export function CreditsCard({ servidores, movements }: CreditsCardProps) {
  const totalCredits = servidores.reduce((sum, s) => sum + (s.creditsBalance ?? 0), 0)

  const recentMovements = [...movements]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  const getServidorNome = (id: string) =>
    servidores.find((s) => s.id === id)?.nome ?? id

  const getRechargeUrl = (servidor: Servidor) => {
    const rawPhone = servidor.supplierWhatsapp ?? ''
    const digits = rawPhone.replace(/\D/g, '')

    if (!digits) return null

    const phone = digits.startsWith('55') ? digits : `55${digits}`
    const message = encodeURIComponent(
      `Olá! Preciso solicitar recarga de créditos do servidor ${servidor.nome}. Saldo atual: ${servidor.creditsBalance ?? 0} créditos.`
    )

    return `https://wa.me/${phone}?text=${message}`
  }

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
        {servidores.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum servidor cadastrado.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {servidores.map((s) => {
              const bal = s.creditsBalance ?? 0
              const riskLimit = s.riskCredits ?? 10
              const isZero = bal === 0
              const isLow = bal > 0 && bal <= riskLimit
              const rechargeUrl = getRechargeUrl(s)

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 text-center ${isZero
                      ? 'border-red-500/40 bg-red-500/10'
                      : isLow
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-income/30 bg-income/5'
                    }`}
                >
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {s.nome}
                  </p>

                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${isZero
                        ? 'text-red-500'
                        : isLow
                          ? 'text-amber-500'
                          : 'text-income'
                      }`}
                  >
                    {bal.toLocaleString('pt-BR')}
                  </p>

                  {isZero && (
                    <p className="mt-0.5 text-xs text-red-500">zerado</p>
                  )}

                  {isLow && !isZero && (
                    <p className="mt-0.5 text-xs text-amber-500">
                      risco ({riskLimit})
                    </p>
                  )}

                  {(isZero || isLow) && rechargeUrl && (
                    <Button
                      size="sm"
                      variant={isZero ? 'destructive' : 'secondary'}
                      className="mt-2 h-7 w-full text-xs"
                      onClick={() => window.open(rechargeUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <MessageCircle className="mr-1 h-3.5 w-3.5" />
                      Solicitar recarga
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {recentMovements.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Últimas movimentações
            </p>
            <div className="divide-y rounded-lg border">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.type === 'purchase' ? 'bg-income' : 'bg-expense'
                        }`}
                    />
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDate(m.date)} — {getServidorNome(m.serverId)}
                    </span>
                  </div>
                  <span
                    className={`ml-2 shrink-0 text-sm font-semibold tabular-nums ${m.type === 'purchase' ? 'text-income' : 'text-expense'
                      }`}
                  >
                    {m.type === 'purchase' ? '+' : '−'}
                    {m.credits}
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