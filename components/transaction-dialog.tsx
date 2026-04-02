'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertCircle, CalendarIcon, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { Transaction, ActivationProduct } from '@/lib/types'
import { generateId } from '@/lib/storage'
import {
  getServidores,
  getPlanos,
  getSaidasRapidas,
  adjustCreditsBalance,
  getCreditsBalance,
} from '@/lib/config-storage'
import { addCreditMovement } from '@/lib/credit-storage'
import {
  getActivationProducts,
  addActivationTransaction,
  getSalePrice,
} from '@/lib/activation-storage'
import type { Servidor, PlanoEntrada, SaidaRapida } from '@/lib/types'

const QUANTIDADES = [1, 2, 3, 5, 10, 20, 30, 50, 100]

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (transaction: Transaction) => void
  onSaveMultiple?: (transactions: Transaction[]) => void
  onServidoresChange?: (list: Servidor[]) => void
  transaction?: Transaction | null
}

export function TransactionDialog({
  open,
  onOpenChange,
  onSave,
  onSaveMultiple,
  onServidoresChange,
  transaction,
}: TransactionDialogProps) {
  // Config data
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [planos, setPlanos] = useState<PlanoEntrada[]>([])
  const [saidasRapidas, setSaidasRapidas] = useState<SaidaRapida[]>([])
  const [activationProducts, setActivationProducts] = useState<ActivationProduct[]>([])

  // Common fields
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [modo, setModo] = useState<'rapido' | 'ativacao' | 'manual'>('rapido')

  // Type toggle (rapido mode)
  const [type, setType] = useState<'income' | 'expense'>('income')

  // Manual form
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  // Entrada rápida
  const [servidorId, setServidorId] = useState('')
  const [planoId, setPlanoId] = useState('')
  const [qtdEntrada, setQtdEntrada] = useState(1)
  const [qtdFracionada, setQtdFracionada] = useState('1')
  const [registrarCusto, setRegistrarCusto] = useState(false)

  // Saída rápida
  const [saidaId, setSaidaId] = useState('')
  const [qtdSaida, setQtdSaida] = useState(1)
  const [valorManualSaida, setValorManualSaida] = useState('')

  // Ativação
  const [activationProductId, setActivationProductId] = useState('')
  const [activationCusto, setActivationCusto] = useState<number | null>(null)
  const [registrarCustoAtivacao, setRegistrarCustoAtivacao] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────

  const planosDoServidor = planos.filter((p) => p.servidorId === servidorId)
  const planosRenovacao  = planosDoServidor.filter((p) => p.tipo === 'renovacao')
  const planosNovo       = planosDoServidor.filter((p) => p.tipo === 'novo')

  const selectedPlano = planos.find((p) => p.id === planoId) ?? null
  const selectedSaida = saidasRapidas.find((s) => s.id === saidaId) ?? null

  // Fractional quantity support
  const entradaServidor        = servidores.find((s) => s.id === servidorId)
  const permiteVendaFracionada = entradaServidor?.permiteVendaFracionada ?? false
  const qtdEfetiva             = permiteVendaFracionada
    ? (parseFloat(qtdFracionada.replace(',', '.')) || 0)
    : qtdEntrada

  // Entrada totals
  const totalVenda    = selectedPlano ? selectedPlano.valorVenda * qtdEfetiva : 0
  const totalCusto    = selectedPlano ? selectedPlano.custo      * qtdEfetiva : 0
  const totalLucro    = totalVenda - totalCusto
  const totalCreditos = selectedPlano ? selectedPlano.creditos   * qtdEfetiva : 0

  // Credit balance checks — entry (selling a plan)
  const currentBalance      = entradaServidor?.creditsBalance ?? 0
  const afterSaleBalance    = currentBalance - totalCreditos
  const insufficientCredits = selectedPlano !== null && totalCreditos > 0 && afterSaleBalance < 0

  // Credit balance checks — expense (buying credits)
  const saidaServidor        = selectedSaida?.serverId ? servidores.find((s) => s.id === selectedSaida.serverId) : null
  const saidaCurrentBalance  = saidaServidor?.creditsBalance ?? 0
  const afterPurchaseBalance = saidaCurrentBalance + (selectedSaida?.usaQuantidade ? qtdSaida : 1)

  // Saída totals
  const valorUnitSaida = selectedSaida
    ? selectedSaida.valorUnitario > 0
      ? selectedSaida.valorUnitario
      : parseFloat((valorManualSaida || '0').replace(',', '.'))
    : 0
  const totalSaida = selectedSaida?.usaQuantidade ? valorUnitSaida * qtdSaida : valorUnitSaida

  // Ativação derived
  const selectedActivationProduct = activationProducts.find((p) => p.id === activationProductId) ?? null
  const activationSalePrice = selectedActivationProduct && activationCusto !== null
    ? getSalePrice(selectedActivationProduct, activationCusto)
    : 0

  // Ativação balance (linked server)
  const activationServidor = selectedActivationProduct?.linkedServerId
    ? servidores.find((s) => s.id === selectedActivationProduct.linkedServerId)
    : null
  const activationCurrentBalance = activationServidor?.creditsBalance ?? 0
  const activationAfterBalance   = activationCurrentBalance - (activationCusto ?? 0)
  const activationInsufficient   =
    activationServidor !== null &&
    activationCusto !== null &&
    activationAfterBalance < 0

  // Monetary cost = credits quantity × cost-per-credit of linked server
  const activationCustoMonetario =
    activationCusto !== null && activationServidor
      ? activationCusto * activationServidor.custoUnitario
      : (activationCusto ?? 0)

  const activationLucro = activationSalePrice - activationCustoMonetario

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  // ── Load config on open ────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setServidores(getServidores())
      setPlanos(getPlanos())
      setSaidasRapidas(getSaidasRapidas())
      setActivationProducts(getActivationProducts())
    }
  }, [open])

  // ── Reset on open / transaction change ────────────────────────────────────

  useEffect(() => {
    if (transaction) {
      setDate(new Date(transaction.date + 'T00:00:00'))
      setType(transaction.type)
      setDescription(transaction.description)
      setAmount(transaction.amount.toFixed(2).replace('.', ','))
      setModo('manual')
    } else {
      setDate(new Date())
      setType('income')
      setDescription('')
      setAmount('')
      setModo('rapido')
      setServidorId('')
      setPlanoId('')
      setQtdEntrada(1)
      setQtdFracionada('1')
      setRegistrarCusto(false)
      setSaidaId('')
      setQtdSaida(1)
      setValorManualSaida('')
      setActivationProductId('')
      setActivationCusto(null)
      setRegistrarCustoAtivacao(false)
    }
  }, [transaction, open])

  useEffect(() => { setPlanoId('') }, [servidorId])

  useEffect(() => {
    setActivationCusto(null)
  }, [activationProductId])

  useEffect(() => {
    setQtdSaida(1)
    setValorManualSaida(
      selectedSaida && selectedSaida.valorUnitario > 0
        ? selectedSaida.valorUnitario.toFixed(2).replace('.', ',')
        : ''
    )
  }, [saidaId])

  // ── Validation ───────────���─────────────────────────────────────────────────

  const isEntradaRapidaValid =
    modo === 'rapido' && type === 'income' && selectedPlano !== null && qtdEfetiva > 0 && !insufficientCredits

  const isSaidaRapidaValid =
    modo === 'rapido' && type === 'expense' && selectedSaida !== null && totalSaida > 0

  const isAtivacaoValid =
    modo === 'ativacao' &&
    selectedActivationProduct !== null &&
    activationCusto !== null &&
    activationSalePrice > 0 &&
    !activationInsufficient

  const isManualValid =
    modo === 'manual' &&
    !!date &&
    description.trim().length > 0 &&
    parseFloat((amount || '0').replace(',', '.')) > 0

  const isValid = isEntradaRapidaValid || isSaidaRapidaValid || isAtivacaoValid || isManualValid

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!date || !isValid) return
    const dateStr = format(date, 'yyyy-MM-dd')
    const now = new Date().toISOString()

    // ── Entrada rápida (venda de plano) ──────────────────────────────────────
    if (isEntradaRapidaValid && selectedPlano) {
      const descricao =
        qtdEfetiva !== 1
          ? `${selectedPlano.descricao} (x${qtdEfetiva})`
          : selectedPlano.descricao

      const incomeId = generateId()
      const income: Transaction = {
        id: incomeId,
        date: dateStr,
        type: 'income',
        description: descricao,
        amount: totalVenda,
        createdAt: now,
        serverId: selectedPlano.servidorId,
        creditsDelta: -totalCreditos,
      }

      const updatedServidores = adjustCreditsBalance(selectedPlano.servidorId, -totalCreditos)
      setServidores(updatedServidores)
      onServidoresChange?.(updatedServidores)

      addCreditMovement({
        serverId: selectedPlano.servidorId,
        date: dateStr,
        type: 'sale',
        credits: totalCreditos,
        transactionId: incomeId,
      })

      if (registrarCusto && totalCusto > 0 && onSaveMultiple) {
        const expense: Transaction = {
          id: generateId(),
          date: dateStr,
          type: 'expense',
          description: `Custo — ${descricao}`,
          amount: totalCusto,
          createdAt: now,
        }
        onSaveMultiple([income, expense])
      } else {
        onSave(income)
      }
      onOpenChange(false)
      return
    }

    // ── Saída rápida ─────────────────────────────────────────────────────────
    if (isSaidaRapidaValid && selectedSaida) {
      const creditsQty = selectedSaida.usaQuantidade ? qtdSaida : 0
      const descricao =
        selectedSaida.descricaoPadrao ||
        (selectedSaida.usaQuantidade && qtdSaida > 1
          ? `${selectedSaida.nome} (x${qtdSaida})`
          : selectedSaida.nome)

      const expenseId = generateId()
      const expense: Transaction = {
        id: expenseId,
        date: dateStr,
        type: 'expense',
        description: descricao,
        amount: totalSaida,
        createdAt: now,
        serverId: selectedSaida.serverId,
        creditsDelta: selectedSaida.categoria === 'Servidor' ? creditsQty : undefined,
      }

      if (selectedSaida.categoria === 'Servidor' && selectedSaida.serverId && creditsQty > 0) {
        const updatedServidores = adjustCreditsBalance(selectedSaida.serverId, creditsQty)
        setServidores(updatedServidores)
        onServidoresChange?.(updatedServidores)

        addCreditMovement({
          serverId: selectedSaida.serverId,
          date: dateStr,
          type: 'purchase',
          credits: creditsQty,
          transactionId: expenseId,
        })
      }

      onSave(expense)
      onOpenChange(false)
      return
    }

    // ── Ativação ─────────────────────────────────────────────────────────────
    if (isAtivacaoValid && selectedActivationProduct && activationCusto !== null) {
      const incomeId = generateId()
      const descricao = `${selectedActivationProduct.nome} — custo ${activationCusto}`

      const income: Transaction = {
        id: incomeId,
        date: dateStr,
        type: 'income',
        description: descricao,
        amount: activationSalePrice,
        createdAt: now,
        serverId: selectedActivationProduct.linkedServerId,
        creditsDelta: selectedActivationProduct.linkedServerId ? -activationCusto : undefined,
      }

      // Consume balance from linked server (if configured)
      if (selectedActivationProduct.linkedServerId) {
        const updatedServidores = adjustCreditsBalance(
          selectedActivationProduct.linkedServerId,
          -activationCusto
        )
        setServidores(updatedServidores)
        onServidoresChange?.(updatedServidores)

        addCreditMovement({
          serverId: selectedActivationProduct.linkedServerId,
          date: dateStr,
          type: 'sale',
          credits: activationCusto,
          transactionId: incomeId,
        })
      }

      // Record the activation transaction for analytics
      addActivationTransaction({
        date: dateStr,
        productId: selectedActivationProduct.id,
        productNome: selectedActivationProduct.nome,
        custo: activationCustoMonetario,
        valorVenda: activationSalePrice,
        lucro: activationLucro,
        transactionId: incomeId,
      })

      if (registrarCustoAtivacao && activationCustoMonetario > 0 && onSaveMultiple) {
        const expense: Transaction = {
          id: generateId(),
          date: dateStr,
          type: 'expense',
          description: `Custo — ${descricao}`,
          amount: activationCustoMonetario,
          createdAt: now,
        }
        onSaveMultiple([income, expense])
      } else {
        onSave(income)
      }
      onOpenChange(false)
      return
    }

    // ── Manual ───────────────────────────────────────────────────────────────
    const numericAmount = parseFloat((amount || '0').replace(',', '.'))
    const tx: Transaction = {
      id: transaction?.id || generateId(),
      date: dateStr,
      type,
      description: description.trim(),
      amount: numericAmount,
      createdAt: transaction?.createdAt || now,
    }
    onSave(tx)
    onOpenChange(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? 'Atualize os detalhes da transação.'
              : 'Selecione um plano rápido ou preencha manualmente.'}
          </DialogDescription>
        </DialogHeader>

        {/* Date — always visible */}
        <div className="grid gap-2">
          <Label htmlFor="date">Data</Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date
                  ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : 'Selecione a data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { setDate(d); setCalendarOpen(false) }}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {!transaction ? (
          <Tabs value={modo} onValueChange={(v) => setModo(v as 'rapido' | 'ativacao' | 'manual')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="rapido">Lançamento Rápido</TabsTrigger>
              <TabsTrigger value="ativacao" className="gap-1">
                <Zap className="h-3.5 w-3.5" />
                Ativação
              </TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            {/* ── LANÇAMENTO RÁPIDO ── */}
            <TabsContent value="rapido" className="space-y-4 mt-4">

              {/* Tipo: Entrada / Saída */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={cn(
                    'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    type === 'income'
                      ? 'border-income bg-income/10 text-income'
                      : 'border-border text-muted-foreground hover:border-income/50'
                  )}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={cn(
                    'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    type === 'expense'
                      ? 'border-expense bg-expense/10 text-expense'
                      : 'border-border text-muted-foreground hover:border-expense/50'
                  )}
                >
                  Saída
                </button>
              </div>

              {/* ── Entrada rápida ── */}
              {type === 'income' && (
                <div className="space-y-3">
                  {/* Servidor */}
                  <div className="grid gap-2">
                    <Label>Servidor</Label>
                    <Select value={servidorId} onValueChange={setServidorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o servidor" />
                      </SelectTrigger>
                      <SelectContent>
                        {servidores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center justify-between gap-4">
                              <span>{s.nome}</span>
                              <span className={cn(
                                'text-xs tabular-nums',
                                (s.creditsBalance ?? 0) > 0 ? 'text-income' : 'text-muted-foreground'
                              )}>
                                {(s.creditsBalance ?? 0)} créditos
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Saldo do servidor */}
                  {servidorId && entradaServidor && (
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Saldo disponível em {entradaServidor.nome}:</span>
                      <span className={cn(
                        'text-sm font-semibold tabular-nums',
                        currentBalance > 0 ? 'text-income' : 'text-expense'
                      )}>
                        {currentBalance.toLocaleString('pt-BR')} créditos
                      </span>
                    </div>
                  )}

                  {/* Plano */}
                  {servidorId && (
                    <div className="grid gap-2">
                      <Label>Plano</Label>
                      <Select value={planoId} onValueChange={setPlanoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {planosRenovacao.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-income">Renovação</SelectLabel>
                              {planosRenovacao.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{p.codigo}</span>
                                    <span>{p.meses}m — {formatCurrency(p.valorVenda)}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {planosNovo.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-primary">Cliente Novo</SelectLabel>
                              {planosNovo.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{p.codigo}</span>
                                    <span>{p.meses}m — {formatCurrency(p.valorVenda)}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Quantidade */}
                  {selectedPlano && (
                    <div className="grid gap-2">
                      <Label>Quantidade</Label>
                      {permiteVendaFracionada ? (
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          placeholder="Ex: 0.5, 1, 1.5, 2"
                          value={qtdFracionada}
                          onChange={(e) => setQtdFracionada(e.target.value)}
                        />
                      ) : (
                        <Select
                          value={String(qtdEntrada)}
                          onValueChange={(v) => setQtdEntrada(Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QUANTIDADES.map((q) => (
                              <SelectItem key={q} value={String(q)}>
                                {q} {q === 1 ? 'unidade' : 'unidades'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Alerta créditos insuficientes */}
                  {selectedPlano && insufficientCredits && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                      <div className="text-sm text-destructive">
                        <p className="font-medium">Créditos insuficientes</p>
                        <p>
                          Disponível: <strong>{currentBalance}</strong> — Necessário:{' '}
                          <strong>{totalCreditos}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumo entrada */}
                  {selectedPlano && !insufficientCredits && (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor unitário:</span>
                        <span>{formatCurrency(selectedPlano.valorVenda)}</span>
                      </div>
                      {qtdEfetiva > 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Quantidade:</span>
                          <span>{qtdEfetiva}x</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Total venda:</span>
                        <span className="text-income">{formatCurrency(totalVenda)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo total:</span>
                        <span className="text-expense">{formatCurrency(totalCusto)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2 font-semibold">
                        <span className="text-muted-foreground">Lucro:</span>
                        <span className="text-income">{formatCurrency(totalLucro)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                        <span>Créditos usados:</span>
                        <span className="font-medium">
                          {totalCreditos} → saldo restante:{' '}
                          <span className={afterSaleBalance >= 0 ? 'text-income' : 'text-expense'}>
                            {afterSaleBalance}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Registrar custo */}
                  {selectedPlano && !insufficientCredits && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="registrar-custo"
                        checked={registrarCusto}
                        onCheckedChange={(v) => setRegistrarCusto(v === true)}
                      />
                      <label htmlFor="registrar-custo" className="text-sm leading-none">
                        Registrar custo automaticamente como saída
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* ── Saída rápida ── */}
              {type === 'expense' && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Categoria de Saída</Label>
                    <Select value={saidaId} onValueChange={setSaidaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {saidasRapidas.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span>{s.nome}</span>
                              <span className="text-xs text-muted-foreground">{s.categoria}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSaida && (
                    <>
                      <div className="grid gap-2">
                        <Label>
                          {selectedSaida.valorUnitario > 0 ? 'Valor unitário' : 'Valor (R$)'}
                        </Label>
                        {selectedSaida.valorUnitario > 0 ? (
                          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                            {formatCurrency(selectedSaida.valorUnitario)}
                          </div>
                        ) : (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              R$
                            </span>
                            <Input
                              className="pl-9"
                              placeholder="0,00"
                              value={valorManualSaida}
                              onChange={(e) =>
                                setValorManualSaida(e.target.value.replace(/[^\d,\.]/g, ''))
                              }
                            />
                          </div>
                        )}
                      </div>

                      {selectedSaida.usaQuantidade && (
                        <div className="grid gap-2">
                          <Label>Quantidade (créditos)</Label>
                          <Select
                            value={String(qtdSaida)}
                            onValueChange={(v) => setQtdSaida(Number(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {QUANTIDADES.map((q) => (
                                <SelectItem key={q} value={String(q)}>
                                  {q} {q === 1 ? 'crédito' : 'créditos'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedSaida.categoria === 'Servidor' && saidaServidor && (
                        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Saldo atual em {saidaServidor.nome}:</span>
                            <span className="font-medium">{saidaCurrentBalance} créditos</span>
                          </div>
                          {selectedSaida.usaQuantidade && qtdSaida > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Após esta compra:</span>
                              <span className="font-semibold text-income">
                                {afterPurchaseBalance} créditos
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {totalSaida > 0 && (
                        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                          {selectedSaida.usaQuantidade && (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Valor unitário:</span>
                                <span>{formatCurrency(valorUnitSaida)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Quantidade:</span>
                                <span>{qtdSaida}x</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between text-sm font-semibold border-t pt-2">
                            <span className="text-muted-foreground">Total saída:</span>
                            <span className="text-expense">{formatCurrency(totalSaida)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── ATIVAÇÃO ── */}
            <TabsContent value="ativacao" className="space-y-4 mt-4">
              {activationProducts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Zap className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Nenhuma ativação cadastrada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Acesse Configurações → Ativações para cadastrar produtos como ATIVA APP.
                  </p>
                </div>
              ) : (
                <>
                  {/* Produto */}
                  <div className="grid gap-2">
                    <Label>Produto</Label>
                    <Select value={activationProductId} onValueChange={setActivationProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {activationProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <span>{p.nome}</span>
                              <span className="text-xs text-muted-foreground">{p.validadeMeses} meses</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Saldo do servidor vinculado */}
                  {selectedActivationProduct?.linkedServerId && activationServidor && (
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        Saldo disponível em {activationServidor.nome}:
                      </span>
                      <span className={cn(
                        'text-sm font-semibold tabular-nums',
                        activationCurrentBalance > 0 ? 'text-income' : 'text-expense'
                      )}>
                        {activationCurrentBalance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} créditos
                      </span>
                    </div>
                  )}

                  {/* Custo */}
                  {selectedActivationProduct && (
                    <div className="grid gap-2">
                      <Label>Custo de ativação</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedActivationProduct.custosPermitidos.map((c) => {
                          const sp = getSalePrice(selectedActivationProduct, c)
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setActivationCusto(c)}
                              className={cn(
                                'flex flex-col items-center rounded-lg border px-3 py-2 text-center transition-colors min-w-[52px]',
                                activationCusto === c
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:border-primary/50 text-muted-foreground'
                              )}
                            >
                              <span className="text-sm font-semibold tabular-nums">{c}</span>
                              <span className="text-xs tabular-nums">{formatCurrency(sp)}</span>
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecione o custo — o preço de venda é calculado automaticamente pela faixa.
                      </p>
                    </div>
                  )}

                  {/* Alerta saldo insuficiente */}
                  {activationInsufficient && activationCusto !== null && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                      <div className="text-sm text-destructive">
                        <p className="font-medium">Saldo insuficiente</p>
                        <p>
                          Disponível:{' '}
                          <strong>{activationCurrentBalance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong>
                          {' '}— Necessário: <strong>{activationCusto}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumo */}
                  {selectedActivationProduct && activationCusto !== null && activationSalePrice > 0 && !activationInsufficient && (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Produto:</span>
                        <span className="font-medium">{selectedActivationProduct.nome}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Validade:</span>
                        <span>{selectedActivationProduct.validadeMeses} meses</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo selecionado:</span>
                        <span className="text-expense tabular-nums">
                          {activationCusto} crédito{activationServidor && ` × ${formatCurrency(activationServidor.custoUnitario)}`} = {formatCurrency(activationCustoMonetario)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Valor de venda:</span>
                        <span className="text-income">{formatCurrency(activationSalePrice)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2 font-semibold">
                        <span className="text-muted-foreground">Lucro:</span>
                        <span className={activationLucro >= 0 ? 'text-income' : 'text-expense'}>
                          {formatCurrency(activationLucro)}
                        </span>
                      </div>
                      {activationServidor && (
                        <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                          <span>Créditos usados:</span>
                          <span className="font-medium tabular-nums">
                            {activationCusto} → saldo restante:{' '}
                            <span className={activationAfterBalance >= 0 ? 'text-income' : 'text-expense'}>
                              {activationAfterBalance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checkbox registrar custo */}
                  {selectedActivationProduct && activationCusto !== null && activationSalePrice > 0 && !activationInsufficient && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="registrar-custo-ativacao"
                        checked={registrarCustoAtivacao}
                        onCheckedChange={(v) => setRegistrarCustoAtivacao(v === true)}
                      />
                      <label htmlFor="registrar-custo-ativacao" className="text-sm leading-none">
                        Registrar custo automaticamente como saída
                      </label>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── MANUAL ── */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'income' | 'expense')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-income" />
                        Entrada
                      </span>
                    </SelectItem>
                    <SelectItem value="expense">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-expense" />
                        Saída
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Salário, Aluguel, Mercado..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <Input
                    className="pl-9"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d,\.]/g, ''))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          /* Edit mode — manual only */
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'income' | 'expense')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-income" />
                      Entrada
                    </span>
                  </SelectItem>
                  <SelectItem value="expense">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-expense" />
                      Saída
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  className="pl-9"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d,\.]/g, ''))}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {transaction ? 'Salvar Alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
