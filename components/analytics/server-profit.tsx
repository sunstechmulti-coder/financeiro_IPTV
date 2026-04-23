'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Crown } from 'lucide-react'
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

type SortKey = 'revenue' | 'profit' | 'margin' | 'cost' | 'name'

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'revenue', label: 'Receita ↓' },
  { key: 'profit', label: 'Lucro est. ↓' },
  { key: 'margin', label: 'Margem % ↓' },
  { key: 'cost', label: 'Custo créditos ↓' },
  { key: 'name', label: 'Nome A-Z' },
]

export function ServerProfit({ transactions, servidores, month, year }: ServerProfitProps) {
  const [sortBy, setSortBy] = useState<SortKey>('revenue')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!sortMenuRef.current) return
      if (!sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSortMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const data = useMemo(() => {
    const getServidorUnitCost = (srv: Servidor) => {
      const raw = srv as unknown as Record<string, unknown>
      const value =
        raw.unit_cost ??
        raw.unitCost ??
        raw.custo_unitario ??
        raw.custoUnitario ??
        raw.custo ??
        raw.custoUnitarioCredito ??
        0

      const numericValue = Number(value)
      return Number.isFinite(numericValue) ? numericValue : 0
    }

    const getTransactionCost = (t: Transaction, srv: Servidor) => {
      if (typeof t.costSnapshot === 'number' && Number.isFinite(t.costSnapshot)) {
        return t.costSnapshot
      }

      if (
        typeof t.unitCostSnapshot === 'number' &&
        Number.isFinite(t.unitCostSnapshot) &&
        typeof t.creditsDelta === 'number' &&
        t.creditsDelta < 0
      ) {
        return Number((Math.abs(t.creditsDelta) * t.unitCostSnapshot).toFixed(2))
      }

      const creditsConsumed =
        typeof t.creditsDelta === 'number' && t.creditsDelta < 0
          ? Math.abs(t.creditsDelta)
          : 0

      return Number((creditsConsumed * getServidorUnitCost(srv)).toFixed(2))
    }

    return servidores
      .map(srv => {
        const txsThisMonth = transactions.filter(t => {
          const d = new Date(t.date + 'T00:00:00')
          return t.serverId === srv.id && d.getMonth() === month && d.getFullYear() === year
        })

        const incomeTxs = txsThisMonth.filter(t => t.type === 'income')

        const revenue = incomeTxs.reduce((s, t) => s + t.amount, 0)

        const cost = incomeTxs
          .filter(t => t.creditsDelta != null && t.creditsDelta < 0)
          .reduce((s, t) => s + getTransactionCost(t, srv), 0)

        const profit = revenue - cost
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0

        return {
          id: srv.id,
          nome: srv.nome,
          revenue: Number(revenue.toFixed(2)),
          cost: Number(cost.toFixed(2)),
          profit: Number(profit.toFixed(2)),
          margin,
        }
      })
      .filter(s => s.revenue > 0 || s.cost > 0)
      .sort((a, b) => {
        switch (sortBy) {
          case 'revenue':
            if (b.revenue !== a.revenue) return b.revenue - a.revenue
            if (b.profit !== a.profit) return b.profit - a.profit
            return a.nome.localeCompare(b.nome)

          case 'profit':
            if (b.profit !== a.profit) return b.profit - a.profit
            if (b.revenue !== a.revenue) return b.revenue - a.revenue
            return a.nome.localeCompare(b.nome)

          case 'margin':
            if (b.margin !== a.margin) return b.margin - a.margin
            if (b.revenue !== a.revenue) return b.revenue - a.revenue
            return a.nome.localeCompare(b.nome)

          case 'cost':
            if (b.cost !== a.cost) return b.cost - a.cost
            if (b.revenue !== a.revenue) return b.revenue - a.revenue
            return a.nome.localeCompare(b.nome)

          case 'name':
            return a.nome.localeCompare(b.nome)

          default:
            return 0
        }
      })
  }, [transactions, servidores, month, year, sortBy])

  const getMarginClass = (margin: number) => {
    if (margin >= 50) return 'text-income'
    if (margin >= 20) return 'text-yellow-400'
    return 'text-expense'
  }

  const getHeaderClass = (key: SortKey) =>
    sortBy === key ? 'text-foreground' : 'text-muted-foreground'

  const currentSortLabel = SORT_OPTIONS.find(option => option.key === sortBy)?.label ?? 'Receita ↓'

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Performance por Servidor
        </CardTitle>

        <div
          ref={sortMenuRef}
          className="relative flex w-fit items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5"
        >
          <span className="text-xs text-muted-foreground">Ordenado por:</span>

          <button
            type="button"
            onClick={() => setSortMenuOpen(prev => !prev)}
            className="flex items-center gap-1 text-xs font-medium text-foreground outline-none"
          >
            <span>{currentSortLabel}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${sortMenuOpen ? 'rotate-180' : ''
                }`}
            />
          </button>

          {sortMenuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
              <div className="p-1">
                {SORT_OPTIONS.map(option => {
                  const isActive = option.key === sortBy

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setSortBy(option.key)
                        setSortMenuOpen(false)
                      }}
                      className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${isActive
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'text-foreground hover:bg-muted/60'
                        }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum dado de servidor no período.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {data.map((row, index) => {
                const isTop = index === 0

                return (
                  <div
                    key={row.id}
                    className={[
                      'rounded-xl border p-4',
                      isTop
                        ? 'border-emerald-500/45 bg-emerald-500/5 shadow-[inset_3px_0_0_0_rgba(16,185,129,0.95)]'
                        : 'border-border',
                    ].join(' ')}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{row.nome}</div>

                      {isTop ? (
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          <Crown className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Receita</div>
                        <div className="text-sm text-income">{formatCurrency(row.revenue)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Custo créditos</div>
                        <div className="text-sm text-expense">{formatCurrency(row.cost)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Lucro est.</div>
                        <div className={`text-sm ${row.profit >= 0 ? 'text-income' : 'text-expense'}`}>
                          {formatCurrency(row.profit)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Margem</div>
                        <div className={`text-sm ${getMarginClass(row.margin)}`}>
                          {row.margin.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block">
              <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr_0.8fr] gap-4 border-b border-border px-4 pb-3 text-sm">
                <div className={`font-medium ${getHeaderClass('name')}`}>Servidor</div>
                <div className={`text-right font-medium ${getHeaderClass('revenue')}`}>
                  Receita{sortBy === 'revenue' ? ' ↓' : ''}
                </div>
                <div className={`text-right font-medium ${getHeaderClass('cost')}`}>
                  Custo créditos{sortBy === 'cost' ? ' ↓' : ''}
                </div>
                <div className={`text-right font-medium ${getHeaderClass('profit')}`}>
                  Lucro est.{sortBy === 'profit' ? ' ↓' : ''}
                </div>
                <div className={`text-right font-medium ${getHeaderClass('margin')}`}>
                  Margem %{sortBy === 'margin' ? ' ↓' : ''}
                </div>
              </div>

              <div className="mt-2 space-y-1.5">
                {data.map((row, index) => {
                  const isTop = index === 0

                  return (
                    <div
                      key={row.id}
                      className={[
                        'grid grid-cols-[1.25fr_1fr_1fr_1fr_0.8fr] items-center gap-4 px-4 py-4 transition-colors',
                        isTop
                          ? 'rounded-xl border border-emerald-500/45 bg-emerald-500/5 shadow-[inset_3px_0_0_0_rgba(16,185,129,0.95)]'
                          : 'border-b border-border/80 hover:bg-muted/10',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3 font-medium">
                        <span>{row.nome}</span>

                        {isTop ? (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm">
                            <Crown className="h-4 w-4" />
                          </span>
                        ) : null}
                      </div>

                      <div className="text-right text-sm tabular-nums text-income">
                        {formatCurrency(row.revenue)}
                      </div>

                      <div className="text-right text-sm tabular-nums text-expense">
                        {formatCurrency(row.cost)}
                      </div>

                      <div
                        className={`text-right text-sm tabular-nums ${row.profit >= 0 ? 'text-income' : 'text-expense'
                          }`}
                      >
                        {formatCurrency(row.profit)}
                      </div>

                      <div
                        className={`text-right text-sm tabular-nums ${getMarginClass(row.margin)}`}
                      >
                        {row.margin.toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}