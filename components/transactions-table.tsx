'use client'

import { useState } from 'react'
import {
  ArrowUpDown,
  Pencil,
  Trash2,
  Search,
  Filter,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, getMonthYear } from '@/lib/format'
import type { Transaction, SortDirection, FilterType } from '@/lib/types'

interface TransactionsTableProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => void
}

function getCurrentMonthKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  const currentMonthKey = getCurrentMonthKey()

  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthKey)
  const [filterDate, setFilterDate] = useState<string>('')
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const transactionsWithIndex = transactions.map((transaction, index) => ({
    transaction,
    index,
  }))

  // Get unique months from transactions, keeping current month available even if empty
  const months = Array.from(
    new Set([currentMonthKey, ...transactions.map((t) => t.date.substring(0, 7))])
  ).sort((a, b) => b.localeCompare(a))

  // Filter and sort transactions
  const filteredTransactions = transactionsWithIndex
    .filter(({ transaction: t }) => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterMonth !== 'all' && !t.date.startsWith(filterMonth)) return false
      if (filterDate && t.date !== filterDate) return false
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()))
        return false
      return true
    })
    .sort((a, b) => {
      const dateA = new Date(a.transaction.date + 'T00:00:00').getTime()
      const dateB = new Date(b.transaction.date + 'T00:00:00').getTime()

      if (dateA !== dateB) {
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
      }

      return sortDirection === 'asc' ? b.index - a.index : a.index - b.index
    })
    .map(({ transaction }) => transaction)

  // Calculate running balance
  const balances = new Map<string, number>()
  let runningBalance = 0

  // Quando um mês está selecionado, o saldo começa do zero naquele mês.
  // Quando "Todos os Meses" está selecionado, mantém o saldo acumulado geral.
  const balanceBaseTransactions = transactionsWithIndex.filter(({ transaction: t }) => {
    if (filterMonth === 'all') return true
    return t.date.startsWith(filterMonth)
  })

  const allSortedTransactions = [...balanceBaseTransactions]
    .sort((a, b) => {
      const dateA = new Date(a.transaction.date + 'T00:00:00').getTime()
      const dateB = new Date(b.transaction.date + 'T00:00:00').getTime()

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return b.index - a.index
    })
    .map(({ transaction }) => transaction)

  allSortedTransactions.forEach((t) => {
    if (t.type === 'income') {
      runningBalance += t.amount
    } else {
      runningBalance -= t.amount
    }
    balances.set(t.id, runningBalance)
  })

  const toggleSort = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
  }

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId)
      setDeleteId(null)
    }
  }

  const exportCSV = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Valor', 'Saldo']
    const rows = filteredTransactions.map((t) => [
      formatDate(t.date),
      t.type === 'income' ? 'Entrada' : 'Saída',
      t.description,
      t.amount.toFixed(2).replace('.', ','),
      (balances.get(t.id) || 0).toFixed(2).replace('.', ','),
    ])

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fluxo-caixa-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="w-[130px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Entradas</SelectItem>
              <SelectItem value="expense">Saídas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Meses</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {getMonthYear(month + '-01')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-[170px]"
          />

          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <div className="h-24 flex items-center justify-center text-center text-muted-foreground">
            Nenhuma transação encontrada.
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  transaction.type === 'income'
                    ? 'border-income-muted/30 bg-income-muted/10'
                    : 'border-expense-muted/30 bg-expense-muted/10'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {transaction.description}
                    </div>

                    <div className="mt-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          transaction.type === 'income'
                            ? 'bg-income/10 text-income'
                            : 'bg-expense/10 text-expense'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            transaction.type === 'income' ? 'bg-income' : 'bg-expense'
                          )}
                        />
                        {transaction.type === 'income' ? 'Entrada' : 'Saída'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(transaction)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(transaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Data</div>
                    <div className="mt-1 font-medium">
                      {formatDate(transaction.date)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Valor</div>
                    <div
                      className={cn(
                        'mt-1 font-semibold',
                        transaction.type === 'income' ? 'text-income' : 'text-expense'
                      )}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Saldo</div>
                    <div
                      className={cn(
                        'mt-1 font-semibold',
                        (balances.get(transaction.id) || 0) >= 0
                          ? 'text-income'
                          : 'text-expense'
                      )}
                    >
                      {formatCurrency(balances.get(transaction.id) || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 hover:bg-transparent"
                      onClick={toggleSort}
                    >
                      Data
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-[90px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow
                    key={transaction.id}
                    className={cn(
                      'transition-colors',
                      transaction.type === 'income'
                        ? 'bg-income-muted/10 hover:bg-income-muted/20'
                        : 'bg-expense-muted/10 hover:bg-expense-muted/20'
                    )}
                  >
                    <TableCell className="font-medium">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          transaction.type === 'income'
                            ? 'bg-income/10 text-income'
                            : 'bg-expense/10 text-expense'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            transaction.type === 'income' ? 'bg-income' : 'bg-expense'
                          )}
                        />
                        {transaction.type === 'income' ? 'Entrada' : 'Saída'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        transaction.type === 'income' ? 'text-income' : 'text-expense'
                      )}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        (balances.get(transaction.id) || 0) >= 0
                          ? 'text-income'
                          : 'text-expense'
                      )}
                    >
                      {formatCurrency(balances.get(transaction.id) || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(transaction)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}