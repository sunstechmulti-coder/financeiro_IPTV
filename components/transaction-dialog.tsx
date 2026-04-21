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
import type { Transaction, ActivationProduct, Servidor, PlanoEntrada, SaidaRapida, RevendaGrupo } from '@/lib/types'
import { generateId } from '@/lib/storage'
import { getSalePrice } from '@/lib/activation-storage'

const QUANTIDADES = [1, 2, 3, 5, 10, 20, 30, 50, 100]

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (transaction: Transaction) => void
  onSaveMultiple?: (transactions: Transaction[]) => void
  onAdjustCredits?: (serverId: string, delta: number) => Promise<boolean>
  transaction?: Transaction | null
  servidores: Servidor[]
  planos: PlanoEntrada[]
  saidasRapidas: SaidaRapida[]
  activationProducts: ActivationProduct[]
  revendaGrupos?: RevendaGrupo[]
}

export function TransactionDialog({
  open,
  onOpenChange,
  onSave,
  onSaveMultiple,
  onAdjustCredits,
  transaction,
  servidores,
  planos,
  saidasRapidas,
  activationProducts,
  revendaGrupos = [],
}: TransactionDialogProps) {

  // Common fields
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [modo, setModo] = useState<'rapido' | 'ativacao' | 'revenda' | 'manual'>('rapido')

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
  const [valorVendaOverride, setValorVendaOverride] = useState('')

  // Saída rápida
  const [saidaId, setSaidaId] = useState('')
  const [qtdSaida, setQtdSaida] = useState(1)
  const [valorManualSaida, setValorManualSaida] = useState('')

  // Ativação
  const [activationProductId, setActivationProductId] = useState('')
  const [activationCusto, setActivationCusto] = useState<number | null>(null)
  const [activationValorVendaOverride, setActivationValorVendaOverride] = useState('')
  const [registrarCustoAtivacao, setRegistrarCustoAtivacao] = useState(false)

  // Revenda de créditos
  const [revendaServidorId, setRevendaServidorId] = useState('')
  const [revendaQtd, setRevendaQtd] = useState('')
  const [revendaValorOverride, setRevendaValorOverride] = useState('')

  // ── Pricing from Supabase ───────────────────────────────────────────────────

  const revendaServidor = servidores.find(s => s.id === revendaServidorId)
  const revendaQtdNum = parseFloat(revendaQtd.replace(',', '.')) || 0

  const getRevendaGroupForServer = (serverId: string): RevendaGrupo | null => {
    return revendaGrupos.find(g => g.servidorIds.includes(serverId)) ?? null
  }

  const getRevendaPricePerCredit = (serverId: string, qty: number): number => {
    const group = getRevendaGroupForServer(serverId)
    if (!group) return 0
    const tier = group.faixas.find(t => qty >= t.min && qty <= t.max)
    if (tier) return tier.preco
    const lastTier = group.faixas[group.faixas.length - 1]
    if (lastTier && qty > lastTier.max) return lastTier.preco
    return 0
  }

  const revendaPricePerCredit = revendaServidor
    ? getRevendaPricePerCredit(revendaServidor.id, revendaQtdNum)
    : 0

  const revendaValorCalculado = revendaPricePerCredit * revendaQtdNum
  const revendaValorFinal = revendaValorOverride
    ? (parseFloat(revendaValorOverride.replace(',', '.')) || 0)
    : revendaValorCalculado
  const revendaSaldoAtual = revendaServidor?.creditsBalance ?? 0
  const revendaSaldoRestante = revendaSaldoAtual - revendaQtdNum
  const revendaInsuficiente = revendaQtdNum > 0 && revendaSaldoRestante < 0
  const revendaGroupInfo = revendaServidor ? getRevendaGroupForServer(revendaServidor.id) : null

  // ── Derived ──────────────────────────────────────────────────────────────────

  const planosDoServidor = planos.filter((p) => p.servidorId === servidorId)
  const planosRenovacao = planosDoServidor
    .filter((p) => p.tipo === 'renovacao')
    .sort((a, b) => a.meses - b.meses)

  const planosNovo = planosDoServidor
    .filter((p) => p.tipo === 'novo')
    .sort((a, b) => a.meses - b.meses)

  const selectedPlano = planos.find((p) => p.id === planoId) ?? null
  const selectedSaida = saidasRapidas.find((s) => s.id === saidaId) ?? null

  const getServidorUnitCost = (servidorId: string) => {
    const servidor = servidores.find((s) => s.id === servidorId)
    if (!servidor) return 0

    const raw = servidor as unknown as Record<string, unknown>
    const value =
      raw.unit_cost ??
      raw.unitCost ??
      raw.custo_unitario ??
      raw.custoUnitario ??
      raw.custo ??
      raw.custoUnitarioCredito ??
      0

    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
  }

  const getServidorQtdRecarga = (servidorId: string) => {
    const servidor = servidores.find((s) => s.id === servidorId)
    if (!servidor) return 1

    const raw = servidor as unknown as Record<string, unknown>
    const value =
      raw.rechargeQuantity ??
      raw.recharge_quantity ??
      raw.qtdRecarga ??
      raw.qtd_recarga ??
      raw.quantidadeRecarga ??
      raw.quantidade_recarga ??
      raw.rechargeQty ??
      raw.recharge_qty ??
      raw.quickRechargeQty ??
      raw.quick_recharge_qty ??
      1

    const numericValue = Number(value)
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1
  }

  // Fractional quantity support
  const entradaServidor = servidores.find((s) => s.id === servidorId)
  const permiteVendaFracionada = entradaServidor?.permiteVendaFracionada ?? false
  const qtdEfetiva = permiteVendaFracionada
    ? (parseFloat(qtdFracionada.replace(',', '.')) || 0)
    : qtdEntrada

  // Entrada totals
  const valorVendaUnitario = valorVendaOverride
    ? (parseFloat(valorVendaOverride.replace(',', '.')) || 0)
    : (selectedPlano?.valorVenda ?? 0)
  const totalVenda = valorVendaUnitario * qtdEfetiva
  const totalCreditos = selectedPlano ? selectedPlano.creditos * qtdEfetiva : 0
  const custoUnitarioAtual = selectedPlano ? getServidorUnitCost(selectedPlano.servidorId) : 0
  const totalCusto = Number((custoUnitarioAtual * totalCreditos).toFixed(2))
  const totalLucro = totalVenda - totalCusto

  // Credit balance checks — entry (selling a plan)
  const currentBalance = entradaServidor?.creditsBalance ?? 0
  const afterSaleBalance = currentBalance - totalCreditos
  const insufficientCredits = selectedPlano !== null && totalCreditos > 0 && afterSaleBalance < 0

  // Credit balance checks — expense (buying credits)
  const saidaServidor = selectedSaida?.serverId ? servidores.find((s) => s.id === selectedSaida.serverId) : null
  const saidaCurrentBalance = saidaServidor?.creditsBalance ?? 0
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
  const activationSalePriceBase = selectedActivationProduct && activationCusto !== null
    ? getSalePrice(selectedActivationProduct, activationCusto)
    : 0
  const activationSalePrice = activationValorVendaOverride
    ? (parseFloat(activationValorVendaOverride.replace(',', '.')) || 0)
    : activationSalePriceBase

  // Ativação balance (linked server)
  const activationServidor = selectedActivationProduct?.linkedServerId
    ? servidores.find((s) => s.id === selectedActivationProduct.linkedServerId)
    : null
  const activationCurrentBalance = activationServidor?.creditsBalance ?? 0
  const activationAfterBalance = activationCurrentBalance - (activationCusto ?? 0)
  const activationInsufficient =
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

  // ── Reset on open / transaction change ────────────────────────────────────

  useEffect(() => {
    if (transaction) {
      setDate(new Date(transaction.date + 'T00:00:00'))
      setType(transaction.type)
      setDescription(transaction.description)
      setAmount(transaction.amount.toFixed(2).replace('.', ','))
      setModo('manual')
    } else {
      setType('income')
      setDescription('')
      setAmount('')
      setModo('rapido')
      setServidorId('')
      setPlanoId('')
      setQtdEntrada(1)
      setQtdFracionada('1')
      setRegistrarCusto(false)
      setValorVendaOverride('')
      setSaidaId('')
      setQtdSaida(1)
      setValorManualSaida('')
      setActivationProductId('')
      setActivationCusto(null)
      setActivationValorVendaOverride('')
      setRegistrarCustoAtivacao(false)
      setRevendaServidorId('')
      setRevendaQtd('')
      setRevendaValorOverride('')
    }
  }, [transaction, open])

  useEffect(() => { setPlanoId(''); setValorVendaOverride('') }, [servidorId])

  useEffect(() => {
    if (selectedPlano) {
      setValorVendaOverride(selectedPlano.valorVenda.toFixed(2).replace('.', ','))
    } else {
      setValorVendaOverride('')
    }
  }, [planoId])

  useEffect(() => {
    setActivationCusto(null)
    setActivationValorVendaOverride('')
  }, [activationProductId])

  useEffect(() => {
    if (selectedActivationProduct && activationCusto !== null) {
      const suggestedPrice = getSalePrice(selectedActivationProduct, activationCusto)
      setActivationValorVendaOverride(suggestedPrice.toFixed(2).replace('.', ','))
    } else {
      setActivationValorVendaOverride('')
    }
  }, [selectedActivationProduct, activationCusto])

  useEffect(() => {
    setRevendaQtd('')
    setRevendaValorOverride('')
  }, [revendaServidorId])

  useEffect(() => {
    if (revendaValorCalculado > 0) {
      setRevendaValorOverride(revendaValorCalculado.toFixed(2).replace('.', ','))
    } else {
      setRevendaValorOverride('')
    }
  }, [revendaQtdNum, revendaPricePerCredit])

  useEffect(() => {
    const defaultQty =
      selectedSaida?.usaQuantidade &&
        selectedSaida.categoria === 'Servidor' &&
        selectedSaida.serverId
        ? getServidorQtdRecarga(selectedSaida.serverId)
        : 1

    setQtdSaida(defaultQty)
    setValorManualSaida(
      selectedSaida && selectedSaida.valorUnitario > 0
        ? selectedSaida.valorUnitario.toFixed(2).replace('.', ',')
        : ''
    )
  }, [selectedSaida, servidores])

  // ── Validation ─────────────────────────────────────────────────────────────

  const isEntradaRapidaValid =
    modo === 'rapido' && type === 'income' && selectedPlano !== null && qtdEfetiva > 0 && valorVendaUnitario > 0 && !insufficientCredits

  const isSaidaRapidaValid =
    modo === 'rapido' && type === 'expense' && selectedSaida !== null && totalSaida > 0

  const isAtivacaoValid =
    modo === 'ativacao' &&
    selectedActivationProduct !== null &&
    activationCusto !== null &&
    activationSalePrice > 0 &&
    !activationInsufficient

  const isRevendaValid =
    modo === 'revenda' && revendaServidor && revendaQtdNum >= 10 && revendaValorFinal > 0 && !revendaInsuficiente

  const isManualValid =
    modo === 'manual' &&
    !!date &&
    description.trim().length > 0 &&
    parseFloat((amount || '0').replace(',', '.')) > 0

  const isValid = isEntradaRapidaValid || isSaidaRapidaValid || isAtivacaoValid || isRevendaValid || isManualValid

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
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

        // SNAPSHOT FINANCEIRO
        unitCostSnapshot: custoUnitarioAtual,
        costSnapshot: totalCusto,
        profitSnapshot: totalLucro,
      }

      if (onAdjustCredits) {
        await onAdjustCredits(selectedPlano.servidorId, -totalCreditos)
      }

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

    // ── Revenda de créditos ──────────────────────────────────────────────────
    if (isRevendaValid && revendaServidor) {
      const descricao = `Revenda ${revendaQtdNum} créditos — ${revendaServidor.nome}`

      const income: Transaction = {
        id: generateId(),
        date: dateStr,
        type: 'income',
        description: descricao,
        amount: revendaValorFinal,
        createdAt: now,
        serverId: revendaServidorId,
        creditsDelta: -revendaQtdNum,
      }

      if (onAdjustCredits) {
        await onAdjustCredits(revendaServidorId, -revendaQtdNum)
      }

      onSave(income)
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

      if (selectedSaida.categoria === 'Servidor' && selectedSaida.serverId && creditsQty > 0 && onAdjustCredits) {
        await onAdjustCredits(selectedSaida.serverId, creditsQty)
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

      if (selectedActivationProduct.linkedServerId && onAdjustCredits) {
        await onAdjustCredits(selectedActivationProduct.linkedServerId, -activationCusto)
      }

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
          <Tabs value={modo} onValueChange={(v) => setModo(v as 'rapido' | 'ativacao' | 'revenda' | 'manual')}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="rapido">Rápido</TabsTrigger>
              <TabsTrigger value="ativacao" className="gap-1">
                <Zap className="h-3.5 w-3.5" />
                Ativação
              </TabsTrigger>
              <TabsTrigger value="revenda">Revenda</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="rapido" className="space-y-4 mt-4">
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

              {type === 'income' && (
                <div className="space-y-3">
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

                  {selectedPlano && (
                    <div className="grid gap-2">
                      <Label>Valor de venda (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          R$
                        </span>
                        <Input
                          className="pl-9"
                          value={valorVendaOverride}
                          onChange={(e) => setValorVendaOverride(e.target.value.replace(/[^\d,\.]/g, ''))}
                          data-testid="valor-venda-override"
                        />
                      </div>
                      {valorVendaUnitario !== selectedPlano.valorVenda && (
                        <p className="text-xs text-amber-500">
                          Valor original do plano: {formatCurrency(selectedPlano.valorVenda)}
                        </p>
                      )}
                    </div>
                  )}

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

                  {selectedPlano && !insufficientCredits && (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor unitário:</span>
                        <span>{formatCurrency(valorVendaUnitario)}</span>
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
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={qtdSaida === 0 ? '' : String(qtdSaida)}
                            onChange={(e) => setQtdSaida(Number(e.target.value) || 0)}
                          />
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

                  {selectedActivationProduct && activationCusto !== null && (
                    <div className="grid gap-2">
                      <Label>Valor de venda (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          R$
                        </span>
                        <Input
                          className="pl-9"
                          value={activationValorVendaOverride}
                          onChange={(e) => setActivationValorVendaOverride(e.target.value.replace(/[^\d,\.]/g, ''))}
                          data-testid="activation-sale-price-override"
                        />
                      </div>
                      {activationSalePrice !== activationSalePriceBase && activationSalePriceBase > 0 && (
                        <p className="text-xs text-amber-500">
                          Valor original da faixa: {formatCurrency(activationSalePriceBase)}
                        </p>
                      )}
                    </div>
                  )}

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

            <TabsContent value="revenda" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Servidor</Label>
                <Select value={revendaServidorId} onValueChange={setRevendaServidorId}>
                  <SelectTrigger data-testid="revenda-server-select">
                    <SelectValue placeholder="Selecione o servidor" />
                  </SelectTrigger>
                  <SelectContent>
                    {servidores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} — {s.creditsBalance ?? 0} créditos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {revendaServidor && revendaGroupInfo && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Tabela de preços — {revendaServidor.nome}</span>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {revendaGroupInfo.faixas.map((t) => (
                      <div key={t.min} className={cn(
                        'rounded px-1.5 py-1 text-xs border',
                        revendaQtdNum >= t.min && revendaQtdNum <= t.max
                          ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                          : 'border-transparent text-muted-foreground'
                      )}>
                        <div className="font-mono">{t.min}-{t.max}</div>
                        <div className="font-medium">R${t.preco.toFixed(2).replace('.', ',')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {revendaServidor && !revendaGroupInfo && (
                <div className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertCircle className="h-4 w-4" />
                  Servidor sem tabela de revenda configurada.
                </div>
              )}

              {revendaServidor && revendaGroupInfo && (
                <>
                  <div className="grid gap-2">
                    <Label>Quantidade de créditos</Label>
                    <Input
                      type="number"
                      min={10}
                      step={1}
                      placeholder="Mínimo 10 créditos"
                      value={revendaQtd}
                      onChange={(e) => setRevendaQtd(e.target.value)}
                      data-testid="revenda-qty"
                    />
                    {revendaQtdNum > 0 && revendaQtdNum < 10 && (
                      <p className="text-xs text-amber-500">Mínimo de 10 créditos</p>
                    )}
                  </div>

                  {revendaQtdNum >= 10 && (
                    <div className="grid gap-2">
                      <Label>Valor total (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <Input
                          className="pl-9"
                          value={revendaValorOverride}
                          onChange={(e) => setRevendaValorOverride(e.target.value.replace(/[^\d,\.]/g, ''))}
                          data-testid="revenda-value"
                        />
                      </div>
                      {revendaValorFinal !== revendaValorCalculado && revendaValorFinal > 0 && (
                        <p className="text-xs text-amber-500">
                          Valor calculado: {formatCurrency(revendaValorCalculado)} ({formatCurrency(revendaPricePerCredit)}/cr)
                        </p>
                      )}
                    </div>
                  )}

                  {revendaInsuficiente && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Créditos insuficientes — disponível: {revendaSaldoAtual}, necessário: {revendaQtdNum}
                    </div>
                  )}

                  {revendaQtdNum >= 10 && revendaValorFinal > 0 && !revendaInsuficiente && (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Créditos vendidos:</span>
                        <span>{revendaQtdNum}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Preço/crédito:</span>
                        <span>{formatCurrency(revendaValorFinal / revendaQtdNum)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Total entrada:</span>
                        <span className="text-income">{formatCurrency(revendaValorFinal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Saldo após:</span>
                        <span className="tabular-nums">{revendaSaldoRestante} créditos</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

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