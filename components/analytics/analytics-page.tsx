'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
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
import { formatCurrency, formatDate } from '@/lib/format'
import type { Transaction, Servidor, CreditMovement, PlanoEntrada } from '@/lib/types'

interface AnalyticsPageProps {
  transactions: Transaction[]
  servidores: Servidor[]
  movements: CreditMovement[]
  planos: PlanoEntrada[]
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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
        const nome = String((servidor as any).nome ?? (servidor as any).name ?? 'Servidor')
        const saldo = Number((servidor as any).creditsBalance ?? (servidor as any).credits ?? 0)
        const custoUnitario = Number((servidor as any).custoUnitario ?? (servidor as any).unitCost ?? 0)
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

    addSectionTitle('Créditos atuais por servidor')

    addSmallText('Esta seção mostra a posição atual dos créditos no momento da emissão do relatório.')

    addTable(
      [['Servidor', 'Créditos atuais', 'Custo unitário', 'Valor estimado em estoque']],
      creditRows.length > 0
        ? creditRows.map(item => [
            item.nome,
            item.saldo.toLocaleString('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }),
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
          totalCredits.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }),
        ],
        ['Valor estimado total em estoque', formatCurrency(totalStockValue)],
      ],
      { fontSize: 9, headColor: [14, 116, 144] }
    )

    addSectionTitle('Observações')

    addSmallText(`Este relatório considera apenas as transações registradas em ${reportMonthLabel}.`)
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