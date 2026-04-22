'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PlanoEntrada, Servidor } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface PlanosListProps {
  planos: PlanoEntrada[]
  servidores: Servidor[]
  onAdd: (plano: Omit<PlanoEntrada, 'id'>) => Promise<PlanoEntrada | null>
  onUpdate: (plano: PlanoEntrada) => Promise<PlanoEntrada | null>
  onDelete: (id: string) => Promise<boolean>
}

const EMPTY_FORM = {
  codigo: '',
  descricao: '',
  servidorId: '',
  tipo: 'renovacao' as const,
  meses: 1,
  creditos: 1,
  valorVenda: 0,
  custo: 0,
}

type DialogMode = 'create' | 'edit' | 'duplicate'

function parseLocalizedNumber(value: string) {
  const normalized = value
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')

  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') {
    return 0
  }

  const firstDotIndex = normalized.indexOf('.')
  const safe =
    firstDotIndex === -1
      ? normalized
      : normalized.slice(0, firstDotIndex + 1) +
      normalized.slice(firstDotIndex + 1).replace(/\./g, '')

  const parsed = Number(safe)
  return Number.isFinite(parsed) ? parsed : 0
}

function sanitizeNumericInput(value: string, allowDecimal: boolean) {
  let sanitized = value.replace(/\./g, ',').replace(/[^\d,-]/g, '')

  if (!allowDecimal) {
    return sanitized.replace(/[,-]/g, '')
  }

  const negative = sanitized.startsWith('-') ? '-' : ''
  sanitized = sanitized.replace(/-/g, '')

  const parts = sanitized.split(',')
  const integerPart = parts[0] ?? ''
  const decimalPart = parts.slice(1).join('')

  return negative + integerPart + (parts.length > 1 ? `,${decimalPart}` : '')
}

function formatInputValue(value: number, emptyWhenZero = false) {
  if (!Number.isFinite(value)) return ''
  if (emptyWhenZero && value === 0) return ''
  return String(value).replace('.', ',')
}

export function PlanosList({ planos, servidores, onAdd, onUpdate, onDelete }: PlanosListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlano, setEditingPlano] = useState<PlanoEntrada | null>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>('create')
  const [form, setForm] = useState(EMPTY_FORM)
  const [creditosInput, setCreditosInput] = useState(formatInputValue(EMPTY_FORM.creditos))
  const [valorVendaInput, setValorVendaInput] = useState(formatInputValue(EMPTY_FORM.valorVenda, true))
  const [filtroServidor, setFiltroServidor] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const getServidorNome = (id: string) => servidores.find(s => s.id === id)?.nome ?? '—'

  const getServidorUnitCost = (servidorId: string) => {
    const servidor = servidores.find(s => s.id === servidorId)
    if (!servidor) return 0

    const raw = servidor as unknown as Record<string, unknown>
    const value =
      raw.unit_cost ??
      raw.unitCost ??
      raw.custo_unitario ??
      raw.custoUnitario ??
      raw.custo ??
      0

    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
  }

  const getServidorPermiteFracionado = (servidorId: string) => {
    const servidor = servidores.find(s => s.id === servidorId)
    if (!servidor) return false

    const raw = servidor as unknown as Record<string, unknown>

    return Boolean(
      raw.permiteVendaFracionada ??
      raw.permite_venda_fracionada ??
      raw.allowFractionalCredits ??
      raw.allow_fractional_credits ??
      false
    )
  }

  const getPlanoCustoAtual = (plano: PlanoEntrada) => {
    return Number((getServidorUnitCost(plano.servidorId) * Number(plano.creditos || 0)).toFixed(2))
  }

  const getPlanoLucroAtual = (plano: PlanoEntrada) => {
    return Number(plano.valorVenda || 0) - getPlanoCustoAtual(plano)
  }

  const lucroCalculado = Number(form.valorVenda || 0) - Number(form.custo || 0)
  const permiteCreditoFracionado = getServidorPermiteFracionado(form.servidorId)

  const codigoEmUso = useMemo(() => {
    const codigo = form.codigo.trim().toLowerCase()
    if (!codigo) return false

    return planos.some(plano => {
      const mesmoCodigo = plano.codigo.trim().toLowerCase() === codigo

      if (!mesmoCodigo) return false

      if (dialogMode === 'edit' && editingPlano) {
        return plano.id !== editingPlano.id
      }

      return true
    })
  }, [form.codigo, planos, dialogMode, editingPlano])

  useEffect(() => {
    setForm(prev => {
      const creditosNormalizados = permiteCreditoFracionado
        ? Number(prev.creditos || 0)
        : Math.trunc(Number(prev.creditos || 0))

      const unitCost = prev.servidorId ? getServidorUnitCost(prev.servidorId) : 0
      const novoCusto = Number((unitCost * creditosNormalizados).toFixed(2))

      const precisaAtualizarCreditos = prev.creditos !== creditosNormalizados
      const precisaAtualizarCusto = prev.custo !== novoCusto

      if (!precisaAtualizarCreditos && !precisaAtualizarCusto) return prev

      return {
        ...prev,
        creditos: creditosNormalizados,
        custo: novoCusto,
      }
    })
  }, [form.servidorId, form.creditos, servidores, permiteCreditoFracionado])

  useEffect(() => {
    setCreditosInput(formatInputValue(form.creditos))
  }, [form.creditos])

  const handleOpen = (plano?: PlanoEntrada, mode: DialogMode = 'create') => {
    setDialogMode(mode)

    if (plano && mode === 'edit') {
      const custo = Number((getServidorUnitCost(plano.servidorId) * Number(plano.creditos || 0)).toFixed(2))
      setEditingPlano(plano)
      setForm({
        codigo: plano.codigo,
        descricao: plano.descricao,
        servidorId: plano.servidorId,
        tipo: plano.tipo,
        meses: plano.meses,
        creditos: plano.creditos,
        valorVenda: plano.valorVenda,
        custo,
      })
      setCreditosInput(formatInputValue(plano.creditos))
      setValorVendaInput(formatInputValue(plano.valorVenda, true))
    } else if (plano && mode === 'duplicate') {
      const custo = Number((getServidorUnitCost(plano.servidorId) * Number(plano.creditos || 0)).toFixed(2))
      setEditingPlano(null)
      setForm({
        codigo: '',
        descricao: plano.descricao,
        servidorId: plano.servidorId,
        tipo: plano.tipo,
        meses: plano.meses,
        creditos: plano.creditos,
        valorVenda: plano.valorVenda,
        custo,
      })
      setCreditosInput(formatInputValue(plano.creditos))
      setValorVendaInput(formatInputValue(plano.valorVenda, true))
    } else {
      setEditingPlano(null)
      setForm(EMPTY_FORM)
      setCreditosInput(formatInputValue(EMPTY_FORM.creditos))
      setValorVendaInput(formatInputValue(EMPTY_FORM.valorVenda, true))
    }

    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.codigo.trim() || !form.servidorId || codigoEmUso) return

    const creditosNormalizados = permiteCreditoFracionado
      ? Number(form.creditos || 0)
      : Math.trunc(Number(form.creditos || 0))

    if (creditosNormalizados <= 0) return

    setLoading(true)

    const payload = {
      ...form,
      codigo: form.codigo.trim(),
      descricao: form.descricao.trim(),
      creditos: creditosNormalizados,
      valorVenda: Number(form.valorVenda || 0),
      custo: Number((getServidorUnitCost(form.servidorId) * creditosNormalizados).toFixed(2)),
    }

    if (dialogMode === 'edit' && editingPlano) {
      await onUpdate({ id: editingPlano.id, ...payload })
    } else {
      await onAdd(payload)
    }

    setLoading(false)
    setDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    await onDelete(id)
    setLoading(false)
  }

  const planosFiltrados = (filtroServidor === 'all'
    ? planos
    : planos.filter(p => p.servidorId === filtroServidor)
  ).slice().sort((a, b) => {
    const sA = getServidorNome(a.servidorId).toLowerCase()
    const sB = getServidorNome(b.servidorId).toLowerCase()
    if (sA !== sB) return sA.localeCompare(sB)

    if (a.tipo !== b.tipo) return a.tipo === 'novo' ? -1 : 1

    return a.meses - b.meses
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Planos de Entrada</h3>
          <p className="text-sm text-muted-foreground">
            Configure os planos para lançamento rápido de vendas.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpen()} disabled={loading} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Label className="text-sm">Filtrar por servidor:</Label>
        <Select value={filtroServidor} onValueChange={setFiltroServidor}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {servidores.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 md:hidden">
        {planosFiltrados.map(p => {
          const custoAtual = getPlanoCustoAtual(p)
          const lucroAtual = getPlanoLucroAtual(p)

          return (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold">{p.codigo}</div>
                  <div className="mt-1 break-words text-sm text-muted-foreground">
                    {p.descricao}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpen(p, 'duplicate')}
                    disabled={loading}
                    title="Duplicar plano"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpen(p, 'edit')}
                    disabled={loading}
                    title="Editar plano"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={loading}
                        title="Excluir plano"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(p.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Servidor</div>
                  <div className="mt-1 font-medium">{getServidorNome(p.servidorId)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className={`mt-1 font-medium ${p.tipo === 'novo' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {p.tipo === 'renovacao' ? 'Renovação' : 'Novo'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Meses</div>
                  <div className="mt-1 font-medium">{p.meses}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Créditos</div>
                  <div className="mt-1 font-medium">{p.creditos}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Venda</div>
                  <div className="mt-1 font-medium">{formatCurrency(p.valorVenda)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Custo</div>
                  <div className="mt-1 font-medium">{formatCurrency(custoAtual)}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Lucro</div>
                  <div className="mt-1 font-semibold text-green-500">
                    {formatCurrency(lucroAtual)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {planosFiltrados.length === 0 && (
          <div className="rounded-lg border py-8 text-center text-muted-foreground">
            Nenhum plano cadastrado.
          </div>
        )}
      </div>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Servidor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Meses</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planosFiltrados.map(p => {
              const custoAtual = getPlanoCustoAtual(p)
              const lucroAtual = getPlanoLucroAtual(p)

              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.codigo}</TableCell>
                  <TableCell>{p.descricao}</TableCell>
                  <TableCell>{getServidorNome(p.servidorId)}</TableCell>
                  <TableCell>
                    <span className={p.tipo === 'novo' ? 'text-emerald-400 font-medium' : 'text-blue-400 font-medium'}>
                      {p.tipo === 'renovacao' ? 'Renovação' : 'Novo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{p.meses}</TableCell>
                  <TableCell className="text-right">{p.creditos}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.valorVenda)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(custoAtual)}</TableCell>
                  <TableCell className="text-right text-green-500">
                    {formatCurrency(lucroAtual)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpen(p, 'duplicate')}
                        disabled={loading}
                        title="Duplicar plano"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpen(p, 'edit')}
                        disabled={loading}
                        title="Editar plano"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={loading} title="Excluir plano">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}

            {planosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Nenhum plano cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit'
                ? 'Editar Plano'
                : dialogMode === 'duplicate'
                  ? 'Duplicar Plano'
                  : 'Novo Plano'}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes do plano de entrada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={form.codigo}
                  onChange={e => setForm({ ...form, codigo: e.target.value })}
                  placeholder={dialogMode === 'duplicate' ? 'Informe um novo código' : 'Ex: P2C-1M'}
                  disabled={loading}
                />
                {codigoEmUso && (
                  <p className="text-xs text-destructive">
                    Já existe um plano com este código.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Servidor</Label>
                <Select
                  value={form.servidorId}
                  onValueChange={v => setForm({ ...form, servidorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {servidores.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: P2Cine 1 mês"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={v => setForm({ ...form, tipo: v as 'renovacao' | 'novo' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="renovacao">Renovação</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Meses</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.meses}
                  onChange={e => setForm({ ...form, meses: parseInt(e.target.value) || 1 })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Créditos</Label>
                <Input
                  type="text"
                  inputMode={permiteCreditoFracionado ? 'decimal' : 'numeric'}
                  value={creditosInput}
                  onChange={e => {
                    const sanitized = sanitizeNumericInput(e.target.value, permiteCreditoFracionado)
                    const parsed = parseLocalizedNumber(sanitized)

                    setCreditosInput(sanitized)
                    setForm({
                      ...form,
                      creditos: permiteCreditoFracionado ? parsed : Math.trunc(parsed),
                    })
                  }}
                  placeholder={permiteCreditoFracionado ? 'Ex: 0,5' : 'Ex: 1'}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor de Venda</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valorVendaInput}
                  onChange={e => {
                    const sanitized = sanitizeNumericInput(e.target.value, true)
                    setValorVendaInput(sanitized)
                    setForm({ ...form, valorVenda: parseLocalizedNumber(sanitized) })
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.custo || ''}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>Lucro</Label>
                <div
                  className={`h-9 flex items-center px-3 rounded-md border bg-muted ${lucroCalculado >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                >
                  {formatCurrency(lucroCalculado)}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !form.codigo.trim() || !form.servidorId || codigoEmUso}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}