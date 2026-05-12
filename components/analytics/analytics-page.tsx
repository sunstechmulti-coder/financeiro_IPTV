'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button } from '@/components/ui/button'
import { KpiCards } from '@/components/analytics/kpi-cards'
import { RevenueChart } from '@/components/analytics/revenue-chart'
import { TopRevenue } from '@/components/analytics/top-revenue'
import { TopExpenses } from '@/components/analytics/top-expenses'
import { ServerProfit } from '@/components/analytics/server-profit'
import { RevenueDistribution } from '@/components/analytics/revenue-distribution'
import { MonthlyComparison } from '@/components/analytics/monthly-comparison'
import { InsightsPanel } from '@/components/analytics/insights-panel'
import { formatCurrency } from '@/lib/format'
import type { Transaction, Servidor, CreditMovement, PlanoEntrada } from '@/lib/types'

interface AnalyticsPageProps {
  transactions: Transaction[]
  servidores: Servidor[]
  movements: CreditMovement[]
  planos: PlanoEntrada[]
}

interface CreditFlowSummaryProps {
  transactions: Transaction[]
  servidores: Servidor[]
  movements: CreditMovement[]
  month: number
  year: number
}

type CreditDirection = 'in' | 'out' | 'unknown'

interface CreditServerRow {
  id: string
  nome: string
  entradas: number
  saidas: number
  liquido: number
  saldoAtual: number
}

interface CreditDailyRow {
  day: string
  entradas: number
  saidas: number
  liquido: number
}

interface CreditFlowAnalytics {
  totalEntradas: number
  totalSaidas: number
  saldoLiquido: number
  saldoAtualTotal: number
  dailyRows: CreditDailyRow[]
  activeDailyRows: CreditDailyRow[]
  serverRows: CreditServerRow[]
  activeServerRows: CreditServerRow[]
  hasMonthlyMovements: boolean
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const CREDIT_WARNING_LIMIT = 10

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

  const normalized = String(value)
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCredits(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function getRecordDate(record: any) {
  return (
    record?.date ??
    record?.created_at ??
    record?.createdAt ??
    record?.movement_date ??
    record?.movementDate ??
    record?.purchase_date ??
    record?.purchaseDate ??
    record?.consumed_at ??
    record?.consumedAt ??
    record?.updated_at ??
    record?.updatedAt ??
    null
  )
}

function parseLocalDate(value: unknown) {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const text = String(value)
  const date = text.includes('T') ? new Date(text) : new Date(`${text}T00:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

function isRecordInMonth(record: any, month: number, year: number) {
  const date = parseLocalDate(getRecordDate(record))
  if (!date) return false

  return date.getMonth() === month && date.getFullYear() === year
}

function getRecordDay(record: any) {
  const date = parseLocalDate(getRecordDate(record))
  return date ? date.getDate() : null
}

function getServidorId(servidor: any) {
  const value = servidor?.id ?? servidor?.server_id ?? servidor?.serverId
  return value ? String(value) : ''
}

function getMovementServerId(record: any) {
  const value =
    record?.server_id ??
    record?.serverId ??
    record?.servidor_id ??
    record?.servidorId ??
    record?.server?.id ??
    record?.servidor?.id

  return value ? String(value) : ''
}

function getServerName(servidor: any) {
  return String(
    servidor?.nome ??
    servidor?.name ??
    servidor?.server_name ??
    servidor?.serverName ??
    'Servidor'
  )
}

function getServerCredits(servidor: any) {
  return toNumber(
    servidor?.creditsBalance ??
      servidor?.credit_balance ??
      servidor?.saldo_creditos ??
      servidor?.saldoCreditos ??
      servidor?.credits ??
      servidor?.saldo ??
      0
  )
}

function getMovementQuantity(movement: any) {
  const signedDelta =
    movement?.creditsDelta ??
    movement?.credits_delta ??
    movement?.creditDelta ??
    movement?.credit_delta

  if (signedDelta !== null && signedDelta !== undefined && signedDelta !== '') {
    return toNumber(signedDelta)
  }

  return toNumber(
    movement?.quantity ??
      movement?.qty ??
      movement?.credits_qty ??
      movement?.credit_qty ??
      movement?.creditsQty ??
      movement?.creditQuantity ??
      movement?.creditsQuantity ??
      movement?.credits_amount ??
      movement?.credit_amount ??
      movement?.creditsAmount ??
      movement?.creditAmount ??
      movement?.credits ??
      0
  )
}

function getSignedCreditDelta(record: any) {
  return toNumber(
    record?.creditsDelta ??
      record?.credits_delta ??
      record?.creditDelta ??
      record?.credit_delta ??
      0
  )
}

function detectCreditDirection(record: any): CreditDirection {
  const raw = normalizeText([
    record?.type,
    record?.movement_type,
    record?.movementType,
    record?.kind,
    record?.direction,
    record?.operation,
    record?.source,
    record?.table,
    record?.reason,
    record?.description,
    record?.descricao,
    record?.notes,
  ].filter(Boolean).join(' '))

  if (
    raw.includes('consum') ||
    raw.includes('saida') ||
    raw.includes('venda') ||
    raw.includes('sale') ||
    raw.includes('sold') ||
    raw.includes('debit') ||
    raw.includes('subtract') ||
    raw.includes('usage') ||
    raw.includes('used') ||
    raw === 'out'
  ) {
    return 'out'
  }

  if (
    raw.includes('compra') ||
    raw.includes('purchase') ||
    raw.includes('entrada') ||
    raw.includes('recarga') ||
    raw.includes('recharge') ||
    raw.includes('add') ||
    raw.includes('addition') ||
    raw === 'in'
  ) {
    return 'in'
  }

  const quantity = getMovementQuantity(record)

  if (quantity < 0) return 'out'
  if (quantity > 0 && raw) return 'in'

  return 'unknown'
}

function buildCreditFlowAnalytics(
  movements: CreditMovement[],
  servidores: Servidor[],
  transactions: Transaction[],
  month: number,
  year: number
): CreditFlowAnalytics {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dailyMap = new Map<number, { entradas: number; saidas: number }>()
  const serverMap = new Map<string, CreditServerRow>()

  for (let day = 1; day <= daysInMonth; day++) {
    dailyMap.set(day, { entradas: 0, saidas: 0 })
  }

  servidores.forEach((servidor) => {
    const id = getServidorId(servidor)
    const nome = getServerName(servidor)

    if (!id) return

    serverMap.set(id, {
      id,
      nome,
      entradas: 0,
      saidas: 0,
      liquido: 0,
      saldoAtual: getServerCredits(servidor),
    })
  })

  const addServerMovement = (
    serverId: string,
    fallbackName: string,
    direction: CreditDirection,
    quantity: number
  ) => {
    const safeServerId = serverId || 'sem-servidor'

    const current = serverMap.get(safeServerId) ?? {
      id: safeServerId,
      nome: fallbackName || 'Sem servidor',
      entradas: 0,
      saidas: 0,
      liquido: 0,
      saldoAtual: 0,
    }

    if (direction === 'in') current.entradas += quantity
    if (direction === 'out') current.saidas += quantity

    current.liquido = current.entradas - current.saidas
    serverMap.set(safeServerId, current)
  }

  let monthlyMovementCount = 0
  let monthlyInMovementCount = 0
  let monthlyOutMovementCount = 0

  movements
    .filter((movement) => isRecordInMonth(movement, month, year))
    .forEach((movement: any) => {
      const direction = detectCreditDirection(movement)
      const quantity = Math.abs(getMovementQuantity(movement))
      const day = getRecordDay(movement)

      if (direction === 'unknown' || quantity <= 0 || !day) return

      const daily = dailyMap.get(day)

      if (daily) {
        if (direction === 'in') daily.entradas += quantity
        if (direction === 'out') daily.saidas += quantity
      }

      const serverId = getMovementServerId(movement)
      const serverName = String(
        movement?.server_name ??
        movement?.serverName ??
        movement?.servidor_nome ??
        movement?.servidorNome ??
        movement?.server?.name ??
        movement?.servidor?.nome ??
        ''
      )

      addServerMovement(serverId, serverName, direction, quantity)

      monthlyMovementCount += 1
      if (direction === 'in') monthlyInMovementCount += 1
      if (direction === 'out') monthlyOutMovementCount += 1
    })

  // Fallback defensivo: em alguns fluxos, a movimentação de crédito fica gravada
  // direto na transação como creditsDelta/credits_delta, sem gerar linha em credit_movements.
  // Aqui usamos as transações apenas para a direção que ainda não veio em movements,
  // evitando duplicar quando o backend já registrou o movimento detalhado.
  const addTransactionCreditFallback = (expectedDirection: 'in' | 'out') => {
    transactions
      .filter((transaction: any) => isRecordInMonth(transaction, month, year))
      .forEach((transaction: any) => {
        const signedDelta = getSignedCreditDelta(transaction)
        const day = getRecordDay(transaction)

        if (signedDelta === 0 || !day) return

        const direction: 'in' | 'out' = signedDelta > 0 ? 'in' : 'out'
        if (direction !== expectedDirection) return

        const quantity = Math.abs(signedDelta)
        const daily = dailyMap.get(day)

        if (daily) {
          if (direction === 'in') daily.entradas += quantity
          if (direction === 'out') daily.saidas += quantity
        }

        addServerMovement(getMovementServerId(transaction), '', direction, quantity)
        monthlyMovementCount += 1
      })
  }

  if (monthlyInMovementCount === 0) addTransactionCreditFallback('in')
  if (monthlyOutMovementCount === 0) addTransactionCreditFallback('out')

  const dailyRows = Array.from(dailyMap.entries()).map(([day, values]) => ({
    day: String(day).padStart(2, '0'),
    entradas: values.entradas,
    saidas: values.saidas,
    liquido: values.entradas - values.saidas,
  }))

  const activeDailyRows = dailyRows.filter(row => row.entradas > 0 || row.saidas > 0)

  const serverRows = Array.from(serverMap.values())
    .map(row => ({
      ...row,
      liquido: row.entradas - row.saidas,
    }))
    .sort((a, b) => {
      const movementDiff = (b.entradas + b.saidas) - (a.entradas + a.saidas)
      if (movementDiff !== 0) return movementDiff
      return b.saldoAtual - a.saldoAtual
    })

  const activeServerRows = serverRows.filter(
    row => row.entradas > 0 || row.saidas > 0 || row.saldoAtual > 0
  )

  const totalEntradas = dailyRows.reduce((sum, row) => sum + row.entradas, 0)
  const totalSaidas = dailyRows.reduce((sum, row) => sum + row.saidas, 0)
  const saldoAtualTotal = servidores.reduce((sum, servidor) => sum + getServerCredits(servidor), 0)

  return {
    totalEntradas,
    totalSaidas,
    saldoLiquido: totalEntradas - totalSaidas,
    saldoAtualTotal,
    dailyRows,
    activeDailyRows,
    serverRows,
    activeServerRows,
    hasMonthlyMovements: monthlyMovementCount > 0,
  }
}

function CreditFlowSummary({
  transactions,
  servidores,
  movements,
  month,
  year,
}: CreditFlowSummaryProps) {
  const data = useMemo(
    () => buildCreditFlowAnalytics(movements, servidores, transactions, month, year),
    [movements, servidores, transactions, month, year]
  )

  const cardBaseClass = 'rounded-2xl border bg-card/40 p-4 shadow-sm'
  const topServers = data.activeServerRows.slice(0, 6)
  const criticalServers = data.activeServerRows.filter(
    row => row.saldoAtual > 0 && row.saldoAtual <= CREDIT_WARNING_LIMIT
  )

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-card/40 p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Fluxo de Créditos do Mês</h3>
          <p className="text-sm text-muted-foreground">
            Entradas por compras, saídas por vendas/consumo e saldo atual dos servidores.
          </p>
        </div>

        {criticalServers.length > 0 && (
          <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-500">
            {criticalServers.length} servidor{criticalServers.length > 1 ? 'es' : ''} com saldo baixo
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${cardBaseClass} border-emerald-500/25`}>
          <p className="text-xs text-muted-foreground">Créditos comprados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-500">
            +{formatCredits(data.totalEntradas)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Entraram no mês selecionado</p>
        </div>

        <div className={`${cardBaseClass} border-rose-500/25`}>
          <p className="text-xs text-muted-foreground">Créditos vendidos</p>
          <p className="mt-2 text-2xl font-bold text-rose-500">
            -{formatCredits(data.totalSaidas)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Consumidos em vendas</p>
        </div>

        <div className={`${cardBaseClass} ${data.saldoLiquido >= 0 ? 'border-emerald-500/25' : 'border-rose-500/25'}`}>
          <p className="text-xs text-muted-foreground">Saldo líquido do mês</p>
          <p className={`mt-2 text-2xl font-bold ${data.saldoLiquido >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {data.saldoLiquido >= 0 ? '+' : '-'}{formatCredits(Math.abs(data.saldoLiquido))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Entradas menos saídas</p>
        </div>

        <div className={`${cardBaseClass} border-sky-500/25`}>
          <p className="text-xs text-muted-foreground">Saldo atual</p>
          <p className="mt-2 text-2xl font-bold text-sky-500">
            {formatCredits(data.saldoAtualTotal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Somando todos os servidores</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium">Entradas x Saídas por dia</h4>
              <p className="text-xs text-muted-foreground">Visão diária em quantidade de créditos</p>
            </div>
          </div>

          <div className="h-[260px]">
            {data.hasMonthlyMovements ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCredits(Number(value))}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value: any, name: any) => [
                      `${formatCredits(Number(value))} créditos`,
                      name,
                    ]}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 text-center text-sm text-muted-foreground">
                Nenhum movimento de crédito encontrado para este mês.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
          <div className="mb-3">
            <h4 className="text-sm font-medium">Créditos por servidor</h4>
            <p className="text-xs text-muted-foreground">Compras, consumo e saldo atual</p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-border/70 pb-2 text-xs font-medium text-muted-foreground">
                <span>Servidor</span>
                <span className="text-right">Entraram</span>
                <span className="text-right">Saíram</span>
                <span className="text-right">Saldo</span>
              </div>

              {topServers.length > 0 ? (
                topServers.map((server) => (
                  <div
                    key={server.id}
                    className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-border/40 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{server.nome}</p>
                      {server.saldoAtual > 0 && server.saldoAtual <= CREDIT_WARNING_LIMIT && (
                        <p className="text-xs text-amber-500">Saldo baixo</p>
                      )}
                    </div>
                    <span className="text-right text-emerald-500">+{formatCredits(server.entradas)}</span>
                    <span className="text-right text-rose-500">-{formatCredits(server.saidas)}</span>
                    <span className="text-right font-medium">{formatCredits(server.saldoAtual)}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum servidor com créditos para exibir.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AnalyticsPage({ transactions, servidores, movements, planos }: AnalyticsPageProps) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year,  setYear]  = useState(today.getFullYear())

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

  const handleGeneratePdf = () => {
    const reportMonthLabel = `${MONTH_NAMES[month]} ${year}`
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth

    const creditFlow = buildCreditFlowAnalytics(movements, servidores, transactions, month, year)

    const monthTransactions = transactions
      .filter((transaction) => {
        const date = new Date(transaction.date + 'T00:00:00')
        return date.getMonth() === month && date.getFullYear() === year
      })
      .sort((a, b) => {
        const dateA = new Date(a.date + 'T00:00:00').getTime()
        const dateB = new Date(b.date + 'T00:00:00').getTime()
        return dateA - dateB
      })

    const incomeTransactions = monthTransactions.filter(t => t.type === 'income')
    const expenseTransactions = monthTransactions.filter(t => t.type === 'expense')

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0)
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0)
    const balance = totalIncome - totalExpenses
    const salesCount = incomeTransactions.length
    const ticketAverage = salesCount > 0 ? totalIncome / salesCount : 0
    const dailyAverage = daysElapsed > 0 ? totalIncome / daysElapsed : 0
    const monthProjection = isCurrentMonth ? dailyAverage * daysInMonth : totalIncome
    const expensePercent = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0

    const aggregateByDescription = (type: 'income' | 'expense') => {
      const map = new Map<string, { description: string; count: number; total: number }>()

      monthTransactions
        .filter(t => t.type === type)
        .forEach((transaction) => {
          const current = map.get(transaction.description) ?? {
            description: transaction.description,
            count: 0,
            total: 0,
          }

          current.count += 1
          current.total += transaction.amount

          map.set(transaction.description, current)
        })

      return Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
    }

    const topRevenue = aggregateByDescription('income')
    const topExpenses = aggregateByDescription('expense')

    const dailyMap = new Map<number, { income: number; expenses: number; balance: number }>()

    for (let day = 1; day <= daysInMonth; day++) {
      dailyMap.set(day, { income: 0, expenses: 0, balance: 0 })
    }

    monthTransactions.forEach((transaction) => {
      const date = new Date(transaction.date + 'T00:00:00')
      const day = date.getDate()
      const current = dailyMap.get(day)

      if (!current) return

      if (transaction.type === 'income') {
        current.income += transaction.amount
      } else {
        current.expenses += transaction.amount
      }

      current.balance = current.income - current.expenses
    })

    let accumulatedDailyBalance = 0

    const dailyRows = Array.from(dailyMap.entries())
      .map(([day, values]) => {
        accumulatedDailyBalance += values.balance

        return {
          day,
          income: values.income,
          expenses: values.expenses,
          balance: values.balance,
          accumulated: accumulatedDailyBalance,
        }
      })
      .filter(row => row.income > 0 || row.expenses > 0)

    const classifyRevenue = (description: string) => {
      const desc = description.toLowerCase()

      const plano = planos.find((p) => {
        const codigo = String((p as any).codigo ?? '').toLowerCase()
        const descricao = String((p as any).descricao ?? '').toLowerCase()

        return (
          (codigo && desc.includes(codigo)) ||
          (descricao && desc.includes(descricao))
        )
      })

      return plano ? String((plano as any).descricao ?? (plano as any).codigo) : 'Outras receitas'
    }

    const revenueDistributionMap = new Map<string, { name: string; count: number; total: number }>()

    incomeTransactions.forEach((transaction) => {
      const name = classifyRevenue(transaction.description)

      const current = revenueDistributionMap.get(name) ?? {
        name,
        count: 0,
        total: 0,
      }

      current.count += 1
      current.total += transaction.amount

      revenueDistributionMap.set(name, current)
    })

    const revenueDistributionRows = Array.from(revenueDistributionMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const creditRows = servidores
      .map((servidor) => {
        const nome = getServerName(servidor)
        const saldo = getServerCredits(servidor)
        const custoUnitario = toNumber(
          (servidor as any).custoUnitario ??
            (servidor as any).unitCost ??
            (servidor as any).unit_cost ??
            0
        )
        const valorEstoque = saldo * custoUnitario

        return {
          nome,
          saldo,
          custoUnitario,
          valorEstoque,
        }
      })
      .sort((a, b) => b.saldo - a.saldo)

    const totalCredits = creditRows.reduce((sum, item) => sum + item.saldo, 0)
    const totalStockValue = creditRows.reduce((sum, item) => sum + item.valorEstoque, 0)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const marginX = 14
    let y = 16

    const generatedAt = new Date().toLocaleString('pt-BR')

    const addFooter = () => {
      const pageCount = doc.getNumberOfPages()

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        doc.setPage(pageNumber)
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text(`Cash Flow - Gerado em ${generatedAt}`, marginX, 287)
        doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - marginX, 287, {
          align: 'right',
        })
      }
    }

    const ensureSpace = (height: number) => {
      if (y + height > 275) {
        doc.addPage()
        y = 18
      }
    }

    const addSectionTitle = (title: string) => {
      ensureSpace(12)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 20)
      doc.text(title, marginX, y)
      y += 7
    }

    const addSmallText = (text: string) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90, 90, 90)
      doc.text(text, marginX, y)
      y += 5
    }

    const addTable = (
      head: string[][],
      body: (string | number)[][],
      options?: {
        fontSize?: number
        headColor?: [number, number, number]
      }
    ) => {
      autoTable(doc, {
        startY: y,
        head,
        body,
        theme: 'grid',
        styles: {
          fontSize: options?.fontSize ?? 8,
          cellPadding: 2,
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: options?.headColor ?? [0, 132, 255],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: {
          left: marginX,
          right: marginX,
        },
      })

      y = ((doc as any).lastAutoTable?.finalY ?? y) + 9
    }

    // Header
    doc.setFillColor(6, 18, 30)
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 28, 3, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text('Relatório Financeiro Mensal', marginX + 6, y + 11)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(210, 225, 240)
    doc.text(`Período: ${reportMonthLabel}`, marginX + 6, y + 19)
    doc.text(`Gerado em: ${generatedAt}`, pageWidth - marginX - 6, y + 19, {
      align: 'right',
    })

    y += 39

    addSectionTitle('Resumo do mês')

    addTable(
      [['Indicador', 'Valor']],
      [
        ['Receita do mês', formatCurrency(totalIncome)],
        ['Despesas do mês', formatCurrency(totalExpenses)],
        ['Saldo / Lucro do mês', formatCurrency(balance)],
        ['Qtd. de vendas', String(salesCount)],
        ['Ticket médio', formatCurrency(ticketAverage)],
        ['Média diária de entradas', `${formatCurrency(dailyAverage)} / dia`],
        [isCurrentMonth ? 'Projeção do mês' : 'Fechamento do mês', formatCurrency(monthProjection)],
        ['Despesas sobre entradas', `${expensePercent.toFixed(1).replace('.', ',')}%`],
      ],
      { fontSize: 9, headColor: [0, 132, 255] }
    )

    addSectionTitle('Resumo rápido')

    const quickSummary = [
      `O mês de ${reportMonthLabel} registrou ${formatCurrency(totalIncome)} em entradas e ${formatCurrency(totalExpenses)} em saídas.`,
      `O resultado final do período foi de ${formatCurrency(balance)}.`,
      salesCount > 0
        ? `Foram registradas ${salesCount} vendas/entradas, com ticket médio de ${formatCurrency(ticketAverage)}.`
        : 'Não houve vendas/entradas registradas neste período.',
    ]

    quickSummary.forEach(addSmallText)
    y += 2

    addSectionTitle('Top receitas do mês')

    addTable(
      [['Descrição', 'Qtd.', 'Total']],
      topRevenue.length > 0
        ? topRevenue.map(item => [
            item.description,
            String(item.count),
            formatCurrency(item.total),
          ])
        : [['Nenhuma receita no período', '-', '-']],
      { fontSize: 8, headColor: [22, 163, 74] }
    )

    addSectionTitle('Top despesas do mês')

    addTable(
      [['Descrição', 'Qtd.', 'Total']],
      topExpenses.length > 0
        ? topExpenses.map(item => [
            item.description,
            String(item.count),
            formatCurrency(item.total),
          ])
        : [['Nenhuma despesa no período', '-', '-']],
      { fontSize: 8, headColor: [220, 38, 38] }
    )

    addSectionTitle('Receitas por plano / categoria')

    addTable(
      [['Plano / Categoria', 'Qtd.', 'Total']],
      revenueDistributionRows.length > 0
        ? revenueDistributionRows.map(item => [
            item.name,
            String(item.count),
            formatCurrency(item.total),
          ])
        : [['Nenhuma receita no período', '-', '-']],
      { fontSize: 8, headColor: [2, 132, 199] }
    )

    addSectionTitle('Resultado diário')

    addTable(
      [['Dia', 'Entradas', 'Saídas', 'Resultado do dia', 'Saldo acumulado no mês']],
      dailyRows.length > 0
        ? dailyRows.map(item => [
            String(item.day).padStart(2, '0'),
            formatCurrency(item.income),
            formatCurrency(item.expenses),
            formatCurrency(item.balance),
            formatCurrency(item.accumulated),
          ])
        : [['-', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00']],
      { fontSize: 8, headColor: [15, 23, 42] }
    )

    addSectionTitle('Fluxo de créditos do mês')

    addTable(
      [['Indicador', 'Créditos']],
      [
        ['Créditos comprados no mês', formatCredits(creditFlow.totalEntradas)],
        ['Créditos vendidos/consumidos no mês', formatCredits(creditFlow.totalSaidas)],
        ['Saldo líquido do mês', `${creditFlow.saldoLiquido >= 0 ? '+' : '-'}${formatCredits(Math.abs(creditFlow.saldoLiquido))}`],
        ['Saldo atual total dos servidores', formatCredits(creditFlow.saldoAtualTotal)],
      ],
      { fontSize: 9, headColor: [14, 116, 144] }
    )

    addTable(
      [['Dia', 'Entradas de créditos', 'Saídas de créditos', 'Saldo líquido']],
      creditFlow.activeDailyRows.length > 0
        ? creditFlow.activeDailyRows.map(item => [
            item.day,
            formatCredits(item.entradas),
            formatCredits(item.saidas),
            `${item.liquido >= 0 ? '+' : '-'}${formatCredits(Math.abs(item.liquido))}`,
          ])
        : [['-', '0', '0', '0']],
      { fontSize: 8, headColor: [14, 116, 144] }
    )

    addTable(
      [['Servidor', 'Entraram', 'Saíram', 'Saldo líquido', 'Saldo atual']],
      creditFlow.activeServerRows.length > 0
        ? creditFlow.activeServerRows.map(item => [
            item.nome,
            formatCredits(item.entradas),
            formatCredits(item.saidas),
            `${item.liquido >= 0 ? '+' : '-'}${formatCredits(Math.abs(item.liquido))}`,
            formatCredits(item.saldoAtual),
          ])
        : [['Nenhum servidor com movimentação', '-', '-', '-', '-']],
      { fontSize: 8, headColor: [14, 116, 144] }
    )

    addSectionTitle('Créditos atuais por servidor')

    addSmallText('Esta seção mostra a posição atual dos créditos no momento da emissão do relatório.')

    addTable(
      [['Servidor', 'Créditos atuais', 'Custo unitário', 'Valor estimado em estoque']],
      creditRows.length > 0
        ? creditRows.map(item => [
            item.nome,
            formatCredits(item.saldo),
            formatCurrency(item.custoUnitario),
            formatCurrency(item.valorEstoque),
          ])
        : [['Nenhum servidor cadastrado', '-', '-', '-']],
      { fontSize: 8, headColor: [14, 116, 144] }
    )

    addTable(
      [['Resumo de créditos', 'Valor']],
      [
        [
          'Total geral de créditos',
          formatCredits(totalCredits),
        ],
        ['Valor estimado total em estoque', formatCurrency(totalStockValue)],
      ],
      { fontSize: 9, headColor: [14, 116, 144] }
    )

    addSectionTitle('Observações')

    addSmallText(`Este relatório considera apenas as transações registradas em ${reportMonthLabel}.`)
    addSmallText('O fluxo de créditos considera movimentos do mês selecionado e o saldo atual dos servidores.')
    addSmallText('Os créditos por servidor representam o saldo atual no momento da emissão, não um fechamento histórico mensal.')
    addSmallText('Para análise detalhada de cada lançamento individual, utilize também a exportação CSV da aba Transações.')

    addFooter()

    const fileMonth = String(month + 1).padStart(2, '0')
    doc.save(`relatorio-financeiro-${year}-${fileMonth}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Analytics</h2>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePdf}
          >
            <FileText className="mr-2 h-4 w-4" />
            Gerar Relatório PDF
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-[140px] text-center text-sm font-medium">
              {MONTH_NAMES[month]} {year}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={nextMonth}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards
        transactions={transactions}
        month={month}
        year={year}
        prevTransactions={transactions}
      />

      {/* Credit flow */}
      <CreditFlowSummary
        transactions={transactions}
        servidores={servidores}
        movements={movements}
        month={month}
        year={year}
      />

      {/* Daily flow chart */}
      <RevenueChart transactions={transactions} month={month} year={year} />

      {/* Top revenue & expenses side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopRevenue   transactions={transactions} month={month} year={year} />
        <TopExpenses  transactions={transactions} month={month} year={year} />
      </div>

      {/* Server profit & revenue distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ServerProfit
          transactions={transactions}
          servidores={servidores}
          movements={movements}
          month={month}
          year={year}
        />
        <RevenueDistribution
          transactions={transactions}
          planos={planos}
          month={month}
          year={year}
        />
      </div>

      {/* Monthly comparison */}
      <MonthlyComparison
        transactions={transactions}
        currentMonth={month}
        currentYear={year}
      />

      {/* Insights */}
      <InsightsPanel transactions={transactions} month={month} year={year} />
    </div>
  )
}
