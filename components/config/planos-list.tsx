'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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

export function PlanosList({ planos, servidores, onAdd, onUpdate, onDelete }: PlanosListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlano, setEditingPlano] = useState<PlanoEntrada | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filtroServidor, setFiltroServidor] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const lucroCalculado = form.valorVenda - form.custo

  const handleOpen = (plano?: PlanoEntrada) => {
    if (plano) {
      setEditingPlano(plano)
      setForm({
        codigo: plano.codigo,
        descricao: plano.descricao,
        servidorId: plano.servidorId,
        tipo: plano.tipo,
        meses: plano.meses,
        creditos: plano.creditos,
        valorVenda: plano.valorVenda,
        custo: plano.custo,
      })
    } else {
      setEditingPlano(null)
      setForm(EMPTY_FORM)
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.codigo.trim() || !form.servidorId) return
    setLoading(true)
    if (editingPlano) {
      await onUpdate({ id: editingPlano.id, ...form })
    } else {
      await onAdd(form)
    }
    setLoading(false)
    setDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    await onDelete(id)
    setLoading(false)
  }

  const getServidorNome = (id: string) => servidores.find(s => s.id === id)?.nome ?? '—'

  // Sort: by server name → type (novo first) → meses ascending
  const planosFiltrados = (filtroServidor === 'all'
    ? planos
    : planos.filter(p => p.servidorId === filtroServidor)
  ).slice().sort((a, b) => {
    // 1. Server name
    const sA = getServidorNome(a.servidorId).toLowerCase()
    const sB = getServidorNome(b.servidorId).toLowerCase()
    if (sA !== sB) return sA.localeCompare(sB)
    // 2. Type: 'novo' before 'renovacao'
    if (a.tipo !== b.tipo) return a.tipo === 'novo' ? -1 : 1
    // 3. Meses ascending (1, 3, 6, 12)
    return a.meses - b.meses
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Planos de Entrada</h3>
          <p className="text-sm text-muted-foreground">
            Configure os planos para lançamento rápido de vendas.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpen()} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Filtro por servidor */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Filtrar por servidor:</Label>
        <Select value={filtroServidor} onValueChange={setFiltroServidor}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {servidores.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
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
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planosFiltrados.map(p => (
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
                <TableCell className="text-right">{formatCurrency(p.custo)}</TableCell>
                <TableCell className="text-right text-green-500">{formatCurrency(p.valorVenda - p.custo)}</TableCell>
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
            ))}
            {planosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Nenhum plano cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de edição/adição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
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
                  placeholder="Ex: P2C-1M"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Servidor</Label>
                <Select value={form.servidorId} onValueChange={v => setForm({ ...form, servidorId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {servidores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
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
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as 'renovacao' | 'novo' })}>
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
                  type="number"
                  min={1}
                  value={form.creditos}
                  onChange={e => setForm({ ...form, creditos: parseInt(e.target.value) || 1 })}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor de Venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valorVenda || ''}
                  onChange={e => setForm({ ...form, valorVenda: parseFloat(e.target.value) || 0 })}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.custo || ''}
                  onChange={e => setForm({ ...form, custo: parseFloat(e.target.value) || 0 })}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Lucro</Label>
                <div className={`h-9 flex items-center px-3 rounded-md border bg-muted ${lucroCalculado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(lucroCalculado)}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
