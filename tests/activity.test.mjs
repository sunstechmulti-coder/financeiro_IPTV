import assert from 'node:assert/strict'
import test from 'node:test'
import { activityBreakdown, expenseCategories, filterActivity, financialSummary, monthTransactions, monthlySeries, parsePrintingAmount, revenueRanking, transactionActivity } from '../lib/activity.ts'

function tx(id, activity, type, amount, date = '2026-11-27', printingDetails) {
  return { id, activity, type, amount, date, description: 'Lançamento ' + id, createdAt: date + 'T10:00:00Z', printingDetails }
}
const rows = [
  tx('i1', 'iptv', 'income', 100.10), tx('i2', 'iptv', 'expense', 20.03),
  tx('p1', 'printing_3d', 'income', 180, '2026-11-20', { customerName: 'Cliente A', productName: 'Peça A' }),
  tx('p2', 'printing_3d', 'expense', 30, '2026-11-22', { category: 'Filamentos' }),
  tx('u1', null, 'income', 70), tx('u2', null, 'expense', 5),
]

test('Consolidado preserva o histórico e soma as três classificações', () => {
  assert.deepEqual(filterActivity(rows, 'all'), rows)
  const total = financialSummary(rows)
  const parts = activityBreakdown(rows)
  assert.equal(total.income, 350.1)
  assert.equal(total.expenses, 55.03)
  assert.equal(total.balance, 295.07)
  assert.equal(Math.round(parts.reduce((sum, p) => sum + p.balance, 0) * 100), 29507)
})

test('IPTV nunca recebe 3D ou legado como atividade confirmada', () => {
  assert.deepEqual(filterActivity(rows, 'iptv').map(t => t.id), ['i1', 'i2'])
  assert.deepEqual(filterActivity(rows, 'printing_3d').map(t => t.id), ['p1', 'p2'])
  assert.deepEqual(filterActivity(rows, 'unclassified').map(t => t.id), ['u1', 'u2'])
  assert.equal(transactionActivity({ ...rows[0], activity: undefined }), 'unclassified')
})

test('perfil comum mantém histórico e não recebe dados 3D', () => {
  for (const scope of ['all', 'iptv', 'printing_3d', 'unclassified']) {
    assert.deepEqual(filterActivity(rows, scope, false).map(t => t.id), ['i1', 'i2', 'u1', 'u2'])
  }
})

test('somar em centavos evita diferenças no saldo', () => {
  assert.equal(financialSummary([tx('a', null, 'income', 0.1), tx('b', null, 'income', 0.2)]).income, 0.3)
  assert.equal(financialSummary([]).ticket, 0)
})

test('períodos usam a data registrada, incluindo virada do ano', () => {
  const dates = [tx('a', 'printing_3d', 'income', 10, '2025-12-31'), tx('b', 'printing_3d', 'income', 20, '2026-01-01')]
  assert.deepEqual(monthTransactions(dates, 0, 2026).map(t => t.id), ['b'])
  const series = monthlySeries(dates, 0, 2026)
  assert.equal(series[0].period, '2025-08')
  assert.equal(series[4].income, 10)
  assert.equal(series[5].income, 20)
})

test('vendas e clientes identificados ignoram despesas e nomes vazios', () => {
  const selected = [
    tx('a', 'printing_3d', 'income', 40, '2026-11-01', { customerName: ' Cliente A ' }),
    tx('b', 'printing_3d', 'income', 20, '2026-11-02', { customerName: 'cliente a' }),
    tx('c', 'printing_3d', 'income', 30),
    tx('d', 'printing_3d', 'expense', 10, '2026-11-02', { customerName: 'Outro' }),
  ]
  assert.equal(financialSummary(selected).sales, 3)
  assert.equal(financialSummary(selected).customers, 1)
  assert.equal(financialSummary(selected).ticket, 30)
})

test('ranking usa peça informada e despesas usam categoria', () => {
  assert.deepEqual(revenueRanking(filterActivity(rows, 'printing_3d')), [{ name: 'Peça A', value: 180 }])
  assert.deepEqual(expenseCategories(filterActivity(rows, 'printing_3d')), [{ name: 'Filamentos', value: 30 }])
  assert.equal(revenueRanking([tx('z', 'printing_3d', 'income', 8)])[0].name, 'Lançamento z')
  assert.equal(expenseCategories([tx('z', 'printing_3d', 'expense', 8)])[0].name, 'Sem categoria')
})

test('valor aceita vírgula, ponto decimal e agrupamento brasileiro válido', () => {
  assert.equal(parsePrintingAmount('180,00'), 180)
  assert.equal(parsePrintingAmount('180.50'), 180.5)
  assert.equal(parsePrintingAmount('1.234,56'), 1234.56)
  assert.equal(parsePrintingAmount(' 30 '), 30)
  for (const value of ['', '0', '-10', 'NaN', '1,2,3', '12abc', '1.23,45', '1.001', '10000000000']) {
    assert.equal(parsePrintingAmount(value), null, value)
  }
})
