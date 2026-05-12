'use client'

import { Database, MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CreditMovement, Servidor, Transaction } from '@/lib/types'
import { formatDate } from '@/lib/format'

interface CreditsCardProps {
  servidores: Servidor[]
  movements: CreditMovement[]
  transactions?: Transaction[]
}

type MovementDirection = 'in' | 'out'

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const parsed = Number(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCredits(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function getMovementDirection(movement: CreditMovement): MovementDirection {
  const rawType = normalizeText(movement.type)
  const credits = toNumber(movement.credits)

  if (
    rawType.includes('purchase') ||
    rawType.includes('compra') ||
    rawType.includes('entrada') ||
    rawType.includes('recarga') ||
    rawType === 'in'
  ) {
    return 'in'
  }

  if (
    rawType.includes('sale') ||
    rawType.includes('venda') ||
    rawType.includes('consumption') ||
    rawType.includes('consumo') ||
    rawType.includes('saida') ||
    rawType.includes('uso') ||
    rawType === 'out'
  ) {
    return 'out'
  }

  return credits >= 0 ? 'in' : 'out'
}

function getMovementTimestamp(movement: CreditMovement, transaction?: Transaction) {
  const rawDate =
    transaction?.createdAt ||
    transaction?.date ||
    movement.date

  const parsed = rawDate?.includes?.('T')
    ? new Date(rawDate)
    : new Date(`${rawDate}T00:00:00`)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

export function CreditsCard({ servidores, movements, transactions = [] }: CreditsCardProps) {
  const totalCredits = servidores.reduce((sum, s) => sum + (s.creditsBalance ?? 0), 0)

  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]))

  const getServidorNome = (id: string | null | undefined) => {
    if (!id) return 'Sem servidor'
    return servidores.find((s) => s.id === id)?.nome ?? id
  }

  const recentMovements = [...movements]
    .map((movement) => {
      const transaction = movement.transactionId
        ? transactionsById.get(movement.transactionId)
        : undefined

      const direction = getMovementDirection(movement)
      const serverId = movement.serverId || transaction?.serverId || ''
      const serverName = getServidorNome(serverId)
      const credits = Math.abs(toNumber(movement.credits))
      const description =
        transaction?.description ||
        (direction === 'in'
          ? `Entrada de créditos — ${serverName}`
          : `Saída de créditos — ${serverName}`)

      return {
        ...movement,
        direction,
        serverId,
        serverName,
        description,
        credits,
        timestamp: getMovementTimestamp(movement, transaction),
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)

  const getRechargeUrl = (servidor: Servidor) => {
    const rawPhone = servidor.supplierWhatsapp ?? ''
    const digits = rawPhone.replace(/\D/g, '')

    if (!digits) return null

    const rechargeQuantity =
      (servidor as Servidor & { rechargeQuantity?: number }).rechargeQuantity
      ?? servidor.riskCredits
      ?? 10

    let phone = digits

    if (phone.startsWith('00')) {
      phone = phone.slice(2)
    } else if (phone.length <= 11) {
      phone = `55${phone}`
    }

    const message = encodeURIComponent(
      `Olá! Preciso de uma recarga de *${rechargeQuantity}* créditos para o servidor *${servidor.nome}*.
Usuário do Painel: *${servidor.panelUsername || 'não informado'}*

Pode me confirmar o valor para pagamento, por favor?

Pelo custo cadastrado, o valor estimado é de R$ ${(servidor.custoUnitario * rechargeQuantity).toFixed(2)}. Confere esse valor?`
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
              {formatCredits(totalCredits)}
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
                  className={cn(
                    'rounded-lg border p-3 text-center',
                    isZero
                      ? 'border-red-500/40 bg-red-500/10'
                      : isLow
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-income/30 bg-income/5'
                  )}
                >
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {s.nome}
                  </p>

                  <p
                    className={cn(
                      'mt-1 text-xl font-bold tabular-nums',
                      isZero
                        ? 'text-red-500'
                        : isLow
                          ? 'text-amber-500'
                          : 'text-income'
                    )}
                  >
                    {formatCredits(bal)}
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
                      className="mt-2 h-auto w-full max-w-full rounded-full bg-green-600 px-3 py-2 text-xs leading-tight whitespace-normal text-white hover:bg-green-700 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={() => window.open(rechargeUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />
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
              Últimas movimentações de créditos
            </p>

            <div className="overflow-hidden rounded-lg border">
              <div className="hidden grid-cols-[110px_90px_minmax(130px,1fr)_110px] gap-3 border-b bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                <span>Data</span>
                <span>Tipo</span>
                <span>Operação</span>
                <span className="text-right">Créditos</span>
              </div>

              <div className="divide-y">
                {recentMovements.map((movement) => {
                  const isIn = movement.direction === 'in'

                  return (
                    <div
                      key={movement.id}
                      className="px-3 py-3 md:grid md:grid-cols-[110px_90px_minmax(130px,1fr)_110px] md:items-center md:gap-3 md:py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3 md:contents">
                        <div className="min-w-0 md:order-1">
                          <p className="text-xs font-medium text-muted-foreground md:text-sm md:text-foreground">
                            {formatDate(movement.date)}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground md:hidden">
                            {movement.serverName}
                          </p>
                        </div>

                        <div className="md:order-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                              isIn ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                isIn ? 'bg-income' : 'bg-expense'
                              )}
                            />
                            {isIn ? 'Entrada' : 'Saída'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 min-w-0 md:order-3 md:mt-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {movement.description}
                        </p>
                        <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">
                          {movement.serverName}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'mt-2 text-right text-sm font-bold tabular-nums md:order-4 md:mt-0',
                          isIn ? 'text-income' : 'text-expense'
                        )}
                      >
                        {isIn ? '+' : '−'}
                        {formatCredits(movement.credits)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
