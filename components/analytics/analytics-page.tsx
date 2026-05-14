'use client'

import { useEffect, useMemo, useState } from 'react'
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

interface SalesMixSummaryProps {
  transactions: Transaction[]
  servidores: Servidor[]
  planos: PlanoEntrada[]
  month: number
  year: number
}

type SalesKindKey = 'renewal' | 'new_client' | 'reseller' | 'other'
type SalesCycleKey = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'other'

interface SalesMixRow {
  key: string
  product: string
  kindKey: SalesKindKey
  kindLabel: string
  cycleKey: SalesCycleKey
  cycleLabel: string
  serverId: string
  serverName: string
  unitPrice: number
  count: number
  revenue: number
  credits: number
  cost: number
  profit: number
  margin: number
}

interface SalesMixBreakdownRow {
  key: string
  label: string
  count: number
  revenue: number
  credits: number
}

type SalesMixGroupBy = 'product' | 'server' | 'kind' | 'cycle'
type SalesMixKindFilter = 'all' | SalesKindKey
type SalesMixCycleFilter = 'all' | SalesCycleKey

interface SalesMixViewRow {
  key: string
  label: string
  subtitle: string
  count: number
  revenue: number
  credits: number
  cost: number
  profit: number
  margin: number
  averageTicket: number
  variationCount: number
}

interface SalesMixAnalytics {
  rows: SalesMixRow[]
  typeRows: SalesMixBreakdownRow[]
  cycleRows: SalesMixBreakdownRow[]
  totalSales: number
  totalRevenue: number
  totalCredits: number
  totalCost: number
  totalProfit: number
  renewalCount: number
  newClientCount: number
  resellerCount: number
  otherCount: number
  monthlyCount: number
  quarterlyCount: number
  semiannualCount: number
  annualCount: number
  hasSales: boolean
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

function getRecordDescription(record: any) {
  return String(record?.description ?? record?.descricao ?? record?.name ?? record?.nome ?? '')
}

function getRecordAmount(record: any) {
  return toNumber(record?.amount ?? record?.valor ?? record?.value ?? record?.total ?? 0)
}

function getServerUnitCost(servidor: any) {
  return toNumber(
    servidor?.unit_cost ??
      servidor?.unitCost ??
      servidor?.custo_unitario ??
      servidor?.custoUnitario ??
      servidor?.credit_cost ??
      servidor?.creditCost ??
      servidor?.cost ??
      0
  )
}

function getPlanId(plan: any) {
  const value = plan?.id ?? plan?.plan_id ?? plan?.planId ?? plan?.codigo ?? plan?.code
  return value ? String(value) : ''
}

function getPlanLabel(plan: any) {
  return String(
    plan?.descricao ??
      plan?.description ??
      plan?.nome ??
      plan?.name ??
      plan?.label ??
      plan?.codigo ??
      plan?.code ??
      ''
  ).trim()
}

function getPlanServerId(plan: any) {
  const value =
    plan?.server_id ??
    plan?.serverId ??
    plan?.servidor_id ??
    plan?.servidorId ??
    plan?.server?.id ??
    plan?.servidor?.id

  return value ? String(value) : ''
}

function getTransactionPlanId(record: any) {
  const value =
    record?.plan_id ??
    record?.planId ??
    record?.plano_id ??
    record?.planoId ??
    record?.template_id ??
    record?.templateId ??
    record?.cash_template_id ??
    record?.cashTemplateId

  return value ? String(value) : ''
}

function findMatchingPlan(record: any, planos: PlanoEntrada[]) {
  const transactionPlanId = getTransactionPlanId(record)

  if (transactionPlanId) {
    const byId = planos.find((plan: any) => getPlanId(plan) === transactionPlanId)
    if (byId) return byId
  }

  const description = normalizeText(getRecordDescription(record))

  if (!description) return null

  return planos.find((plan: any) => {
    const codigo = normalizeText(plan?.codigo ?? plan?.code ?? '')
    const descricao = normalizeText(getPlanLabel(plan))

    return (
      (codigo.length > 1 && description.includes(codigo)) ||
      (descricao.length > 2 && description.includes(descricao))
    )
  }) ?? null
}

function detectSaleKind(record: any, plan: PlanoEntrada | null): { key: SalesKindKey; label: string } {
  const raw = normalizeText([
    getRecordDescription(record),
    (plan as any)?.tipo,
    (plan as any)?.type,
    (plan as any)?.category,
    (plan as any)?.categoria,
    getPlanLabel(plan),
  ].filter(Boolean).join(' '))

  if (
    raw.includes('revenda') ||
    raw.includes('revendedor') ||
    raw.includes('reseller')
  ) {
    return { key: 'reseller', label: 'Revendedor' }
  }

  if (
    raw.includes('cliente novo') ||
    raw.includes('novo cliente') ||
    raw.includes('cliente-novo') ||
    raw.includes('new client') ||
    raw.includes('nova venda') ||
    raw.includes('venda nova')
  ) {
    return { key: 'new_client', label: 'Cliente novo' }
  }

  if (
    raw.includes('renovacao') ||
    raw.includes('renovar') ||
    raw.includes('renov')
  ) {
    return { key: 'renewal', label: 'Renovação' }
  }

  return { key: 'other', label: 'Outras vendas' }
}

function detectSaleCycle(record: any, plan: PlanoEntrada | null): { key: SalesCycleKey; label: string; rank: number } {
  const raw = normalizeText([
    getRecordDescription(record),
    (plan as any)?.period,
    (plan as any)?.periodo,
    (plan as any)?.periodicidade,
    (plan as any)?.cycle,
    (plan as any)?.ciclo,
    (plan as any)?.duration,
    (plan as any)?.duracao,
    getPlanLabel(plan),
  ].filter(Boolean).join(' '))

  if (
    raw.includes('anual') ||
    raw.includes('12 meses') ||
    raw.includes('12 mes') ||
    raw.includes('12m') ||
    raw.includes('1 ano') ||
    raw.includes('365 dias')
  ) {
    return { key: 'annual', label: 'Anual', rank: 5 }
  }

  if (
    raw.includes('semestral') ||
    raw.includes('6 meses') ||
    raw.includes('6 mes') ||
    raw.includes('6m') ||
    raw.includes('180 dias')
  ) {
    return { key: 'semiannual', label: 'Semestral', rank: 4 }
  }

  if (
    raw.includes('trimestral') ||
    raw.includes('3 meses') ||
    raw.includes('3 mes') ||
    raw.includes('3m') ||
    raw.includes('90 dias')
  ) {
    return { key: 'quarterly', label: 'Trimestral', rank: 3 }
  }

  if (
    raw.includes('bimestral') ||
    raw.includes('2 meses') ||
    raw.includes('2 mes') ||
    raw.includes('2m') ||
    raw.includes('60 dias')
  ) {
    return { key: 'bimonthly', label: 'Bimestral', rank: 2 }
  }

  if (
    raw.includes('mensal') ||
    raw.includes('1 mes') ||
    raw.includes('1m') ||
    raw.includes('30 dias')
  ) {
    return { key: 'monthly', label: 'Mensal', rank: 1 }
  }

  return { key: 'other', label: 'Não informado', rank: 99 }
}

function resolveSaleServer(record: any, plan: PlanoEntrada | null, servidores: Servidor[]) {
  const recordServerId = getMovementServerId(record)
  const planServerId = getPlanServerId(plan)
  const directServerId = recordServerId || planServerId

  if (directServerId) {
    const server = servidores.find((servidor) => getServidorId(servidor) === directServerId)

    if (server) {
      return {
        id: getServidorId(server),
        name: getServerName(server),
        unitCost: getServerUnitCost(server),
      }
    }
  }

  const directName = String(
    record?.server_name ??
      record?.serverName ??
      record?.servidor_nome ??
      record?.servidorNome ??
      record?.server?.name ??
      record?.servidor?.nome ??
      (plan as any)?.server_name ??
      (plan as any)?.serverName ??
      (plan as any)?.servidor_nome ??
      (plan as any)?.servidorNome ??
      ''
  ).trim()

  if (directName) {
    const server = servidores.find((servidor) => normalizeText(getServerName(servidor)) === normalizeText(directName))

    if (server) {
      return {
        id: getServidorId(server),
        name: getServerName(server),
        unitCost: getServerUnitCost(server),
      }
    }

    return {
      id: normalizeText(directName) || 'sem-servidor',
      name: directName,
      unitCost: 0,
    }
  }

  const description = normalizeText(getRecordDescription(record))
  const serverByDescription = servidores.find((servidor) => {
    const name = normalizeText(getServerName(servidor))
    return name.length > 1 && description.includes(name)
  })

  if (serverByDescription) {
    return {
      id: getServidorId(serverByDescription),
      name: getServerName(serverByDescription),
      unitCost: getServerUnitCost(serverByDescription),
    }
  }

  return {
    id: 'sem-servidor',
    name: 'Sem servidor',
    unitCost: 0,
  }
}

function getSaleCreditsQuantity(record: any, plan: PlanoEntrada | null) {
  const direct = toNumber(
    record?.credits_qty ??
      record?.creditsQty ??
      record?.credit_qty ??
      record?.creditQty ??
      record?.credits_sold ??
      record?.creditsSold ??
      record?.creditos ??
      record?.creditos_qtd ??
      record?.quantity_credits ??
      record?.quantityCredits ??
      0
  )

  if (direct > 0) return direct

  const signedDelta = getSignedCreditDelta(record)
  if (signedDelta !== 0) return Math.abs(signedDelta)

  const planQuantity = toNumber(
    (plan as any)?.credits_qty ??
      (plan as any)?.creditsQty ??
      (plan as any)?.credit_qty ??
      (plan as any)?.creditQty ??
      (plan as any)?.creditos ??
      (plan as any)?.quantity_credits ??
      (plan as any)?.quantityCredits ??
      0
  )

  return planQuantity > 0 ? planQuantity : 0
}

function getSaleCost(record: any, creditsQuantity: number, serverUnitCost: number) {
  const directCost = toNumber(
    record?.cost ??
      record?.custo ??
      record?.credit_cost ??
      record?.creditCost ??
      record?.credits_cost ??
      record?.creditsCost ??
      record?.total_cost ??
      record?.totalCost ??
      0
  )

  if (directCost > 0) return directCost

  return creditsQuantity > 0 && serverUnitCost > 0 ? creditsQuantity * serverUnitCost : 0
}

function buildSaleProductName(
  record: any,
  plan: PlanoEntrada | null,
  kindLabel: string,
  cycleLabel: string,
  cycleKey: SalesCycleKey,
  serverName: string
) {
  const planLabel = getPlanLabel(plan)

  if (planLabel) return planLabel

  const pieces = [
    kindLabel !== 'Outras vendas' ? kindLabel : '',
    cycleKey !== 'other' ? cycleLabel : '',
    serverName !== 'Sem servidor' ? serverName : '',
  ].filter(Boolean)

  if (pieces.length > 0) return pieces.join(' ')

  return getRecordDescription(record) || 'Venda'
}

function buildSalesMixAnalytics(
  transactions: Transaction[],
  servidores: Servidor[],
  planos: PlanoEntrada[],
  month: number,
  year: number
): SalesMixAnalytics {
  const map = new Map<string, SalesMixRow>()
  const typeMap = new Map<string, SalesMixBreakdownRow>()
  const cycleMap = new Map<string, SalesMixBreakdownRow>()

  const summary = {
    totalSales: 0,
    totalRevenue: 0,
    totalCredits: 0,
    totalCost: 0,
    totalProfit: 0,
    renewalCount: 0,
    newClientCount: 0,
    resellerCount: 0,
    otherCount: 0,
    monthlyCount: 0,
    quarterlyCount: 0,
    semiannualCount: 0,
    annualCount: 0,
  }

  const addBreakdown = (
    targetMap: Map<string, SalesMixBreakdownRow>,
    key: string,
    label: string,
    amount: number,
    credits: number
  ) => {
    const current = targetMap.get(key) ?? {
      key,
      label,
      count: 0,
      revenue: 0,
      credits: 0,
    }

    current.count += 1
    current.revenue += amount
    current.credits += credits

    targetMap.set(key, current)
  }

  transactions
    .filter((transaction: any) => transaction?.type === 'income' && isRecordInMonth(transaction, month, year))
    .forEach((transaction: any) => {
      const amount = getRecordAmount(transaction)
      if (amount <= 0) return

      const plan = findMatchingPlan(transaction, planos)
      const kind = detectSaleKind(transaction, plan)
      const cycle = detectSaleCycle(transaction, plan)
      const server = resolveSaleServer(transaction, plan, servidores)
      const credits = getSaleCreditsQuantity(transaction, plan)
      const cost = getSaleCost(transaction, credits, server.unitCost)
      const profit = amount - cost
      const product = buildSaleProductName(transaction, plan, kind.label, cycle.label, cycle.key, server.name)
      const unitPrice = Number(amount.toFixed(2))
      const productKey = normalizeText(product) || normalizeText(getRecordDescription(transaction)) || 'venda'

      const key = [
        kind.key,
        cycle.key,
        normalizeText(server.id || server.name || 'sem-servidor'),
        unitPrice.toFixed(2),
        productKey,
      ].join('|')

      const current = map.get(key) ?? {
        key,
        product,
        kindKey: kind.key,
        kindLabel: kind.label,
        cycleKey: cycle.key,
        cycleLabel: cycle.label,
        serverId: server.id,
        serverName: server.name,
        unitPrice,
        count: 0,
        revenue: 0,
        credits: 0,
        cost: 0,
        profit: 0,
        margin: 0,
      }

      current.count += 1
      current.revenue += amount
      current.credits += credits
      current.cost += cost
      current.profit += profit
      current.margin = current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0

      map.set(key, current)

      summary.totalSales += 1
      summary.totalRevenue += amount
      summary.totalCredits += credits
      summary.totalCost += cost
      summary.totalProfit += profit

      if (kind.key === 'renewal') summary.renewalCount += 1
      if (kind.key === 'new_client') summary.newClientCount += 1
      if (kind.key === 'reseller') summary.resellerCount += 1
      if (kind.key === 'other') summary.otherCount += 1

      if (cycle.key === 'monthly') summary.monthlyCount += 1
      if (cycle.key === 'quarterly') summary.quarterlyCount += 1
      if (cycle.key === 'semiannual') summary.semiannualCount += 1
      if (cycle.key === 'annual') summary.annualCount += 1

      addBreakdown(typeMap, kind.key, kind.label, amount, credits)
      addBreakdown(cycleMap, cycle.key, cycle.label, amount, credits)
    })

  const rows = Array.from(map.values()).sort((a, b) => {
    const countDiff = b.count - a.count
    if (countDiff !== 0) return countDiff

    const revenueDiff = b.revenue - a.revenue
    if (revenueDiff !== 0) return revenueDiff

    return a.product.localeCompare(b.product, 'pt-BR')
  })

  const cycleOrder: Record<SalesCycleKey, number> = {
    monthly: 1,
    bimonthly: 2,
    quarterly: 3,
    semiannual: 4,
    annual: 5,
    other: 99,
  }

  const typeOrder: Record<SalesKindKey, number> = {
    renewal: 1,
    new_client: 2,
    reseller: 3,
    other: 99,
  }

  const typeRows = Array.from(typeMap.values()).sort((a, b) => {
    return (typeOrder[a.key as SalesKindKey] ?? 99) - (typeOrder[b.key as SalesKindKey] ?? 99)
  })

  const cycleRows = Array.from(cycleMap.values()).sort((a, b) => {
    return (cycleOrder[a.key as SalesCycleKey] ?? 99) - (cycleOrder[b.key as SalesCycleKey] ?? 99)
  })

  return {
    rows,
    typeRows,
    cycleRows,
    ...summary,
    hasSales: summary.totalSales > 0,
  }
}


function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isMobile
}

function CustomCreditTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  const entradas = Number(payload.find((item: any) => item?.dataKey === 'entradas')?.value ?? 0)
  const saidas = Number(payload.find((item: any) => item?.dataKey === 'saidas')?.value ?? 0)

  return (
    <div className="max-w-[240px] rounded-xl border border-border/80 bg-background/95 px-3 py-2.5 shadow-2xl backdrop-blur-sm sm:px-4 sm:py-3">
      <p className="mb-2 text-sm font-semibold text-foreground">Dia {label}</p>
      <div className="space-y-1 text-sm">
        <p className="font-medium text-emerald-500">Entradas: {formatCredits(entradas)} créditos</p>
        <p className="font-medium text-rose-500">Saídas: {formatCredits(saidas)} créditos</p>
      </div>
    </div>
  )
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
  const isMobile = useIsMobileLayout()
  const chartRows = isMobile && data.activeDailyRows.length > 0 ? data.activeDailyRows : data.dailyRows

  const cardBaseClass = 'rounded-2xl border bg-card/40 p-4 shadow-sm'
  const topServers = data.activeServerRows.slice(0, 6)
  const criticalServers = data.activeServerRows.filter(
    row => row.saldoAtual > 0 && row.saldoAtual <= CREDIT_WARNING_LIMIT
  )

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-card/40 p-4 shadow-sm sm:p-5">
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
          <p className="text-xs text-muted-foreground">Variação do mês</p>
          <p className={`mt-2 text-2xl font-bold ${data.saldoLiquido >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {data.saldoLiquido >= 0 ? '+' : '-'}{formatCredits(Math.abs(data.saldoLiquido))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Diferença entre entradas e saídas</p>
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
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/30 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium">Entradas x Saídas por dia</h4>
              <p className="text-xs text-muted-foreground">Visão diária em quantidade de créditos</p>
            </div>
          </div>

          <div className="h-[260px]">
            {data.hasMonthlyMovements ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  margin={{ top: 8, right: isMobile ? 8 : 12, left: 0, bottom: 0 }}
                  barCategoryGap={isMobile ? 8 : '10%'}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={isMobile ? 0 : 'preserveStartEnd'}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 32 : 40}
                    tickFormatter={(value) => formatCredits(Number(value))}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    content={<CustomCreditTooltip />}
                    allowEscapeViewBox={{ x: false, y: true }}
                    wrapperStyle={{ zIndex: 50, outline: 'none' }}
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

          <div className="hidden overflow-x-auto sm:block">
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

          <div className="space-y-2 sm:hidden">
            {topServers.length > 0 ? (
              topServers.map((server) => (
                <div key={server.id} className="rounded-xl border border-border/50 bg-card/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{server.nome}</p>
                      {server.saldoAtual > 0 && server.saldoAtual <= CREDIT_WARNING_LIMIT && (
                        <p className="text-xs text-amber-500">Saldo baixo</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Saldo</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCredits(server.saldoAtual)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
                      <p className="text-muted-foreground">Entraram</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-emerald-500">+{formatCredits(server.entradas)}</p>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 px-2 py-2">
                      <p className="text-muted-foreground">Saíram</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-rose-500">-{formatCredits(server.saidas)}</p>
                    </div>
                  </div>
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
    </section>
  )
}

function aggregateSalesMixRows(rows: SalesMixRow[], groupBy: SalesMixGroupBy): SalesMixViewRow[] {
  if (groupBy === 'product') {
    return rows
      .map((row) => ({
        key: row.key,
        label: row.product,
        subtitle: `${row.kindLabel} • ${row.cycleLabel} • ${row.serverName} • ${formatCurrency(row.unitPrice)}`,
        count: row.count,
        revenue: row.revenue,
        credits: row.credits,
        cost: row.cost,
        profit: row.profit,
        margin: row.margin,
        averageTicket: row.count > 0 ? row.revenue / row.count : 0,
        variationCount: 1,
      }))
      .sort((a, b) => {
        const countDiff = b.count - a.count
        if (countDiff !== 0) return countDiff
        return b.revenue - a.revenue
      })
  }

  const map = new Map<string, SalesMixViewRow>()

  rows.forEach((row) => {
    const groupKey =
      groupBy === 'server'
        ? `server:${normalizeText(row.serverId || row.serverName || 'sem-servidor')}`
        : groupBy === 'kind'
          ? `kind:${row.kindKey}`
          : `cycle:${row.cycleKey}`

    const label =
      groupBy === 'server'
        ? row.serverName
        : groupBy === 'kind'
          ? row.kindLabel
          : row.cycleLabel

    const current = map.get(groupKey) ?? {
      key: groupKey,
      label,
      subtitle: '',
      count: 0,
      revenue: 0,
      credits: 0,
      cost: 0,
      profit: 0,
      margin: 0,
      averageTicket: 0,
      variationCount: 0,
    }

    current.count += row.count
    current.revenue += row.revenue
    current.credits += row.credits
    current.cost += row.cost
    current.profit += row.profit
    current.margin = current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0
    current.averageTicket = current.count > 0 ? current.revenue / current.count : 0
    current.variationCount += 1

    map.set(groupKey, current)
  })

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      subtitle:
        groupBy === 'server'
          ? `${row.variationCount} variação${row.variationCount === 1 ? '' : 'ões'} de produto/preço nesse servidor`
          : groupBy === 'kind'
            ? `${row.variationCount} variação${row.variationCount === 1 ? '' : 'ões'} dentro deste tipo`
            : `${row.variationCount} variação${row.variationCount === 1 ? '' : 'ões'} dentro deste período`,
    }))
    .sort((a, b) => {
      const countDiff = b.count - a.count
      if (countDiff !== 0) return countDiff
      return b.revenue - a.revenue
    })
}

function SalesMixBreakdownList({ title, rows }: { title: string; rows: SalesMixBreakdownRow[] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/30 p-3 sm:p-4">
      <div className="mb-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">Quantidade, receita total, ticket médio e créditos consumidos</p>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="grid grid-cols-[minmax(0,1.4fr)_0.45fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-border/70 pb-2 text-xs font-medium text-muted-foreground">
              <span>Categoria</span>
              <span className="text-right">Qtd.</span>
              <span className="text-right">Receita</span>
              <span className="text-right">Média</span>
              <span className="text-right">Créditos</span>
            </div>

            {rows.map((row) => {
              const averageRevenue = row.count > 0 ? row.revenue / row.count : 0

              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[minmax(0,1.4fr)_0.45fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-border/40 py-3 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.label}</p>
                    <p className="text-xs text-muted-foreground">Resumo consolidado</p>
                  </div>
                  <span className="self-center text-right font-bold tabular-nums text-sky-500">{row.count}</span>
                  <span className="self-center text-right tabular-nums text-emerald-500">{formatCurrency(row.revenue)}</span>
                  <span className="self-center text-right tabular-nums">{formatCurrency(averageRevenue)}</span>
                  <span className="self-center text-right tabular-nums text-cyan-500">{formatCredits(row.credits)}</span>
                </div>
              )
            })}
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => {
              const averageRevenue = row.count > 0 ? row.revenue / row.count : 0

              return (
                <div key={row.key} className="rounded-xl border border-border/50 bg-card/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{row.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Receita total {formatCurrency(row.revenue)}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-muted-foreground">Qtd.</p>
                      <p className="text-xl font-bold tabular-nums text-sky-500">{row.count}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
                      <p className="text-muted-foreground">Receita</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-emerald-500">{formatCurrency(row.revenue)}</p>
                    </div>
                    <div className="rounded-lg bg-sky-500/10 px-2 py-2">
                      <p className="text-muted-foreground">Média</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-sky-500">{formatCurrency(averageRevenue)}</p>
                    </div>
                    <div className="rounded-lg bg-cyan-500/10 px-2 py-2 col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-muted-foreground">Créditos consumidos</p>
                        <p className="font-semibold tabular-nums text-cyan-500">{formatCredits(row.credits)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
          Nenhuma venda para exibir.
        </div>
      )}
    </div>
  )
}

function SalesMixSummary({
  transactions,
  servidores,
  planos,
  month,
  year,
}: SalesMixSummaryProps) {
  const data = useMemo(
    () => buildSalesMixAnalytics(transactions, servidores, planos, month, year),
    [transactions, servidores, planos, month, year]
  )

  const [groupBy, setGroupBy] = useState<SalesMixGroupBy>('product')
  const [kindFilter, setKindFilter] = useState<SalesMixKindFilter>('all')
  const [cycleFilter, setCycleFilter] = useState<SalesMixCycleFilter>('all')
  const [showAllRows, setShowAllRows] = useState(false)

  useEffect(() => {
    setShowAllRows(false)
  }, [groupBy, kindFilter, cycleFilter, month, year])

  const filteredRows = useMemo(() => {
    return data.rows.filter((row) => {
      const matchesKind = kindFilter === 'all' || row.kindKey === kindFilter
      const matchesCycle = cycleFilter === 'all' || row.cycleKey === cycleFilter
      return matchesKind && matchesCycle
    })
  }, [data.rows, kindFilter, cycleFilter])

  const viewRows = useMemo(
    () => aggregateSalesMixRows(filteredRows, groupBy),
    [filteredRows, groupBy]
  )

  const visibleRows = showAllRows ? viewRows : viewRows.slice(0, 10)
  const hiddenRowsCount = Math.max(viewRows.length - visibleRows.length, 0)

  const cardBaseClass = 'rounded-2xl border bg-card/40 p-3 shadow-sm sm:p-4'
  const summaryCards = [
    {
      label: 'Total de vendas',
      value: data.totalSales,
      helper: formatCurrency(data.totalRevenue),
      className: 'border-sky-500/25',
      valueClassName: 'text-sky-500',
    },
    {
      label: 'Renovações',
      value: data.renewalCount,
      helper: 'Vendas de clientes ativos',
      className: 'border-emerald-500/25',
      valueClassName: 'text-emerald-500',
    },
    {
      label: 'Clientes novos',
      value: data.newClientCount,
      helper: 'Entradas novas no mês',
      className: 'border-cyan-500/25',
      valueClassName: 'text-cyan-500',
    },
    {
      label: 'Mensal',
      value: data.monthlyCount,
      helper: 'Planos de 1 mês',
      className: 'border-emerald-500/25',
      valueClassName: 'text-emerald-500',
    },
    {
      label: 'Trimestral',
      value: data.quarterlyCount,
      helper: 'Planos de 3 meses',
      className: 'border-amber-500/25',
      valueClassName: 'text-amber-500',
    },
    {
      label: 'Semestral',
      value: data.semiannualCount,
      helper: 'Planos de 6 meses',
      className: 'border-orange-500/25',
      valueClassName: 'text-orange-500',
    },
    {
      label: 'Anual',
      value: data.annualCount,
      helper: 'Planos de 12 meses',
      className: 'border-fuchsia-500/25',
      valueClassName: 'text-fuchsia-500',
    },
  ]

  const groupOptions: { key: SalesMixGroupBy; label: string }[] = [
    { key: 'product', label: 'Produto/preço' },
    { key: 'server', label: 'Servidor' },
    { key: 'kind', label: 'Tipo' },
    { key: 'cycle', label: 'Período' },
  ]

  const kindOptions: { key: SalesMixKindFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    ...data.typeRows.map((row) => ({
      key: row.key as SalesKindKey,
      label: row.label,
    })),
  ]

  const cycleOptions: { key: SalesMixCycleFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    ...data.cycleRows.map((row) => ({
      key: row.key as SalesCycleKey,
      label: row.label,
    })),
  ]

  const activeGroupLabel = groupOptions.find(option => option.key === groupBy)?.label ?? 'Produto/preço'
  const filteredTotals = viewRows.reduce(
    (acc, row) => {
      acc.count += row.count
      acc.revenue += row.revenue
      acc.credits += row.credits
      acc.profit += row.profit
      return acc
    },
    { count: 0, revenue: 0, credits: 0, profit: 0 }
  )

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-card/40 p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Mix de Vendas do Mês</h3>
          <p className="text-sm text-muted-foreground">
            Quantidade por tipo, período, servidor e preço vendido no mês selecionado.
          </p>
        </div>

        {data.hasSales && (
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
            Lucro bruto das vendas: {formatCurrency(data.totalProfit)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${cardBaseClass} ${card.className}`}>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${card.valueClassName}`}>
              {card.value.toLocaleString('pt-BR')}
            </p>
            <p className="mt-1 min-h-[28px] text-[11px] leading-tight text-muted-foreground sm:text-xs">
              {card.helper}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border/70 bg-background/30 p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h4 className="text-sm font-medium">Análise de vendas</h4>
            <p className="text-xs text-muted-foreground">
              Visual atual: {activeGroupLabel}. Use os filtros para reduzir a lista sem criar outra tela.
            </p>
          </div>

          {data.hasSales && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:min-w-[460px]">
              <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-2">
                <p className="text-muted-foreground">Qtd.</p>
                <p className="font-bold tabular-nums text-sky-500">{filteredTotals.count.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-2">
                <p className="text-muted-foreground">Receita</p>
                <p className="font-bold tabular-nums text-emerald-500">{formatCurrency(filteredTotals.revenue)}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-2">
                <p className="text-muted-foreground">Créditos</p>
                <p className="font-bold tabular-nums text-cyan-500">{formatCredits(filteredTotals.credits)}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-2">
                <p className="text-muted-foreground">Lucro bruto</p>
                <p className={`font-bold tabular-nums ${filteredTotals.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(filteredTotals.profit)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agrupar por</p>
            <div className="flex flex-wrap gap-2">
              {groupOptions.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  variant={groupBy === option.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setGroupBy(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tipo</p>
              <div className="flex flex-wrap gap-2">
                {kindOptions.map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    variant={kindFilter === option.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setKindFilter(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Período</p>
              <div className="flex flex-wrap gap-2">
                {cycleOptions.map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    variant={cycleFilter === option.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setCycleFilter(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {data.hasSales ? (
          viewRows.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {viewRows.length} resultado{viewRows.length === 1 ? '' : 's'} encontrado{viewRows.length === 1 ? '' : 's'}
                </span>
                {!showAllRows && hiddenRowsCount > 0 && (
                  <span>Mostrando os 10 principais</span>
                )}
              </div>

              <div className="hidden lg:block">
                <div className="grid grid-cols-[minmax(0,1.6fr)_0.4fr_0.65fr_0.65fr_0.55fr_0.65fr] gap-3 border-b border-border/70 pb-2 text-xs font-medium text-muted-foreground">
                  <span>Item</span>
                  <span className="text-right">Qtd.</span>
                  <span className="text-right">Receita</span>
                  <span className="text-right">Ticket médio</span>
                  <span className="text-right">Créditos</span>
                  <span className="text-right">Lucro bruto</span>
                </div>

                {visibleRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[minmax(0,1.6fr)_0.4fr_0.65fr_0.65fr_0.55fr_0.65fr] gap-3 border-b border-border/40 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                    </div>
                    <span className="self-center text-right font-bold tabular-nums text-sky-500">{row.count}</span>
                    <span className="self-center text-right tabular-nums text-emerald-500">{formatCurrency(row.revenue)}</span>
                    <span className="self-center text-right tabular-nums">{formatCurrency(row.averageTicket)}</span>
                    <span className="self-center text-right tabular-nums text-cyan-500">{formatCredits(row.credits)}</span>
                    <span className={`self-center text-right tabular-nums ${row.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatCurrency(row.profit)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 lg:hidden">
                {visibleRows.map((row) => (
                  <div key={row.key} className="rounded-xl border border-border/50 bg-card/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold">{row.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.subtitle}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-muted-foreground">Qtd.</p>
                        <p className="text-xl font-bold tabular-nums text-sky-500">{row.count}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
                        <p className="text-muted-foreground">Receita</p>
                        <p className="mt-0.5 font-semibold tabular-nums text-emerald-500">{formatCurrency(row.revenue)}</p>
                      </div>
                      <div className="rounded-lg bg-sky-500/10 px-2 py-2">
                        <p className="text-muted-foreground">Ticket médio</p>
                        <p className="mt-0.5 font-semibold tabular-nums text-sky-500">{formatCurrency(row.averageTicket)}</p>
                      </div>
                      <div className="rounded-lg bg-cyan-500/10 px-2 py-2">
                        <p className="text-muted-foreground">Créditos</p>
                        <p className="mt-0.5 font-semibold tabular-nums text-cyan-500">{formatCredits(row.credits)}</p>
                      </div>
                      <div className={`${row.profit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'} rounded-lg px-2 py-2`}>
                        <p className="text-muted-foreground">Lucro bruto</p>
                        <p className={`mt-0.5 font-semibold tabular-nums ${row.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatCurrency(row.profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {viewRows.length > 10 && (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setShowAllRows((current) => !current)}
                  >
                    {showAllRows ? 'Ver menos' : `Ver todos (${viewRows.length})`}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground">
              Nenhuma venda encontrada com os filtros selecionados.
            </div>
          )
        ) : (
          <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground">
            Nenhuma venda encontrada para o mês selecionado.
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SalesMixBreakdownList title="Resumo por tipo" rows={data.typeRows} />
        <SalesMixBreakdownList title="Resumo por período" rows={data.cycleRows} />
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
    const salesMix = buildSalesMixAnalytics(transactions, servidores, planos, month, year)

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
        ['Variação do mês', `${creditFlow.saldoLiquido >= 0 ? '+' : '-'}${formatCredits(Math.abs(creditFlow.saldoLiquido))}`],
        ['Saldo atual total dos servidores', formatCredits(creditFlow.saldoAtualTotal)],
      ],
      { fontSize: 9, headColor: [14, 116, 144] }
    )

    addTable(
      [['Dia', 'Entradas de créditos', 'Saídas de créditos', 'Variação']],
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
      [['Servidor', 'Entraram', 'Saíram', 'Variação', 'Saldo atual']],
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

    addSectionTitle('Mix de vendas do mês')

    addTable(
      [['Indicador', 'Valor']],
      [
        ['Total de vendas', String(salesMix.totalSales)],
        ['Renovações', String(salesMix.renewalCount)],
        ['Clientes novos', String(salesMix.newClientCount)],
        ['Planos mensais', String(salesMix.monthlyCount)],
        ['Planos trimestrais', String(salesMix.quarterlyCount)],
        ['Planos semestrais', String(salesMix.semiannualCount)],
        ['Planos anuais', String(salesMix.annualCount)],
        ['Receita agrupada', formatCurrency(salesMix.totalRevenue)],
        ['Créditos consumidos', formatCredits(salesMix.totalCredits)],
        ['Lucro bruto das vendas', formatCurrency(salesMix.totalProfit)],
      ],
      { fontSize: 9, headColor: [2, 132, 199] }
    )

    addTable(
      [['Produto', 'Tipo', 'Período', 'Servidor', 'Valor', 'Qtd.', 'Receita', 'Créditos', 'Lucro bruto']],
      salesMix.rows.length > 0
        ? salesMix.rows.map(item => [
            item.product,
            item.kindLabel,
            item.cycleLabel,
            item.serverName,
            formatCurrency(item.unitPrice),
            String(item.count),
            formatCurrency(item.revenue),
            formatCredits(item.credits),
            formatCurrency(item.profit),
          ])
        : [['Nenhuma venda no período', '-', '-', '-', '-', '-', '-', '-', '-']],
      { fontSize: 7, headColor: [2, 132, 199] }
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

      {/* Sales mix */}
      <SalesMixSummary
        transactions={transactions}
        servidores={servidores}
        planos={planos}
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
