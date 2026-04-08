'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Zap, Check, X, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { format } from 'date-fns'
import type { PlanoEntrada, Servidor, Transaction } from '@/lib/types'
import { generateId } from '@/lib/storage'

interface QuickEntryProps {
  planos: PlanoEntrada[]
  servidores: Servidor[]
  onSave: (transaction: Transaction) => Promise<void>
  onSaveMultiple?: (transactions: Transaction[]) => void
  onAdjustCredits?: (serverId: string, delta: number) => Promise<boolean>
}

interface EntryLog {
  id: string
  codigo: string
  descricao: string
  servidor: string
  valor: number
  creditos: number
  timestamp: string
}

export function QuickEntry({ planos, servidores, onSave, onAdjustCredits }: QuickEntryProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [codigoInput, setCodigoInput] = useState('')
  const [valorOverride, setValorOverride] = useState('')
  const [matchedPlano, setMatchedPlano] = useState<PlanoEntrada | null>(null)
  const [suggestions, setSuggestions] = useState<PlanoEntrada[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recentLogs, setRecentLogs] = useState<EntryLog[]>([])
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const getServidor = useCallback((id: string) => servidores.find(s => s.id === id), [servidores])

  const getServidorUnitCost = useCallback((servidorId: string) => {
    const servidor = servidores.find(s => s.id === servidorId)
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
  }, [servidores])

  // Search planos by code as user types
  useEffect(() => {
    const q = codigoInput.trim().toUpperCase()
    if (q.length === 0) {
      setSuggestions([])
      setMatchedPlano(null)
      setShowSuggestions(false)
      return
    }

    const matches = planos.filter(p =>
      p.codigo.toUpperCase().startsWith(q) ||
      p.descricao.toUpperCase().includes(q)
    )
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0 && !matchedPlano)

    // Exact match
    const exact = planos.find(p => p.codigo.toUpperCase() === q)
    if (exact) {
      setMatchedPlano(exact)
      setValorOverride(exact.valorVenda.toFixed(2).replace('.', ','))
      setShowSuggestions(false)
    } else if (matchedPlano && matchedPlano.codigo.toUpperCase() !== q) {
      setMatchedPlano(null)
      setValorOverride('')
    }
  }, [codigoInput, planos, matchedPlano])

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectPlano = (plano: PlanoEntrada) => {
    setMatchedPlano(plano)
    setCodigoInput(plano.codigo)
    setValorOverride(plano.valorVenda.toFixed(2).replace('.', ','))
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const valorFinal = valorOverride
    ? parseFloat(valorOverride.replace(',', '.')) || 0
    : matchedPlano?.valorVenda ?? 0

  const servidor = matchedPlano ? getServidor(matchedPlano.servidorId) : null
  const saldoAtual = servidor?.creditsBalance ?? 0
  const creditosUsados = matchedPlano?.creditos ?? 0
  const saldoRestante = saldoAtual - creditosUsados
  const unitCost = matchedPlano ? getServidorUnitCost(matchedPlano.servidorId) : 0
  const custoTotal = Number((unitCost * creditosUsados).toFixed(2))
  const lucro = valorFinal - custoTotal
  const canSave = matchedPlano && valorFinal > 0 && saldoRestante >= 0

  const handleConfirm = async () => {
    if (!matchedPlano || !canSave) return
    setSaving(true)
    setFeedbackMsg('')

    try {
      const now = new Date().toISOString()

      const tx: Transaction = {
        id: generateId(),
        date: selectedDate,
        type: 'income',
        description: matchedPlano.descricao,
        amount: valorFinal,
        createdAt: now,
        serverId: matchedPlano.servidorId,
        creditsDelta: -creditosUsados,

        // SNAPSHOT FINANCEIRO
        unitCostSnapshot: unitCost,
        costSnapshot: custoTotal,
        profitSnapshot: lucro,
      }

      if (onAdjustCredits) {
        await onAdjustCredits(matchedPlano.servidorId, -creditosUsados)
      }

      await onSave(tx)

      // Log
      setRecentLogs(prev => [{
        id: tx.id,
        codigo: matchedPlano.codigo,
        descricao: matchedPlano.descricao,
        servidor: servidor?.nome ?? '',
        valor: valorFinal,
        creditos: creditosUsados,
        timestamp: format(new Date(), 'HH:mm:ss'),
      }, ...prev].slice(0, 10))

      setFeedbackMsg(`${matchedPlano.codigo} — ${formatCurrency(valorFinal)}`)

      // Reset for next entry
      setCodigoInput('')
      setMatchedPlano(null)
      setValorOverride('')
      setSuggestions([])

      setTimeout(() => {
        inputRef.current?.focus()
        setFeedbackMsg('')
      }, 1500)
    } catch {
      setFeedbackMsg('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSave) {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === 'Escape') {
      setCodigoInput('')
      setMatchedPlano(null)
      setValorOverride('')
      setShowSuggestions(false)
    }
  }

  const handleClear = () => {
    setCodigoInput('')
    setMatchedPlano(null)
    setValorOverride('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  if (!expanded) {
    return (
      <button
        onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 100) }}
        className="w-full flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 sm:px-4 py-2.5 sm:py-3 text-sm transition-colors hover:bg-primary/10 hover:border-primary/50"
        data-testid="quick-entry-toggle"
      >
        <span className="flex items-center gap-2 text-primary font-medium">
          <Zap className="h-4 w-4" />
          Lançamento Express
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">Digite o código do plano e confirme com Enter</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card" data-testid="quick-entry-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/50">
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Zap className="h-4 w-4" />
          Lançamento Express
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border border-border/50 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus:text-foreground focus:border-primary/50 outline-none transition-colors w-[120px]"
              data-testid="quick-entry-date"
            />
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Input area */}
      <div className="px-3 sm:px-4 py-3 space-y-3">
        {/* Code input row */}
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none sm:w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Código</label>
            <Input
              ref={inputRef}
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0 && !matchedPlano) setShowSuggestions(true) }}
              placeholder="Ex: RMC"
              className={cn(
                'font-mono uppercase',
                matchedPlano ? 'border-emerald-500/50 bg-emerald-500/5' : ''
              )}
              autoComplete="off"
              disabled={saving}
              data-testid="quick-entry-code"
            />
            {codigoInput && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-[calc(50%+8px)] -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 top-full left-0 mt-1 w-[calc(100vw-2rem)] sm:w-[350px] max-h-[200px] overflow-y-auto rounded-md border bg-popover shadow-lg"
              >
                {suggestions.map(p => {
                  const srv = getServidor(p.servidorId)
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPlano(p)}
                      className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded font-medium shrink-0">
                        {p.codigo}
                      </span>
                      <span className="truncate text-muted-foreground text-xs sm:text-sm">{p.descricao}</span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{srv?.nome}</span>
                      <span className="text-xs font-medium shrink-0">{formatCurrency(p.valorVenda)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mobile: show confirm button next to code when matched */}
          {matchedPlano && servidor && (
            <div className="sm:hidden shrink-0">
              <label className="text-xs text-muted-foreground mb-1 block opacity-0">.</label>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!canSave || saving}
                className="h-9 px-3"
                data-testid="quick-entry-confirm-mobile"
              >
                {saving ? '...' : <Check className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Matched plan details */}
        {matchedPlano && servidor && (
          <>
            {/* Desktop: single row */}
            <div className="hidden sm:flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Plano</label>
                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm truncate">
                  {matchedPlano.descricao}
                </div>
              </div>

              <div className="shrink-0">
                <label className="text-xs text-muted-foreground mb-1 block">Servidor</label>
                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm">
                  <span>{servidor.nome}</span>
                  <span className={cn(
                    'ml-2 text-xs tabular-nums',
                    saldoAtual > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {saldoAtual}cr
                  </span>
                </div>
              </div>

              <div className="shrink-0 w-[120px]">
                <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                  <Input
                    className="pl-8 font-mono text-sm"
                    value={valorOverride}
                    onChange={(e) => setValorOverride(e.target.value.replace(/[^\d,\.]/g, ''))}
                    onKeyDown={handleKeyDown}
                    disabled={saving}
                    data-testid="quick-entry-value"
                  />
                </div>
              </div>

              <div className="shrink-0">
                <label className="text-xs text-muted-foreground mb-1 block">Lucro</label>
                <div className={cn(
                  'h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-medium tabular-nums min-w-[90px]',
                  lucro >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {formatCurrency(lucro)}
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!canSave || saving}
                className="h-9 px-4 shrink-0"
                data-testid="quick-entry-confirm"
              >
                {saving ? '...' : <><Check className="h-4 w-4 mr-1" /> Lançar</>}
              </Button>
            </div>

            {/* Mobile: stacked grid */}
            <div className="sm:hidden space-y-2">
              <div className="text-xs text-muted-foreground truncate">
                {matchedPlano.descricao} — <span className="font-medium text-foreground">{servidor.nome}</span>
                <span className={cn('ml-1 tabular-nums', saldoAtual > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  ({saldoAtual}cr)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                    <Input
                      className="pl-8 font-mono text-sm"
                      value={valorOverride}
                      onChange={(e) => setValorOverride(e.target.value.replace(/[^\d,\.]/g, ''))}
                      onKeyDown={handleKeyDown}
                      disabled={saving}
                      data-testid="quick-entry-value-mobile"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Lucro</label>
                  <div className={cn(
                    'h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-medium tabular-nums',
                    lucro >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {formatCurrency(lucro)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Warnings and feedback below the input area */}
        {/* Insufficient credits warning */}
        {matchedPlano && saldoRestante < 0 && (
          <div className="text-xs text-red-400">
            Créditos insuficientes — necessário: {creditosUsados}, disponível: {saldoAtual}
          </div>
        )}

        {/* Value override notice */}
        {matchedPlano && valorFinal !== matchedPlano.valorVenda && valorFinal > 0 && (
          <div className="text-xs text-amber-500">
            Valor original: {formatCurrency(matchedPlano.valorVenda)} — lançando por {formatCurrency(valorFinal)}
          </div>
        )}

        {/* Success feedback */}
        {feedbackMsg && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 animate-pulse">
            <Check className="h-3.5 w-3.5" />
            Lançado: {feedbackMsg}
          </div>
        )}

        {/* Recent entries log */}
        {recentLogs.length > 0 && (
          <div className="border-t border-border/50 pt-2 mt-2">
            <span className="text-xs text-muted-foreground">Últimos lançamentos:</span>
            <div className="mt-1 space-y-0.5">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums w-14 shrink-0">{log.timestamp}</span>
                  <span className="font-mono bg-muted/50 px-1 py-0.5 rounded">{log.codigo}</span>
                  <span className="truncate">{log.descricao}</span>
                  <span className="ml-auto shrink-0 text-emerald-400 font-medium tabular-nums">{formatCurrency(log.valor)}</span>
                  <span className="shrink-0 text-muted-foreground/60">-{log.creditos}cr</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}