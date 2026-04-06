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

  // Servers already assigned to other groups (excluding current editing group)
  const assignedServerIds = grupos
    .filter(g => g.id !== editingGrupo?.id)
    .flatMap(g => g.servidorIds)

  const availableServers = servidores.filter(s => !assignedServerIds.includes(s.id))

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
    setFaixas(prev => prev.map((f, i) =>
      i === index ? { ...f, [field]: parseFloat(value.replace(',', '.')) || 0 } : f
    ))
  }

  const addFaixa = () => {
    const last = faixas[faixas.length - 1]
    setFaixas(prev => [...prev, { min: (last?.max ?? 0) + 1, max: (last?.max ?? 0) + 100, preco: 0 }])
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

  const isValid = nome.trim() && selectedServerIds.length > 0 && faixas.length > 0 && faixas.every(f => f.preco > 0 && f.min > 0 && f.max >= f.min)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tabelas de Revenda
          </h3>
          <p className="text-sm text-muted-foreground">Configure os preços por faixa de créditos para cada grupo de servidores.</p>
        </div>
        <Button size="sm" onClick={openNew} data-testid="add-revenda-group">
          <Plus className="h-4 w-4 mr-1" />
          Novo Grupo
        </Button>
      </div>

      {grupos.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8 border rounded-lg border-dashed">
          Nenhum grupo de revenda configurado.
        </div>
      )}

      {/* Groups list */}
      <div className="space-y-3">
        {grupos.map(grupo => (
          <Card key={grupo.id}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">{grupo.nome}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {grupo.servidorIds.map(id => getServerName(id)).join(', ')}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(grupo)} className="h-7 w-7 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {deleteConfirm === grupo.id ? (
                    <div className="flex gap-1">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(grupo.id)} className="h-7 px-2 text-xs">
                        Confirmar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)} className="h-7 w-7 p-0">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(grupo.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {grupo.faixas.map((f, i) => (
                  <div key={i} className="rounded border border-border/50 bg-muted/30 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground font-mono">{f.min}-{f.max}</div>
                    <div className="text-sm font-medium">R${f.preco.toFixed(2).replace('.', ',')}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGrupo ? 'Editar Grupo' : 'Novo Grupo de Revenda'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome */}
            <div className="grid gap-2">
              <Label>Nome do grupo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: FIRE / WAREZ / P2BRAZ"
                data-testid="revenda-group-name"
              />
            </div>

            {/* Servidores */}
            <div className="grid gap-2">
              <Label>Servidores</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {servidores.map(s => {
                  const isAssigned = assignedServerIds.includes(s.id)
                  const isSelected = selectedServerIds.includes(s.id)
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        'flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 transition-colors',
                        isAssigned && !isSelected ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => !isAssigned || isSelected ? toggleServer(s.id) : null}
                        disabled={isAssigned && !isSelected}
                      />
                      <span>{s.nome}</span>
                      {isAssigned && !isSelected && <span className="text-xs text-muted-foreground">(em outro grupo)</span>}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Faixas de preço */}
            <div className="grid gap-2">
              <Label>Faixas de preço (R$ por crédito)</Label>
              <div className="space-y-2">
                {faixas.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      className="w-20 text-center text-sm"
                      value={f.min || ''}
                      onChange={(e) => updateFaixa(i, 'min', e.target.value)}
                      placeholder="Min"
                    />
                    <span className="text-muted-foreground text-xs">a</span>
                    <Input
                      type="number"
                      min={f.min}
                      className="w-20 text-center text-sm"
                      value={f.max || ''}
                      onChange={(e) => updateFaixa(i, 'max', e.target.value)}
                      placeholder="Max"
                    />
                    <span className="text-muted-foreground text-xs ml-1">R$</span>
                    <Input
                      type="number"
                      step="0.5"
                      min={0}
                      className="w-24 text-sm"
                      value={f.preco || ''}
                      onChange={(e) => updateFaixa(i, 'preco', e.target.value)}
                      placeholder="Preço"
                    />
                    <span className="text-xs text-muted-foreground">/cr</span>
                    {faixas.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeFaixa(i)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addFaixa} className="w-full text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar faixa
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!isValid || saving}>
              {saving ? 'Salvando...' : <><Save className="h-4 w-4 mr-1" />{editingGrupo ? 'Salvar' : 'Criar'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
