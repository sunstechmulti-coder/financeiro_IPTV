'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Save, X, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { RevendaGrupo, RevendaFaixa, Servidor } from '@/lib/types'

interface RevendaConfigProps {
  grupos: RevendaGrupo[]
  servidores: Servidor[]
  onAdd: (grupo: Omit<RevendaGrupo, 'id'>) => Promise<RevendaGrupo | null>
  onUpdate: (grupo: RevendaGrupo) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

const EMPTY_FAIXAS: RevendaFaixa[] = [
  { min: 10, max: 29, preco: 0 },
  { min: 30, max: 49, preco: 0 },
  { min: 50, max: 99, preco: 0 },
  { min: 100, max: 299, preco: 0 },
  { min: 300, max: 999, preco: 0 },
]

export function RevendaConfig({ grupos, servidores, onAdd, onUpdate, onDelete }: RevendaConfigProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGrupo, setEditingGrupo] = useState<RevendaGrupo | null>(null)
  const [nome, setNome] = useState('')
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([])
  const [faixas, setFaixas] = useState<RevendaFaixa[]>(EMPTY_FAIXAS)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const assignedServerIds = grupos
    .filter(g => g.id !== editingGrupo?.id)
    .flatMap(g => g.servidorIds)

  const openNew = () => {
    setEditingGrupo(null)
    setNome('')
    setSelectedServerIds([])
    setFaixas(EMPTY_FAIXAS.map(f => ({ ...f })))
    setDialogOpen(true)
  }

  const openEdit = (grupo: RevendaGrupo) => {
    setEditingGrupo(grupo)
    setNome(grupo.nome)
    setSelectedServerIds([...grupo.servidorIds])
    setFaixas(grupo.faixas.length > 0 ? grupo.faixas.map(f => ({ ...f })) : EMPTY_FAIXAS.map(f => ({ ...f })))
    setDialogOpen(true)
  }

  const toggleServer = (id: string) => {
    setSelectedServerIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const updateFaixa = (index: number, field: keyof RevendaFaixa, value: string) => {
    setFaixas(prev =>
      prev.map((f, i) =>
        i === index ? { ...f, [field]: parseFloat(value.replace(',', '.')) || 0 } : f
      )
    )
  }

  const addFaixa = () => {
    const last = faixas[faixas.length - 1]
    setFaixas(prev => [
      ...prev,
      { min: (last?.max ?? 0) + 1, max: (last?.max ?? 0) + 100, preco: 0 }
    ])
  }

  const removeFaixa = (index: number) => {
    if (faixas.length <= 1) return
    setFaixas(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!nome.trim() || selectedServerIds.length === 0 || faixas.some(f => f.preco <= 0)) return
    setSaving(true)
    if (editingGrupo) {
      await onUpdate({ ...editingGrupo, nome: nome.trim(), servidorIds: selectedServerIds, faixas })
    } else {
      await onAdd({ nome: nome.trim(), servidorIds: selectedServerIds, faixas })
    }
    setSaving(false)
    setDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setDeleteConfirm(null)
  }

  const getServerName = (id: string) => servidores.find(s => s.id === id)?.nome ?? id

  const isValid =
    nome.trim() &&
    selectedServerIds.length > 0 &&
    faixas.length > 0 &&
    faixas.every(f => f.preco > 0 && f.min > 0 && f.max >= f.min)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-medium">
            <DollarSign className="h-4 w-4" />
            Tabelas de Revenda
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure os preços por faixa de créditos para cada grupo de servidores.
          </p>
        </div>
        <Button size="sm" onClick={openNew} data-testid="add-revenda-group" className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      {grupos.length === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Nenhum grupo de revenda configurado.
        </div>
      )}

      <div className="space-y-3">
        {grupos.map(grupo => (
          <Card key={grupo.id}>
            <CardHeader className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-medium">{grupo.nome}</CardTitle>
                  <CardDescription className="mt-0.5 break-words text-xs">
                    {grupo.servidorIds.map(id => getServerName(id)).join(', ')}
                  </CardDescription>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(grupo)} className="h-7 w-7 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  {deleteConfirm === grupo.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(grupo.id)}
                        className="h-7 px-2 text-xs"
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(null)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(grupo.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {grupo.faixas.map((f, i) => (
                  <div key={i} className="rounded border border-border/50 bg-muted/30 px-2 py-2 text-center">
                    <div className="text-xs font-mono text-muted-foreground">
                      {f.min}-{f.max}
                    </div>
                    <div className="text-base font-medium">
                      R${f.preco.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGrupo ? 'Editar Grupo' : 'Novo Grupo de Revenda'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome do grupo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: FIRE / WAREZ / P2BRAZ"
                data-testid="revenda-group-name"
              />
            </div>

            <div className="grid gap-2">
              <Label>Servidores</Label>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                {servidores.map(s => {
                  const isAssigned = assignedServerIds.includes(s.id)
                  const isSelected = selectedServerIds.includes(s.id)

                  return (
                    <label
                      key={s.id}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-2 text-sm transition-colors',
                        isAssigned && !isSelected ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-muted/50',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => (!isAssigned || isSelected ? toggleServer(s.id) : null)}
                        disabled={isAssigned && !isSelected}
                      />
                      <span className="break-words">{s.nome}</span>
                      {isAssigned && !isSelected && (
                        <span className="text-xs text-muted-foreground">(em outro grupo)</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Faixas de preço (R$ por crédito)</Label>

              <div className="space-y-3">
                {faixas.map((f, i) => (
                  <div key={i} className="rounded-lg border p-3 sm:border-0 sm:p-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-2">
                        <Input
                          type="number"
                          min={1}
                          className="text-center text-sm sm:w-20"
                          value={f.min || ''}
                          onChange={(e) => updateFaixa(i, 'min', e.target.value)}
                          placeholder="Min"
                        />

                        <Input
                          type="number"
                          min={f.min}
                          className="text-center text-sm sm:w-20"
                          value={f.max || ''}
                          onChange={(e) => updateFaixa(i, 'max', e.target.value)}
                          placeholder="Max"
                        />
                      </div>

                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:items-center sm:gap-2">
                        <span className="text-xs text-muted-foreground sm:block">R$</span>

                        <Input
                          type="number"
                          step="0.5"
                          min={0}
                          className="text-sm sm:w-24"
                          value={f.preco || ''}
                          onChange={(e) => updateFaixa(i, 'preco', e.target.value)}
                          placeholder="Preço"
                        />

                        <span className="text-xs text-muted-foreground">/cr</span>
                      </div>

                      {faixas.length > 1 && (
                        <div className="flex justify-end sm:ml-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFaixa(i)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addFaixa} className="w-full text-xs">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar faixa
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="w-full sm:w-auto"
            >
              {saving ? 'Salvando...' : (
                <>
                  <Save className="mr-1 h-4 w-4" />
                  {editingGrupo ? 'Salvar' : 'Criar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}