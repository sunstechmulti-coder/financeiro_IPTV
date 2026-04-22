'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { Servidor } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface ServidoresListProps {
  servidores: Servidor[]
  onAdd: (servidor: Omit<Servidor, 'id'>) => Promise<Servidor | null>
  onUpdate: (servidor: Servidor) => Promise<Servidor | null>
  onDelete: (id: string) => Promise<boolean>
}

const EMPTY: Omit<Servidor, 'id'> = {
  nome: '',
  supplierWhatsapp: '',
  panelUsername: '',
  custoUnitario: 0,
  riskCredits: 10,
  rechargeQuantity: 10,
  creditsBalance: 0,
  permiteVendaFracionada: false,
}

export function ServidoresList({ servidores, onAdd, onUpdate, onDelete }: ServidoresListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<Servidor, 'id'>>(EMPTY)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Omit<Servidor, 'id'>>(EMPTY)
  const [loading, setLoading] = useState(false)

  const handleEdit = (s: Servidor) => {
    setEditingId(s.id)
    setEditForm({
      nome: s.nome,
      supplierWhatsapp: s.supplierWhatsapp ?? '',
      panelUsername: s.panelUsername ?? '',
      custoUnitario: s.custoUnitario,
      riskCredits: s.riskCredits ?? 10,
      rechargeQuantity: s.rechargeQuantity ?? 10,
      creditsBalance: s.creditsBalance ?? 0,
      permiteVendaFracionada: s.permiteVendaFracionada ?? false,
    })
  }

  const handleEditSave = async (id: string) => {
    if (!editForm.nome.trim()) return
    setLoading(true)
    await onUpdate({ id, ...editForm })
    setLoading(false)
    setEditingId(null)
  }

  const handleEditCancel = () => setEditingId(null)

  const handleAdd = async () => {
    if (!addForm.nome.trim()) return
    setLoading(true)
    await onAdd(addForm)
    setLoading(false)
    setAddForm(EMPTY)
    setShowAdd(false)
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    await onDelete(id)
    setLoading(false)
  }

  const resetAddForm = () => {
    setShowAdd(false)
    setAddForm(EMPTY)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Servidores</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os servidores, custos e saldo de créditos.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={loading} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {showAdd && (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold">Novo servidor</div>

            <div>
              <div className="mb-1 text-xs text-muted-foreground">Nome</div>
              <Input
                placeholder="Nome do servidor"
                value={addForm.nome}
                onChange={(e) => setAddForm({ ...addForm, nome: e.target.value })}
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-muted-foreground">WhatsApp Fornecedor</div>
              <Input
                placeholder="WhatsApp do fornecedor"
                value={addForm.supplierWhatsapp ?? ''}
                onChange={(e) => setAddForm({ ...addForm, supplierWhatsapp: e.target.value })}
                disabled={loading}
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-muted-foreground">Usuário do Painel</div>
              <Input
                placeholder="Usuário do painel"
                value={addForm.panelUsername ?? ''}
                onChange={(e) => setAddForm({ ...addForm, panelUsername: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Custo Unitário</div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={addForm.custoUnitario || ''}
                  onChange={(e) => setAddForm({ ...addForm, custoUnitario: parseFloat(e.target.value) || 0 })}
                  disabled={loading}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Margem de Risco</div>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="10"
                  value={addForm.riskCredits ?? 10}
                  onChange={(e) => setAddForm({ ...addForm, riskCredits: parseFloat(e.target.value) || 0 })}
                  disabled={loading}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Qtd. Recarga</div>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="10"
                  value={addForm.rechargeQuantity ?? 10}
                  onChange={(e) => setAddForm({ ...addForm, rechargeQuantity: parseFloat(e.target.value) || 0 })}
                  disabled={loading}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Créditos Disponíveis</div>
                <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
                  0
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm">Fracionado</span>
              <Checkbox
                checked={addForm.permiteVendaFracionada}
                onCheckedChange={(v) => setAddForm({ ...addForm, permiteVendaFracionada: v === true })}
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={resetAddForm} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={loading}>
                Salvar
              </Button>
            </div>
          </div>
        )}

        {servidores.map((s) =>
          editingId === s.id ? (
            <div key={s.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold">Editar servidor</div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Nome</div>
                <Input
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">WhatsApp Fornecedor</div>
                <Input
                  value={editForm.supplierWhatsapp ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, supplierWhatsapp: e.target.value })}
                  placeholder="WhatsApp do fornecedor"
                  disabled={loading}
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Usuário do Painel</div>
                <Input
                  value={editForm.panelUsername ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, panelUsername: e.target.value })}
                  placeholder="Usuário do painel"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Custo Unitário</div>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.custoUnitario || ''}
                    onChange={(e) => setEditForm({ ...editForm, custoUnitario: parseFloat(e.target.value) || 0 })}
                    disabled={loading}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Margem de Risco</div>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={editForm.riskCredits ?? 10}
                    onChange={(e) => setEditForm({ ...editForm, riskCredits: parseFloat(e.target.value) || 0 })}
                    disabled={loading}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Qtd. Recarga</div>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={editForm.rechargeQuantity ?? 10}
                    onChange={(e) => setEditForm({ ...editForm, rechargeQuantity: parseFloat(e.target.value) || 0 })}
                    disabled={loading}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Créditos Disponíveis</div>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={editForm.creditsBalance ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, creditsBalance: parseFloat(e.target.value) || 0 })}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm">Fracionado</span>
                <Checkbox
                  checked={editForm.permiteVendaFracionada}
                  onCheckedChange={(v) => setEditForm({ ...editForm, permiteVendaFracionada: v === true })}
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={handleEditCancel} disabled={loading}>
                  Cancelar
                </Button>
                <Button onClick={() => handleEditSave(s.id)} disabled={loading}>
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div key={s.id} className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 text-base font-semibold">{s.nome}</div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(s)}
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
                        <AlertDialogTitle>Excluir servidor?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Todos os planos vinculados a este servidor também serão afetados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(s.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">WhatsApp Fornecedor</div>
                  <div className="mt-1 break-words font-medium">{s.supplierWhatsapp || '-'}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Usuário do Painel</div>
                  <div className="mt-1 break-words font-medium">{s.panelUsername || '-'}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Custo Unitário</div>
                  <div className="mt-1 font-medium">{formatCurrency(s.custoUnitario)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Margem de Risco</div>
                  <div className="mt-1 font-medium">{s.riskCredits ?? 10}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Qtd. Recarga</div>
                  <div className="mt-1 font-medium">{s.rechargeQuantity ?? 10}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Fracionado</div>
                  <div className="mt-1">
                    {s.permiteVendaFracionada ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Créditos Disponíveis</div>
                  <div className="mt-1 font-medium">{s.creditsBalance ?? 0}</div>
                </div>
              </div>
            </div>
          )
        )}

        {servidores.length === 0 && !showAdd && (
          <div className="rounded-lg border py-8 text-center text-muted-foreground">
            Nenhum servidor cadastrado.
          </div>
        )}
      </div>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp Fornecedor</TableHead>
              <TableHead>Usuário do Painel</TableHead>
              <TableHead>Custo Unitário</TableHead>
              <TableHead>Margem de Risco</TableHead>
              <TableHead>Qtd. Recarga</TableHead>
              <TableHead className="text-center">Fracionado</TableHead>
              <TableHead className="text-right">Créditos Disponíveis</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAdd && (
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="Nome do servidor"
                    value={addForm.nome}
                    onChange={(e) => setAddForm({ ...addForm, nome: e.target.value })}
                    className="h-8"
                    autoFocus
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="WhatsApp do fornecedor"
                    value={addForm.supplierWhatsapp ?? ''}
                    onChange={(e) => setAddForm({ ...addForm, supplierWhatsapp: e.target.value })}
                    className="h-8"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Usuário do painel"
                    value={addForm.panelUsername ?? ''}
                    onChange={(e) => setAddForm({ ...addForm, panelUsername: e.target.value })}
                    className="h-8"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={addForm.custoUnitario || ''}
                    onChange={(e) => setAddForm({ ...addForm, custoUnitario: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-24"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="10"
                    value={addForm.riskCredits ?? 10}
                    onChange={(e) => setAddForm({ ...addForm, riskCredits: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-24"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="10"
                    value={addForm.rechargeQuantity ?? 10}
                    onChange={(e) => setAddForm({ ...addForm, rechargeQuantity: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-24"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={addForm.permiteVendaFracionada}
                    onCheckedChange={(v) => setAddForm({ ...addForm, permiteVendaFracionada: v === true })}
                    disabled={loading}
                  />
                </TableCell>
                <TableCell className="text-right">0</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAdd} disabled={loading}>
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetAddForm} disabled={loading}>
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {servidores.map((s) =>
              editingId === s.id ? (
                <TableRow key={s.id}>
                  <TableCell>
                    <Input
                      value={editForm.nome}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      className="h-8"
                      autoFocus
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editForm.supplierWhatsapp ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, supplierWhatsapp: e.target.value })}
                      className="h-8"
                      placeholder="WhatsApp do fornecedor"
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editForm.panelUsername ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, panelUsername: e.target.value })}
                      className="h-8"
                      placeholder="Usuário do painel"
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.custoUnitario || ''}
                      onChange={(e) => setEditForm({ ...editForm, custoUnitario: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-24"
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={editForm.riskCredits ?? 10}
                      onChange={(e) => setEditForm({ ...editForm, riskCredits: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-24"
                      placeholder="10"
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={editForm.rechargeQuantity ?? 10}
                      onChange={(e) => setEditForm({ ...editForm, rechargeQuantity: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-24"
                      placeholder="10"
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={editForm.permiteVendaFracionada}
                      onCheckedChange={(v) => setEditForm({ ...editForm, permiteVendaFracionada: v === true })}
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={editForm.creditsBalance ?? 0}
                      onChange={(e) => setEditForm({ ...editForm, creditsBalance: parseFloat(e.target.value) || 0 })}
                      className="h-8 w-20 text-right"
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSave(s.id)} disabled={loading}>
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditCancel} disabled={loading}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>{s.supplierWhatsapp || '-'}</TableCell>
                  <TableCell>{s.panelUsername || '-'}</TableCell>
                  <TableCell>{formatCurrency(s.custoUnitario)}</TableCell>
                  <TableCell>{s.riskCredits ?? 10}</TableCell>
                  <TableCell>{s.rechargeQuantity ?? 10}</TableCell>
                  <TableCell className="text-center">
                    {s.permiteVendaFracionada ? <Check className="mx-auto h-4 w-4 text-green-500" /> : <X className="mx-auto h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-right">{s.creditsBalance ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(s)} disabled={loading}>
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
                            <AlertDialogTitle>Excluir servidor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Todos os planos vinculados a este servidor também serão afetados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(s.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}

            {servidores.length === 0 && !showAdd && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Nenhum servidor cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}