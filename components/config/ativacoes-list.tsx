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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ActivationProduct, PricingRule, Servidor } from '@/lib/types'

interface AtivacoesListProps {
  products: ActivationProduct[]
  servidores: Servidor[]
  onAdd: (product: Omit<ActivationProduct, 'id'>) => Promise<ActivationProduct | null>
  onUpdate: (product: ActivationProduct) => Promise<ActivationProduct | null>
  onDelete: (id: string) => Promise<boolean>
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function parseCustos(str: string): number[] {
  return str
    .split(',')
    .map(s => parseFloat(s.trim()))
    .filter(n => !isNaN(n) && n > 0)
}

function formatCustos(arr: number[]): string {
  return arr.map(n => n.toString()).join(', ')
}

interface ProductForm {
  nome: string
  validadeMeses: number
  custosPermitidos: string
  linkedServerId?: string
  regrasPreco: PricingRule[]
}

const EMPTY_FORM: ProductForm = {
  nome: '',
  validadeMeses: 12,
  custosPermitidos: '',
  linkedServerId: undefined,
  regrasPreco: [],
}

const EMPTY_RULE: PricingRule = { minCost: 0, maxCost: 0, salePrice: 0 }

export function AtivacoesList({ products, servidores, onAdd, onUpdate, onDelete }: AtivacoesListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ActivationProduct | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null)
  const [ruleForm, setRuleForm] = useState<PricingRule>(EMPTY_RULE)
  const [loading, setLoading] = useState(false)

  const handleOpen = (product?: ActivationProduct) => {
    if (product) {
      setEditingProduct(product)
      setForm({
        nome: product.nome,
        validadeMeses: product.validadeMeses,
        custosPermitidos: formatCustos(product.custosPermitidos),
        linkedServerId: product.linkedServerId,
        regrasPreco: [...product.regrasPreco],
      })
    } else {
      setEditingProduct(null)
      setForm(EMPTY_FORM)
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) return
    setLoading(true)
    const data = {
      nome: form.nome,
      validadeMeses: form.validadeMeses,
      custosPermitidos: parseCustos(form.custosPermitidos),
      linkedServerId: form.linkedServerId,
      regrasPreco: form.regrasPreco,
    }
    if (editingProduct) {
      await onUpdate({ id: editingProduct.id, ...data })
    } else {
      await onAdd(data)
    }
    setLoading(false)
    setDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    await onDelete(id)
    setLoading(false)
  }

  const handleAddRule = () => {
    setForm({ ...form, regrasPreco: [...form.regrasPreco, { ...EMPTY_RULE }] })
  }

  const handleEditRule = (idx: number) => {
    setEditingRuleIdx(idx)
    setRuleForm({ ...form.regrasPreco[idx] })
  }

  const handleSaveRule = () => {
    if (editingRuleIdx === null) return
    const newRules = [...form.regrasPreco]
    newRules[editingRuleIdx] = ruleForm
    setForm({ ...form, regrasPreco: newRules })
    setEditingRuleIdx(null)
    setRuleForm(EMPTY_RULE)
  }

  const handleCancelRule = () => {
    setEditingRuleIdx(null)
    setRuleForm(EMPTY_RULE)
  }

  const handleDeleteRule = (idx: number) => {
    const newRules = form.regrasPreco.filter((_, i) => i !== idx)
    setForm({ ...form, regrasPreco: newRules })
  }

  const getServidorNome = (id?: string) =>
    id ? servidores.find(s => s.id === id)?.nome ?? '—' : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Produtos de Ativação</h3>
          <p className="text-sm text-muted-foreground">
            Configure produtos de ativação com custos variáveis e regras de preço.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpen()} disabled={loading} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {products.map(p => (
          <div key={p.id} className="rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">{p.nome}</div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpen(p)}
                  disabled={loading}
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
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
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Servidor Vinculado</div>
                <div className="mt-1 font-medium">{getServidorNome(p.linkedServerId)}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Validade (meses)</div>
                <div className="mt-1 font-medium">{p.validadeMeses}</div>
              </div>

              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Custos Permitidos</div>
                <div className="mt-1 break-words font-medium">
                  {p.custosPermitidos.length > 0 ? formatCustos(p.custosPermitidos) : '—'}
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Regras de Preço</div>
                <div className="mt-1 font-medium">{p.regrasPreco.length}</div>
              </div>
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="rounded-lg border py-8 text-center text-muted-foreground">
            Nenhum produto de ativação cadastrado.
          </div>
        )}
      </div>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Servidor Vinculado</TableHead>
              <TableHead className="text-right">Validade (meses)</TableHead>
              <TableHead>Custos Permitidos</TableHead>
              <TableHead className="text-right">Regras de Preço</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{getServidorNome(p.linkedServerId)}</TableCell>
                <TableCell className="text-right">{p.validadeMeses}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {p.custosPermitidos.length > 0 ? formatCustos(p.custosPermitidos) : '—'}
                </TableCell>
                <TableCell className="text-right">{p.regrasPreco.length}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpen(p)} disabled={loading}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={loading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
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
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum produto de ativação cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto de Ativação'}</DialogTitle>
            <DialogDescription>
              Configure os detalhes do produto de ativação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: ATIVA APP"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Servidor Vinculado</Label>
                <Select
                  value={form.linkedServerId || 'none'}
                  onValueChange={v => setForm({ ...form, linkedServerId: v === 'none' ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {servidores.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Validade (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.validadeMeses}
                  onChange={e => setForm({ ...form, validadeMeses: parseInt(e.target.value) || 1 })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Custos Permitidos (separados por vírgula)</Label>
                <Input
                  value={form.custosPermitidos}
                  onChange={e => setForm({ ...form, custosPermitidos: e.target.value })}
                  placeholder="Ex: 0.5, 0.6, 0.7"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>Regras de Preço</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddRule}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar Regra
                </Button>
              </div>

              <div className="space-y-3 sm:hidden">
                {form.regrasPreco.map((rule, idx) =>
                  editingRuleIdx === idx ? (
                    <div key={idx} className="rounded-lg border p-3 space-y-3">
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">Custo Mínimo</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={ruleForm.minCost || ''}
                          onChange={e => setRuleForm({ ...ruleForm, minCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">Custo Máximo</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={ruleForm.maxCost || ''}
                          onChange={e => setRuleForm({ ...ruleForm, maxCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">Preço de Venda</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={ruleForm.salePrice || ''}
                          onChange={e => setRuleForm({ ...ruleForm, salePrice: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancelRule}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveRule}>
                          Salvar regra
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Custo Mínimo</div>
                        <div className="font-medium">{formatCurrency(rule.minCost)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Custo Máximo</div>
                        <div className="font-medium">{formatCurrency(rule.maxCost)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">Preço de Venda</div>
                        <div className="font-medium">{formatCurrency(rule.salePrice)}</div>
                      </div>

                      <div className="flex justify-end gap-1 pt-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRule(idx)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRule(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )
                )}

                {form.regrasPreco.length === 0 && (
                  <div className="rounded-lg border py-4 text-center text-sm text-muted-foreground">
                    Nenhuma regra de preço.
                  </div>
                )}
              </div>

              <div className="hidden rounded-lg border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Custo Mínimo</TableHead>
                      <TableHead>Custo Máximo</TableHead>
                      <TableHead>Preço de Venda</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.regrasPreco.map((rule, idx) =>
                      editingRuleIdx === idx ? (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={ruleForm.minCost || ''}
                              onChange={e => setRuleForm({ ...ruleForm, minCost: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={ruleForm.maxCost || ''}
                              onChange={e => setRuleForm({ ...ruleForm, maxCost: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={ruleForm.salePrice || ''}
                              onChange={e => setRuleForm({ ...ruleForm, salePrice: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveRule}>
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelRule}>
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={idx}>
                          <TableCell>{formatCurrency(rule.minCost)}</TableCell>
                          <TableCell>{formatCurrency(rule.maxCost)}</TableCell>
                          <TableCell>{formatCurrency(rule.salePrice)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditRule(idx)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRule(idx)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}

                    {form.regrasPreco.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          Nenhuma regra de preço.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}