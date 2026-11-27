'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SummaryCards } from '@/components/summary-cards'
import { ACTIVITY_LABELS, activityBreakdown, expenseCategories, filterActivity, financialSummary, monthlySeries, monthTransactions, revenueRanking } from '@/lib/activity'
import type { ActivityScope } from '@/lib/activity'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Transaction } from '@/lib/types'

const COLORS = ['#009dff', '#a78bfa', '#f59e0b', '#60a5fa', '#34d399']
interface Props { transactions: Transaction[]; scope: ActivityScope }
const moneyTooltip = (value: unknown) => formatCurrency(Number(value))

export function ActivityAnalytics({ transactions, scope }: Props) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const selected = filterActivity(transactions, scope)
  const monthly = monthTransactions(selected, month, year)
  const summary = financialSummary(monthly)
  const breakdown = activityBreakdown(monthly)
  const trend = monthlySeries(selected, month, year)
  const pie = scope === 'printing_3d' ? expenseCategories(monthly) : breakdown.map(row => ({ name: row.label, value: row.income }))
  const ranking = scope === 'printing_3d' ? revenueRanking(monthly).slice(0, 10) : []
  const label = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const current = month === today.getMonth() && year === today.getFullYear()
  const share = summary.income > 0 ? breakdown[1].income / summary.income * 100 : 0

  function changeMonth(delta: number) {
    const date = new Date(year, month + delta, 1)
    setMonth(date.getMonth()); setYear(date.getFullYear())
  }
  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Cash Flow - ' + ACTIVITY_LABELS[scope], 14, 18)
    doc.setFontSize(10)
    doc.text(label + ' | Saldo financeiro: entradas menos saídas', 14, 26)
    autoTable(doc, {
      startY: 32,
      head: [['Entradas', 'Saídas', 'Saldo']],
      body: [[formatCurrency(summary.income), formatCurrency(summary.expenses), formatCurrency(summary.balance)]],
    })
    const after = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    autoTable(doc, {
      startY: after + 8,
      head: [['Data', 'Atividade', 'Descrição', 'Cliente', 'Pagamento', 'Tipo', 'Valor']],
      body: [...monthly].sort((a, b) => a.date.localeCompare(b.date)).map(t => [
        formatDate(t.date), ACTIVITY_LABELS[t.activity || 'unclassified'], t.description,
        t.printingDetails?.customerName || '-', t.printingDetails?.paymentMethod || '-',
        t.type === 'income' ? 'Entrada' : 'Saída', formatCurrency(t.amount),
      ]),
      styles: { fontSize: 7 },
    })
    doc.save('analytics-' + scope + '-' + year + '-' + String(month + 1).padStart(2, '0') + '.pdf')
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Analytics · {ACTIVITY_LABELS[scope]}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />Gerar Relatório PDF</Button>
        <Button size="icon" variant="ghost" aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[130px] text-center text-sm capitalize">{label}</span>
        <Button size="icon" variant="ghost" aria-label="Próximo mês" disabled={current} onClick={() => changeMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
    <SummaryCards totalIncome={summary.income} totalExpenses={summary.expenses} balance={summary.balance} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardContent><p className="text-sm text-muted-foreground">{scope === 'all' ? 'Participação 3D nas entradas' : 'Vendas no mês'}</p>
        <p className="mt-1 text-2xl font-bold text-primary">{scope === 'all' ? share.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : summary.sales}</p></CardContent></Card>
      <Card><CardContent><p className="text-sm text-muted-foreground">Ticket médio das entradas</p><p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(summary.ticket)}</p></CardContent></Card>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="min-w-0"><CardHeader><CardTitle className="text-base">{scope === 'all' ? 'Evolução das entradas por atividade' : 'Entradas e saídas por mês'}</CardTitle></CardHeader>
        <CardContent><div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {scope === 'all' ? <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="label" /><YAxis tickFormatter={n => Number(n).toLocaleString('pt-BR')} /><Tooltip formatter={moneyTooltip} /><Legend />
              <Line name="IPTV" dataKey="iptv" stroke={COLORS[0]} /><Line name="Impressão 3D" dataKey="printing_3d" stroke={COLORS[1]} /><Line name="Não classificados" dataKey="unclassified" stroke={COLORS[2]} />
            </LineChart> : <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="label" /><YAxis tickFormatter={n => Number(n).toLocaleString('pt-BR')} /><Tooltip formatter={moneyTooltip} /><Legend />
              <Bar name="Entradas" dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} /><Bar name="Saídas" dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>}
          </ResponsiveContainer>
        </div></CardContent>
      </Card>
      <Card className="min-w-0"><CardHeader><CardTitle className="text-base">{scope === 'printing_3d' ? 'Despesas 3D por categoria' : 'Entradas por atividade'}</CardTitle></CardHeader>
        <CardContent>
          {pie.some(item => item.value > 0) ? <>
            <div className="h-52 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={pie.filter(item => item.value > 0)} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {pie.filter(item => item.value > 0).map((item, index) => <Cell key={item.name} fill={COLORS[pie.findIndex(source => source.name === item.name) % COLORS.length]} />)}
              </Pie><Tooltip formatter={moneyTooltip} />
            </PieChart></ResponsiveContainer></div>
            <div className="space-y-2">{pie.map((item, index) => <div key={item.name} className="flex justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item.name}</span><span>{formatCurrency(item.value)}</span>
            </div>)}</div>
          </> : <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período selecionado.</p>}
        </CardContent>
      </Card>
    </div>
    {scope === 'all' && <Card><CardHeader><CardTitle className="text-base">Resultado por atividade · {label}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="pb-3 text-left">Atividade</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo</th></tr></thead>
        <tbody>{breakdown.map(row => <tr key={row.activity} className="border-t border-border"><td className="py-3 pr-3">{row.label}</td><td className="text-right text-income">{formatCurrency(row.income)}</td><td className="text-right text-expense">{formatCurrency(row.expenses)}</td><td className="text-right">{formatCurrency(row.balance)}</td></tr>)}</tbody>
      </table></CardContent>
    </Card>}
    {scope === 'printing_3d' && <Card><CardHeader><CardTitle className="text-base">Peças com maior receita</CardTitle></CardHeader><CardContent>
      {ranking.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma venda 3D neste período.</p> : <div className="space-y-4">{ranking.map((item, index) => <div key={item.name}>
        <div className="mb-1 flex justify-between gap-3 text-sm"><span>{index + 1}. {item.name}</span><span className="font-semibold">{formatCurrency(item.value)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-violet-400" style={{ width: (ranking[0].value > 0 ? item.value / ranking[0].value * 100 : 0) + '%' }} /></div>
      </div>)}</div>}
      <p className="mt-4 text-xs text-muted-foreground">Agrupamento pela peça informada; na ausência, pela descrição do lançamento.</p>
    </CardContent></Card>}
    <p className="text-xs text-muted-foreground">Saldo financeiro representa entradas menos saídas. O valor não corresponde ao lucro por peça.</p>
  </div>
}
