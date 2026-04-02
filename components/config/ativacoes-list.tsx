'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ActivationProduct, PricingRule, Servidor } from '@/lib/types'
import {
  addActivationProduct,
  updateActivationProduct,
  deleteActivationProduct,
} from '@/lib/activation-storage'

interface AtivacoesListProps {
  products: ActivationProduct[]
  servidores: Servidor[]
  onChange: (list: ActivationProduct[]) => void
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// Parse comma-separated numbers like "0.5,0.6,0.7"
function parseCustos(str: string): number[] {
  return str
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
}

function formatCustos(list: number[]): string {
  return list.join(', ')
}

interface FormState {
  nome: string
  validadeMeses: string
  custosPermitidos: string  // comma-separated
  linkedServerId: string    // '' = nenhum vínculo
  // pricing rules as simple pairs
  rules: Array<{ min: string; max: string; price: string }>
}

const EMPTY_FORM: FormState = {
  nome: '',
  validadeMeses: '12',
  custosPermitidos: '0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9',
  linkedServerId: '',
  rules: [
    { min: '0.5', max: '1.0', price: '20.00' },
    { min: '1.1', max: '1.9', price: '25.00' },
  ],
}

function productToForm(p: ActivationProduct): FormState {
  return {
    nome: p.nome,
    validadeMeses: String(p.validadeMeses),
    custosPermitidos: formatCustos(p.custosPermitidos),
    linkedServerId: p.linkedServerId ?? '',
    rules: p.regrasPreco.map((r) => ({
      min: String(r.minCost),
      max: String(r.maxCost),
      price: String(r.salePrice),
    })),
  }
}

function formToProduct(form: FormState): Omit<ActivationProduct, 'id'> {
  return {
    nome: form.nome.trim(),
    validadeMeses: parseInt(form.validadeMeses) || 12,
    custosPermitidos: parseCustos(form.custosPermitidos),
    linkedServerId: form.linkedServerId || undefined,
    regrasPreco: form.rules
      .map((r) => ({
        minCost: parseFloat(r.min) || 0,
        maxCost: parseFloat(r.max) || 0,
        salePrice: parseFloat(r.price.replace(',', '.')) || 0,
      }))
      .filter((r) => r.minCost > 0 && r.maxCost > 0 && r.salePrice > 0) as PricingRule[],
  }
}

export function AtivacoesList({ products, servidores, onChange }: AtivacoesListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (p: ActivationProduct) => {
    setEditingId(p.id)
    setForm(productToForm(p))
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.nome.trim()) return
    if (editingId) {
      onChange(updateActivationProduct({ ...formToProduct(form), id: editingId } as ActivationProduct))
    } else {
      onChange(addActivationProduct(formToProduct(form)))
    }
    setDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    onChange(deleteActivationProduct(id))
  }

  const updateRule = (idx: number, field: 'min' | 'max' | 'price', value: string) => {
    const rules = form.rules.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    setForm({ ...form, rules })
  }

  const addRule = () => {
    setForm({ ...form, rules: [...form.rules, { min: '', max: '', price: '' }] })
  }

  const removeRule = (idx: number) => {
    setForm({ ...form, rules: form.rules.filter((_, i) => i !== idx) })
  }

  const isFormValid = form.nome.trim().length > 0 && parseCustos(form.custosPermitidos).length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Ativações</h3>
          <p className="text-sm text-muted-foreground">
            Produtos com faixas de custo e preço dinâmico (ex: ATIVA APP).
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Validade</TableHead>
              <TableHead>Fonte de Saldo</TableHead>
              <TableHead>Faixas de Custo</TableHead>
              <TableHead>Regras de Preço</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma ativação cadastrada.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-center">{p.validadeMeses} meses</TableCell>
                <TableCell>
                  {p.linkedServerId
                    ? <span className="text-sm font-medium">
                        {servidores.find((s) => s.id === p.linkedServerId)?.nome ?? p.linkedServerId}
                      </span>
                    : <span className="text-xs text-muted-foreground">Não vinculado</span>
                  }
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {p.custosPermitidos.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {p.regrasPreco.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {r.minCost} – {r.maxCost} ={' '}
                        <span className="font-medium text-income">{formatCurrency(r.salePrice)}</span>
                      </p>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir ativação</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{p.nome}</strong>? Esta ação não pode ser desfeita.
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Ativação' : 'Nova Ativação'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: ATIVA APP"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Validade (meses)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.validadeMeses}
                  onChange={(e) => setForm({ ...form, validadeMeses: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Fonte de Saldo (Servidor)</Label>
              <Select
                value={form.linkedServerId || '__none__'}
                onValueChange={(v) => setForm({ ...form, linkedServerId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o servidor vinculado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (sem controle de saldo)</SelectItem>
                  {servidores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                      {s.creditsBalance != null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({s.creditsBalance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} créditos)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao vender esta ativação, o custo será subtraído do saldo deste servidor.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Custos permitidos</Label>
              <Input
                placeholder="0.5, 0.6, 0.7, 1.0, 1.5"
                value={form.custosPermitidos}
                onChange={(e) => setForm({ ...form, custosPermitidos: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Separe os valores por vírgula. Ex: 0.5, 0.6, 0.7, 1.0
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Regras de preço por faixa</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addRule}>
                  <Plus className="mr-1 h-3 w-3" />
                  Faixa
                </Button>
              </div>
              <div className="space-y-2">
                {form.rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Min"
                        value={r.min}
                        onChange={(e) => updateRule(i, 'min', e.target.value)}
                        className="w-20"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Max"
                        value={r.max}
                        onChange={(e) => updateRule(i, 'max', e.target.value)}
                        className="w-20"
                      />
                      <span className="text-muted-foreground text-sm">=</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Preço"
                        value={r.price}
                        onChange={(e) => updateRule(i, 'price', e.target.value)}
                        className="w-28"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeRule(i)}
                      disabled={form.rules.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!isFormValid}>
              <Check className="mr-1 h-4 w-4" />
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
