'use client'

import { useState } from 'react'
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Filter,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const transactionsWithIndex = transactions.map((transaction, index) => ({
    transaction,
    index,
  }))

  // Get unique months from transactions
  const months = Array.from(
    new Set(transactions.map((t) => t.date.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a))

  // Filter and sort transactions
  const filteredTransactions = transactionsWithIndex
    .filter(({ transaction: t }) => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterMonth !== 'all' && !t.date.startsWith(filterMonth)) return false
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

  // Calculate cumulative balance including previous transactions
  const allSortedTransactions = [...transactionsWithIndex]
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

          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
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
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhuma transação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(transaction)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(transaction.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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