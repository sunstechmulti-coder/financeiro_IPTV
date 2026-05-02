'use client'

import { useMemo } from 'react'
import { AlertTriangle, Bot, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface DailyRobotAssistantProps {
  transactions: Transaction[]
  month?: number
  year?: number
}

type RobotMood = 'neutral' | 'happy' | 'celebrate' | 'hot' | 'alert' | 'danger'

interface DailyFlow {
  income: number
  expenses: number
  balance: number
  salesCount: number
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getAnalysisDateKey(month?: number, year?: number) {
  const today = new Date()

  const targetMonth = typeof month === 'number' ? month : today.getMonth()
  const targetYear = typeof year === 'number' ? year : today.getFullYear()
  const targetDay = Math.min(today.getDate(), getDaysInMonth(targetYear, targetMonth))

  return toDateKey(new Date(targetYear, targetMonth, targetDay))
}

function getPreviousMonthDateKey(dateKey: string) {
  const [yearValue, monthValue, dayValue] = dateKey.split('-').map(Number)

  const currentMonthIndex = monthValue - 1
  const previousMonthDate = new Date(yearValue, currentMonthIndex - 1, 1)

  const previousYear = previousMonthDate.getFullYear()
  const previousMonth = previousMonthDate.getMonth()
  const previousDay = Math.min(dayValue, getDaysInMonth(previousYear, previousMonth))

  return toDateKey(new Date(previousYear, previousMonth, previousDay))
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-')

  return `${day}/${month}/${year}`
}

function getFlowByDate(transactions: Transaction[], dateKey: string): DailyFlow {
  const dayTransactions = transactions.filter((transaction) => {
    return transaction.date === dateKey
  })

  const incomeTransactions = dayTransactions.filter((t) => t.type === 'income')
  const expenseTransactions = dayTransactions.filter((t) => t.type === 'expense')

  const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0)
  const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0)
  const balance = income - expenses
  const salesCount = incomeTransactions.length

  return {
    income,
    expenses,
    balance,
    salesCount,
  }
}

function getPercentChange(current: number, previous: number) {
  if (previous === 0) return null

  return ((current - previous) / previous) * 100
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toFixed(1).replace('.', ',')}%`
}

function getComparisonText(current: number, previous: number, deltaPercent: number | null) {
  if (deltaPercent !== null) return formatPercent(deltaPercent)

  if (previous === 0 && current > 0) return 'Novo'

  return 'Sem base'
}

function getComparisonClass(deltaPercent: number | null, current: number, previous: number) {
  if (previous === 0 && current > 0) return 'text-income'
  if (deltaPercent === null) return 'text-yellow-500'
  if (deltaPercent > 10) return 'text-income'
  if (deltaPercent < -10) return 'text-expense'

  return 'text-yellow-500'
}

function pluralVendas(count: number) {
  return count === 1 ? 'venda' : 'vendas'
}

export function DailyRobotAssistant({ transactions, month, year }: DailyRobotAssistantProps) {
  const analysis = useMemo(() => {
    const analysisDateKey = getAnalysisDateKey(month, year)
    const previousDateKey = getPreviousMonthDateKey(analysisDateKey)

    const todayFlow = getFlowByDate(transactions, analysisDateKey)
    const previousFlow = getFlowByDate(transactions, previousDateKey)

    const incomeDeltaPercent = getPercentChange(todayFlow.income, previousFlow.income)
    const salesDeltaPercent = getPercentChange(todayFlow.salesCount, previousFlow.salesCount)

    const hasTodayMovement = todayFlow.income > 0 || todayFlow.expenses > 0
    const hasPreviousMovement = previousFlow.income > 0 || previousFlow.expenses > 0

    const previousLabel = formatDateKey(previousDateKey)

    let mood: RobotMood = 'neutral'
    let title = 'Observando o dia'
    let message = 'Ainda estou acompanhando o movimento de hoje.'

    if (!hasTodayMovement && !hasPreviousMovement) {
      mood = 'neutral'
      title = 'Observando o dia'
      message = `Ainda não tenho movimento hoje e também não houve registro em ${previousLabel}.`
    } else if (!hasTodayMovement && previousFlow.income > 0) {
      mood = 'danger'
      title = 'Dia parado'
      message = `Hoje ainda não teve entradas. No mesmo dia do mês anterior houve ${formatCurrency(previousFlow.income)} em ${previousFlow.salesCount} ${pluralVendas(previousFlow.salesCount)}.`
    } else if (todayFlow.balance < 0) {
      mood = Math.abs(todayFlow.balance) >= Math.max(todayFlow.income, 1) ? 'danger' : 'alert'
      title = mood === 'danger' ? 'Alerta forte no caixa' : 'Atenção no fluxo'
      message = 'As saídas de hoje estão maiores que as entradas. Vale acompanhar de perto.'
    } else if (previousFlow.income === 0 && todayFlow.income > 0) {
      mood = todayFlow.salesCount >= 2 ? 'hot' : 'celebrate'
      title = mood === 'hot' ? 'Dia acelerado' : 'Dia positivo'
      message = `Hoje já tem ${formatCurrency(todayFlow.income)} em entradas e ${todayFlow.salesCount} ${pluralVendas(todayFlow.salesCount)}. No mesmo dia do mês anterior não havia receita.`
    } else if (incomeDeltaPercent !== null) {
      if (incomeDeltaPercent <= -50 || (salesDeltaPercent !== null && salesDeltaPercent <= -50)) {
        mood = 'danger'
        title = 'Queda forte no dia'
        message = `Hoje está ${formatPercent(incomeDeltaPercent)} abaixo de ${previousLabel}. Foram ${todayFlow.salesCount} ${pluralVendas(todayFlow.salesCount)} hoje contra ${previousFlow.salesCount} no mês anterior.`
      } else if (incomeDeltaPercent < -10) {
        mood = 'alert'
        title = 'Atenção no ritmo'
        message = `Hoje está ${formatPercent(incomeDeltaPercent)} abaixo do mesmo dia do mês anterior. Ainda dá para recuperar.`
      } else if (incomeDeltaPercent >= 50 || (salesDeltaPercent !== null && salesDeltaPercent >= 50)) {
        mood = 'hot'
        title = 'Dia muito forte'
        message = `Hoje está ${formatPercent(incomeDeltaPercent)} acima de ${previousLabel}. O robô está vendo um ritmo bem mais forte.`
      } else if (incomeDeltaPercent > 10) {
        mood = todayFlow.salesCount >= 2 ? 'celebrate' : 'happy'
        title = 'Dia melhor'
        message = `Hoje está ${formatPercent(incomeDeltaPercent)} acima do mesmo dia do mês anterior.`
      } else {
        mood = 'neutral'
        title = 'Ritmo estável'
        message = `Hoje está parecido com ${previousLabel}. Diferença de ${formatPercent(incomeDeltaPercent)} nas entradas.`
      }
    }

    return {
      todayFlow,
      previousFlow,
      previousLabel,
      incomeDeltaPercent,
      comparisonText: getComparisonText(
        todayFlow.income,
        previousFlow.income,
        incomeDeltaPercent
      ),
      comparisonClass: getComparisonClass(
        incomeDeltaPercent,
        todayFlow.income,
        previousFlow.income
      ),
      mood,
      title,
      message,
    }
  }, [transactions, month, year])

  const config = {
    neutral: {
      accent: 'text-yellow-500',
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-500/10',
      icon: Bot,
    },
    happy: {
      accent: 'text-emerald-500',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      icon: TrendingUp,
    },
    celebrate: {
      accent: 'text-emerald-500',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      icon: TrendingUp,
    },
    hot: {
      accent: 'text-emerald-400',
      border: 'border-emerald-400/40',
      bg: 'bg-emerald-500/10',
      icon: TrendingUp,
    },
    alert: {
      accent: 'text-red-500',
      border: 'border-red-500/30',
      bg: 'bg-red-500/10',
      icon: AlertTriangle,
    },
    danger: {
      accent: 'text-red-500',
      border: 'border-red-500/40',
      bg: 'bg-red-500/10',
      icon: AlertTriangle,
    },
  }[analysis.mood]

  const Icon = config.icon

  return (
    <Card className={`overflow-hidden ${config.border} ${config.bg}`}>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className={`daily-robot daily-robot-${analysis.mood}`}>
              <div className="daily-robot-antenna" />

              <div className="daily-robot-head">
                <div className="daily-robot-visor">
                  <span className="daily-robot-eye" />
                  <span className="daily-robot-eye" />
                  <span className="daily-robot-mouth" />
                </div>
              </div>

              <div className="daily-robot-body">
                <div className="daily-robot-light" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.accent}`} />
                <p className={`text-sm font-semibold ${config.accent}`}>
                  {analysis.title}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                {analysis.message}
              </p>

              <p className="text-xs text-muted-foreground">
                Comparando com {analysis.previousLabel}: {formatCurrency(analysis.previousFlow.income)} em entradas e{' '}
                {analysis.previousFlow.salesCount} {pluralVendas(analysis.previousFlow.salesCount)}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:min-w-[440px]">
            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Entradas hoje</p>
              <p className="text-sm font-semibold text-income">
                {formatCurrency(analysis.todayFlow.income)}
              </p>
            </div>

            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Saídas hoje</p>
              <p className="text-sm font-semibold text-expense">
                {formatCurrency(analysis.todayFlow.expenses)}
              </p>
            </div>

            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Resultado</p>
              <p
                className={`text-sm font-semibold ${
                  analysis.todayFlow.balance >= 0 ? 'text-income' : 'text-expense'
                }`}
              >
                {formatCurrency(analysis.todayFlow.balance)}
              </p>
            </div>

            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Vs dia ant.</p>
              <p className={`text-sm font-semibold ${analysis.comparisonClass}`}>
                {analysis.comparisonText}
              </p>
            </div>
          </div>
        </div>

        <style>{`
          .daily-robot {
            position: relative;
            width: 72px;
            height: 78px;
            flex: 0 0 auto;
            color: rgb(234 179 8);
            --robot-scale: 1.18;
            transform-origin: 50% 88%;
            filter: drop-shadow(0 0 16px color-mix(in srgb, currentColor 26%, transparent));
            animation: dailyRobotFloat 3.4s ease-in-out infinite;
          }

          .daily-robot::before,
          .daily-robot::after {
            content: '';
            position: absolute;
            bottom: 2px;
            width: 17px;
            height: 10px;
            border-radius: 7px 7px 9px 9px;
            background:
              linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%);
            border: 1px solid color-mix(in srgb, currentColor 30%, hsl(var(--border)));
            box-shadow:
              inset 0 -3px 0 color-mix(in srgb, currentColor 30%, transparent),
              0 0 12px color-mix(in srgb, currentColor 30%, transparent);
            z-index: 1;
          }

          .daily-robot::before {
            left: 22px;
            transform: rotate(4deg);
          }

          .daily-robot::after {
            right: 22px;
            transform: rotate(-4deg);
          }

          .daily-robot-head {
            position: absolute;
            top: 13px;
            left: 7px;
            width: 58px;
            height: 42px;
            border-radius: 22px 22px 18px 18px;
            background:
              radial-gradient(circle at 32% 18%, rgba(255,255,255,0.95), transparent 28%),
              linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%);
            border: 1px solid color-mix(in srgb, currentColor 22%, hsl(var(--border)));
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow:
              inset 0 1px 1px rgba(255,255,255,0.34),
              inset 0 -7px 14px rgba(0,0,0,0.18),
              0 12px 22px rgba(0,0,0,0.22),
              0 0 18px color-mix(in srgb, currentColor 14%, transparent);
            z-index: 4;
          }

          .daily-robot-head::before,
          .daily-robot-head::after {
            content: '';
            position: absolute;
            top: 15px;
            width: 9px;
            height: 18px;
            border-radius: 999px;
            background:
              linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%);
            border: 1px solid color-mix(in srgb, currentColor 24%, hsl(var(--border)));
            box-shadow:
              inset 0 0 0 2px rgba(0,0,0,0.12),
              inset 0 0 8px color-mix(in srgb, currentColor 42%, transparent),
              0 0 14px color-mix(in srgb, currentColor 34%, transparent);
          }

          .daily-robot-head::before {
            left: -6px;
          }

          .daily-robot-head::after {
            right: -6px;
          }

          .daily-robot-antenna {
            position: absolute;
            top: 3px;
            left: 35px;
            width: 2px;
            height: 13px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 10px currentColor;
            z-index: 6;
          }

          .daily-robot-antenna::before {
            content: '';
            position: absolute;
            top: -8px;
            left: -5px;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background:
              radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), currentColor 42%, currentColor 100%);
            box-shadow:
              0 0 8px currentColor,
              0 0 18px color-mix(in srgb, currentColor 48%, transparent);
          }

          .daily-robot-antenna::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: -5px;
            width: 12px;
            height: 5px;
            border-radius: 999px;
            background: color-mix(in srgb, currentColor 75%, hsl(var(--card)));
            box-shadow: 0 0 10px color-mix(in srgb, currentColor 38%, transparent);
          }

          .daily-robot-visor {
            position: relative;
            width: 44px;
            height: 25px;
            border-radius: 999px;
            background:
              radial-gradient(circle at 34% 20%, rgba(255,255,255,0.12), transparent 30%),
              linear-gradient(180deg, rgba(12,16,20,0.98) 0%, rgba(3,6,9,0.98) 100%);
            border: 1px solid rgba(255,255,255,0.10);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            overflow: hidden;
            box-shadow:
              inset 0 1px 2px rgba(255,255,255,0.12),
              inset 0 -5px 10px rgba(0,0,0,0.42),
              0 0 14px color-mix(in srgb, currentColor 18%, transparent);
          }

          .daily-robot-visor::before {
            content: '';
            position: absolute;
            inset: 4px 7px auto 7px;
            height: 5px;
            border-radius: 999px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent);
            pointer-events: none;
          }

          .daily-robot-eye {
            width: 7px;
            height: 12px;
            border-radius: 999px;
            background:
              repeating-linear-gradient(
                180deg,
                color-mix(in srgb, currentColor 90%, white) 0px,
                currentColor 2px,
                color-mix(in srgb, currentColor 70%, black) 3px
              );
            box-shadow:
              0 0 7px currentColor,
              0 0 14px color-mix(in srgb, currentColor 46%, transparent);
            animation: dailyRobotBlink 4.8s ease-in-out infinite;
          }

          .daily-robot-mouth {
            position: absolute;
            bottom: 4px;
            left: 50%;
            width: 14px;
            height: 6px;
            transform: translateX(-50%);
            border-bottom: 2px solid currentColor;
            border-radius: 0 0 999px 999px;
            opacity: 0.92;
            filter: drop-shadow(0 0 4px currentColor);
          }

          .daily-robot-body {
            position: absolute;
            bottom: 9px;
            left: 21px;
            width: 30px;
            height: 27px;
            border-radius: 13px 13px 11px 11px;
            background:
              radial-gradient(circle at 35% 18%, rgba(255,255,255,0.88), transparent 30%),
              linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%);
            border: 1px solid color-mix(in srgb, currentColor 22%, hsl(var(--border)));
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow:
              inset 0 -6px 11px rgba(0,0,0,0.16),
              0 0 16px color-mix(in srgb, currentColor 16%, transparent);
            z-index: 3;
          }

          .daily-robot-body::before,
          .daily-robot-body::after {
            content: '';
            position: absolute;
            top: 7px;
            width: 9px;
            height: 22px;
            border-radius: 999px;
            background:
              linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%);
            border: 1px solid color-mix(in srgb, currentColor 22%, hsl(var(--border)));
            box-shadow:
              inset 0 -4px 7px rgba(0,0,0,0.18),
              0 0 10px color-mix(in srgb, currentColor 18%, transparent);
          }

          .daily-robot-body::before {
            left: -10px;
            transform: rotate(11deg);
          }

          .daily-robot-body::after {
            right: -10px;
            transform: rotate(-11deg);
          }

          .daily-robot-light {
            position: relative;
            width: 15px;
            height: 15px;
            border-radius: 999px;
            background:
              linear-gradient(180deg, rgba(0,0,0,0.66), rgba(0,0,0,0.9));
            border: 1px solid color-mix(in srgb, currentColor 48%, rgba(255,255,255,0.18));
            box-shadow:
              inset 0 1px 1px rgba(255,255,255,0.12),
              0 0 10px color-mix(in srgb, currentColor 42%, transparent);
            z-index: 4;
          }

          .daily-robot-light::before {
            content: '';
            position: absolute;
            left: 3px;
            top: 7px;
            width: 9px;
            height: 2px;
            border-radius: 999px;
            background: currentColor;
            transform: rotate(-35deg);
            transform-origin: left center;
            box-shadow: 0 0 5px currentColor;
          }

          .daily-robot-light::after {
            content: '';
            position: absolute;
            right: 3px;
            top: 5px;
            width: 5px;
            height: 5px;
            border-top: 2px solid currentColor;
            border-right: 2px solid currentColor;
            transform: rotate(45deg);
            filter: drop-shadow(0 0 4px currentColor);
          }

          .daily-robot-neutral {
            color: rgb(234 179 8);
          }

          .daily-robot-happy,
          .daily-robot-celebrate,
          .daily-robot-hot {
            color: rgb(16 185 129);
          }

          .daily-robot-alert,
          .daily-robot-danger {
            color: rgb(239 68 68);
          }

          .daily-robot-alert {
            animation: dailyRobotAlert 1.35s ease-in-out infinite;
          }

          .daily-robot-danger {
            animation: dailyRobotDanger 0.75s ease-in-out infinite;
          }

          .daily-robot-celebrate {
            animation: dailyRobotCelebrate 1.7s ease-in-out infinite;
          }

          .daily-robot-hot {
            animation: dailyRobotHot 1.05s ease-in-out infinite;
          }

          .daily-robot-happy .daily-robot-mouth,
          .daily-robot-celebrate .daily-robot-mouth,
          .daily-robot-hot .daily-robot-mouth {
            width: 15px;
            height: 7px;
            bottom: 4px;
            border-bottom-left-radius: 999px;
            border-bottom-right-radius: 999px;
          }

          .daily-robot-neutral .daily-robot-mouth {
            width: 12px;
            height: 0;
            bottom: 5px;
            border-bottom: 2px solid currentColor;
            border-radius: 999px;
          }

          .daily-robot-alert .daily-robot-eye,
          .daily-robot-danger .daily-robot-eye {
            width: 7px;
            height: 13px;
          }

          .daily-robot-alert .daily-robot-mouth,
          .daily-robot-danger .daily-robot-mouth {
            width: 10px;
            height: 5px;
            bottom: 4px;
            border: 2px solid currentColor;
            border-top: 0;
            border-radius: 0 0 999px 999px;
            transform: translateX(-50%) rotate(180deg);
          }

          .daily-robot-alert .daily-robot-visor::after,
          .daily-robot-danger .daily-robot-visor::after {
            content: '';
            position: absolute;
            top: 6px;
            left: 10px;
            width: 24px;
            height: 9px;
            border-top: 2px solid currentColor;
            border-radius: 999px 999px 0 0;
            opacity: 0.85;
            filter: drop-shadow(0 0 4px currentColor);
          }

          .daily-robot-alert .daily-robot-light::before,
          .daily-robot-danger .daily-robot-light::before {
            transform: rotate(35deg);
          }

          .daily-robot-alert .daily-robot-light::after,
          .daily-robot-danger .daily-robot-light::after {
            top: 7px;
            transform: rotate(135deg);
          }

          .daily-robot-hot .daily-robot-antenna::before,
          .daily-robot-danger .daily-robot-antenna::before {
            animation: dailyRobotPulseLight 0.8s ease-in-out infinite;
          }

          @keyframes dailyRobotFloat {
            0%, 100% {
              transform: scale(var(--robot-scale)) translateY(0) rotate(0deg);
            }
            50% {
              transform: scale(var(--robot-scale)) translateY(-4px) rotate(-1deg);
            }
          }

          @keyframes dailyRobotCelebrate {
            0%, 100% {
              transform: scale(var(--robot-scale)) translateY(0) rotate(0deg);
            }
            25% {
              transform: scale(calc(var(--robot-scale) + 0.03)) translateY(-5px) rotate(-4deg);
            }
            55% {
              transform: scale(calc(var(--robot-scale) + 0.02)) translateY(-2px) rotate(4deg);
            }
            75% {
              transform: scale(calc(var(--robot-scale) + 0.03)) translateY(-3px) rotate(-2deg);
            }
          }

          @keyframes dailyRobotHot {
            0%, 100% {
              transform: scale(calc(var(--robot-scale) + 0.02)) translateY(0) rotate(0deg);
            }
            20% {
              transform: scale(calc(var(--robot-scale) + 0.06)) translateY(-6px) rotate(-6deg);
            }
            40% {
              transform: scale(calc(var(--robot-scale) + 0.04)) translateY(-2px) rotate(5deg);
            }
            65% {
              transform: scale(calc(var(--robot-scale) + 0.07)) translateY(-5px) rotate(-4deg);
            }
            82% {
              transform: scale(calc(var(--robot-scale) + 0.04)) translateY(-1px) rotate(4deg);
            }
          }

          @keyframes dailyRobotAlert {
            0%, 100% {
              transform: scale(var(--robot-scale)) rotate(0deg);
            }
            25% {
              transform: scale(var(--robot-scale)) rotate(-2deg);
            }
            50% {
              transform: scale(var(--robot-scale)) rotate(0deg);
            }
            75% {
              transform: scale(var(--robot-scale)) rotate(2deg);
            }
          }

          @keyframes dailyRobotDanger {
            0%, 100% {
              transform: scale(var(--robot-scale)) translateX(0) rotate(0deg);
            }
            20% {
              transform: scale(var(--robot-scale)) translateX(-2px) rotate(-4deg);
            }
            40% {
              transform: scale(var(--robot-scale)) translateX(2px) rotate(4deg);
            }
            60% {
              transform: scale(var(--robot-scale)) translateX(-2px) rotate(-3deg);
            }
            80% {
              transform: scale(var(--robot-scale)) translateX(2px) rotate(3deg);
            }
          }

          @keyframes dailyRobotPulseLight {
            0%, 100% {
              transform: scale(1);
              opacity: 0.9;
            }
            50% {
              transform: scale(1.28);
              opacity: 1;
            }
          }

          @keyframes dailyRobotBlink {
            0%, 90%, 100% {
              transform: scaleY(1);
            }
            94% {
              transform: scaleY(0.15);
            }
          }

          @media (max-width: 640px) {
            .daily-robot {
              width: 70px;
              height: 82px;
              --robot-scale: 1.02;
              margin-left: -2px;
              margin-top: 2px;
            }

            .daily-robot::before,
            .daily-robot::after {
              bottom: 4px;
            }

            .daily-robot-body {
              bottom: 12px;
            }
          }
        `}</style>
      </CardContent>
    </Card>
  )
}