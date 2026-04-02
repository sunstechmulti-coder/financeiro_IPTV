'use client'

import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface RevenueHeatmapProps {
  transactions: Transaction[]
}

export function RevenueHeatmap({ transactions }: RevenueHeatmapProps) {
  const today = new Date()
  const currentMonth = startOfMonth(today)

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, { income: number; expense: number; net: number }>()

    transactions.forEach((t) => {
      const existing = totals.get(t.date) || { income: 0, expense: 0, net: 0 }
      if (t.type === 'income') {
        existing.income += t.amount
        existing.net += t.amount
      } else {
        existing.expense += t.amount
        existing.net -= t.amount
      }
      totals.set(t.date, existing)
    })

    return totals
  }, [transactions])

  // Get max absolute value for color intensity
  const maxValue = useMemo(() => {
    let max = 0
    dailyTotals.forEach((value) => {
      max = Math.max(max, Math.abs(value.net))
    })
    return max || 1
  }, [dailyTotals])

  const getColorClass = (net: number): string => {
    if (net === 0) return 'bg-muted'
    
    const intensity = Math.min(Math.abs(net) / maxValue, 1)
    
    if (net > 0) {
      if (intensity > 0.75) return 'bg-income'
      if (intensity > 0.5) return 'bg-income/70'
      if (intensity > 0.25) return 'bg-income/50'
      return 'bg-income/30'
    } else {
      if (intensity > 0.75) return 'bg-expense'
      if (intensity > 0.5) return 'bg-expense/70'
      if (intensity > 0.25) return 'bg-expense/50'
      return 'bg-expense/30'
    }
  }

  const months = [
    subMonths(currentMonth, 2),
    subMonths(currentMonth, 1),
    currentMonth,
  ]

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Mapa de Receitas Diárias</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {months.map((month) => {
              const days = eachDayOfInterval({
                start: startOfMonth(month),
                end: endOfMonth(month),
              })

              // Create grid with empty cells for proper alignment
              const firstDayOfWeek = getDay(startOfMonth(month))
              const grid: (Date | null)[][] = []
              let currentWeek: (Date | null)[] = Array(firstDayOfWeek).fill(null)

              days.forEach((day) => {
                currentWeek.push(day)
                if (currentWeek.length === 7) {
                  grid.push(currentWeek)
                  currentWeek = []
                }
              })

              if (currentWeek.length > 0) {
                while (currentWeek.length < 7) {
                  currentWeek.push(null)
                }
                grid.push(currentWeek)
              }

              return (
                <div key={month.toISOString()} className="flex-shrink-0">
                  <div className="mb-2 text-center text-sm font-medium capitalize">
                    {format(month, 'MMMM yyyy', { locale: ptBR })}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                    {weekDays.map((day, i) => (
                      <div key={i} className="h-4 w-6">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {grid.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7 gap-1">
                        {week.map((day, dayIndex) => {
                          if (!day) {
                            return (
                              <div
                                key={dayIndex}
                                className="h-6 w-6 rounded-sm"
                              />
                            )
                          }

                          const dateStr = format(day, 'yyyy-MM-dd')
                          const data = dailyTotals.get(dateStr)
                          const net = data?.net || 0
                          const isToday = format(today, 'yyyy-MM-dd') === dateStr

                          return (
                            <Tooltip key={dayIndex}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'h-6 w-6 rounded-sm cursor-pointer transition-transform hover:scale-110',
                                    getColorClass(net),
                                    isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <div className="font-medium">
                                  {format(day, 'dd/MM/yyyy')}
                                </div>
                                {data ? (
                                  <div className="space-y-0.5 mt-1">
                                    <div className="text-income">
                                      Entradas: {formatCurrency(data.income)}
                                    </div>
                                    <div className="text-expense">
                                      Saídas: {formatCurrency(data.expense)}
                                    </div>
                                    <div
                                      className={cn(
                                        'font-medium',
                                        data.net >= 0 ? 'text-income' : 'text-expense'
                                      )}
                                    >
                                      Saldo: {formatCurrency(data.net)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground">
                                    Sem transações
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-expense" />
            <span>Saída</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <span>Nenhum</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-income" />
            <span>Entrada</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
