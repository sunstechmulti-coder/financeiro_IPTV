'use client'

import { useMemo } from 'react'
import { AlertTriangle, Bot, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface DailyRobotAssistantProps {
  transactions: Transaction[]
}

type RobotMood = 'neutral' | 'happy' | 'celebrate' | 'alert'

function getTodayKey() {
  const today = new Date()

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

export function DailyRobotAssistant({ transactions }: DailyRobotAssistantProps) {
  const todayFlow = useMemo(() => {
    const todayKey = getTodayKey()

    const todayTransactions = transactions.filter((transaction) => {
      return transaction.date === todayKey
    })

    const incomeTransactions = todayTransactions.filter((t) => t.type === 'income')
    const expenseTransactions = todayTransactions.filter((t) => t.type === 'expense')

    const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0)
    const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0)
    const balance = income - expenses
    const salesCount = incomeTransactions.length

    let mood: RobotMood = 'neutral'

    if (income === 0 && expenses === 0) {
      mood = 'neutral'
    } else if (balance < 0) {
      mood = 'alert'
    } else if (balance > 0 && salesCount >= 2) {
      mood = 'celebrate'
    } else if (balance > 0) {
      mood = 'happy'
    }

    return {
      income,
      expenses,
      balance,
      salesCount,
      mood,
    }
  }, [transactions])

  const config = {
    neutral: {
      title: 'Observando o dia',
      message: 'Ainda estou acompanhando o movimento de hoje.',
      accent: 'text-yellow-500',
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-500/10',
      icon: Bot,
    },
    happy: {
      title: 'Dia positivo',
      message: 'As entradas de hoje estão acima das saídas.',
      accent: 'text-emerald-500',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      icon: TrendingUp,
    },
    celebrate: {
      title: 'Bom ritmo de vendas',
      message: `Hoje já foram registradas ${todayFlow.salesCount} entradas e o saldo está positivo.`,
      accent: 'text-emerald-500',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      icon: TrendingUp,
    },
    alert: {
      title: 'Atenção no fluxo',
      message: 'As saídas de hoje estão maiores que as entradas.',
      accent: 'text-red-500',
      border: 'border-red-500/30',
      bg: 'bg-red-500/10',
      icon: AlertTriangle,
    },
  }[todayFlow.mood]

  const Icon = config.icon

  return (
    <Card className={`overflow-hidden ${config.border} ${config.bg}`}>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`daily-robot daily-robot-${todayFlow.mood}`}>
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
                  {config.title}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                {config.message}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Entradas hoje</p>
              <p className="text-sm font-semibold text-income">
                {formatCurrency(todayFlow.income)}
              </p>
            </div>

            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Saídas hoje</p>
              <p className="text-sm font-semibold text-expense">
                {formatCurrency(todayFlow.expenses)}
              </p>
            </div>

            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Resultado</p>
              <p
                className={`text-sm font-semibold ${
                  todayFlow.balance >= 0 ? 'text-income' : 'text-expense'
                }`}
              >
                {formatCurrency(todayFlow.balance)}
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
          .daily-robot-celebrate {
            color: rgb(16 185 129);
          }

          .daily-robot-alert {
            color: rgb(239 68 68);
            animation: dailyRobotAlert 1.35s ease-in-out infinite;
          }

          .daily-robot-celebrate {
            animation: dailyRobotCelebrate 1.7s ease-in-out infinite;
          }

          .daily-robot-happy .daily-robot-mouth,
          .daily-robot-celebrate .daily-robot-mouth {
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

          .daily-robot-alert .daily-robot-eye {
            width: 7px;
            height: 13px;
          }

          .daily-robot-alert .daily-robot-mouth {
            width: 10px;
            height: 5px;
            bottom: 4px;
            border: 2px solid currentColor;
            border-top: 0;
            border-radius: 0 0 999px 999px;
            transform: translateX(-50%) rotate(180deg);
          }

          .daily-robot-alert .daily-robot-visor::after {
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

          .daily-robot-alert .daily-robot-light::before {
            transform: rotate(35deg);
          }

          .daily-robot-alert .daily-robot-light::after {
            top: 7px;
            transform: rotate(135deg);
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