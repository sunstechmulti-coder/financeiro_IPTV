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
            width: 58px;
            height: 70px;
            flex: 0 0 auto;
            transform-origin: 50% 90%;
            animation: dailyRobotFloat 3s ease-in-out infinite;
          }

          .daily-robot-head {
            position: absolute;
            top: 8px;
            left: 7px;
            width: 44px;
            height: 34px;
            border-radius: 14px;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px rgba(0,0,0,0.12);
          }

          .daily-robot-antenna {
            position: absolute;
            top: 0;
            left: 28px;
            width: 2px;
            height: 10px;
            background: hsl(var(--muted-foreground));
          }

          .daily-robot-antenna::before {
            content: '';
            position: absolute;
            top: -5px;
            left: -4px;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: currentColor;
          }

          .daily-robot-visor {
            position: relative;
            width: 32px;
            height: 18px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
          }

          .daily-robot-eye {
            width: 5px;
            height: 5px;
            border-radius: 999px;
            background: currentColor;
            animation: dailyRobotBlink 4s ease-in-out infinite;
          }

          .daily-robot-mouth {
            position: absolute;
            bottom: 3px;
            left: 50%;
            width: 12px;
            height: 5px;
            transform: translateX(-50%);
            border-bottom: 2px solid currentColor;
          }

          .daily-robot-body {
            position: absolute;
            bottom: 4px;
            left: 14px;
            width: 30px;
            height: 24px;
            border-radius: 10px;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .daily-robot-light {
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 12px currentColor;
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
            animation: dailyRobotAlert 1.2s ease-in-out infinite;
          }

          .daily-robot-celebrate {
            animation: dailyRobotCelebrate 1.5s ease-in-out infinite;
          }

          .daily-robot-happy .daily-robot-mouth,
          .daily-robot-celebrate .daily-robot-mouth {
            border-bottom-left-radius: 999px;
            border-bottom-right-radius: 999px;
          }

          .daily-robot-neutral .daily-robot-mouth {
            height: 0;
            border-bottom: 2px solid currentColor;
          }

          .daily-robot-alert .daily-robot-mouth {
            width: 10px;
            height: 6px;
            border: 2px solid currentColor;
            border-radius: 999px;
          }

          .daily-robot-alert .daily-robot-eye {
            width: 7px;
            height: 7px;
          }

          @keyframes dailyRobotFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(-1deg); }
          }

          @keyframes dailyRobotCelebrate {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            30% { transform: translateY(-5px) rotate(-4deg); }
            60% { transform: translateY(-2px) rotate(4deg); }
          }

          @keyframes dailyRobotAlert {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-2deg); }
            75% { transform: rotate(2deg); }
          }

          @keyframes dailyRobotBlink {
            0%, 92%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.15); }
          }
        `}</style>
      </CardContent>
    </Card>
  )
}