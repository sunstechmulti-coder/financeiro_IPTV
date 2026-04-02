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
import { addPlano, updatePlano, deletePlano } from '@/lib/config-storage'
import { formatCurrency } from '@/lib/format'

interface PlanosListProps {
  planos: PlanoEntrada[]
  servidores: Servidor[]
  onChange: (list: PlanoEntrada[]) => void
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

export function PlanosList({ planos, servidores, onChange }: PlanosListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlano, setEditingPlano] = useState<PlanoEntrada | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filtroServidor, setFiltroServidor] = useState<string>('all')

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

  const handleSave = () => {
    if (!form.codigo.trim() || !form.servidorId) return
    if (editingPlano) {
      onChange(updatePlano({ id: editingPlano.id, ...form }))
    } else {
      onChange(addPlano(form))
    }
    setDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    onChange(deletePlano(id))
  }

  const planosFiltrados =
    filtroServidor === 'all'
      ? planos
      : planos.filter((p) => p.servidorId === filtroServidor)

  const getServidorNome = (id: string) =>
    servidores.find((s) => s.id === id)?.nome ?? id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Planos de Entrada</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os planos disponíveis para apontamento de entradas.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpen()}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Filtro por servidor */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={filtroServidor} onValueChange={setFiltroServidor}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os servidores</SelectItem>
            {servidores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Servidor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planosFiltrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {p.codigo}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{p.descricao}</TableCell>
                <TableCell className="text-sm">{getServidorNome(p.servidorId)}</TableCell>
                <TableCell className="text-sm">
                  <span className={p.tipo === 'renovacao' ? 'text-income' : 'text-primary'}>
                    {p.tipo === 'renovacao' ? 'Renovação' : 'Cliente Novo'}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm">{formatCurrency(p.valorVenda)}</TableCell>
                <TableCell className="text-right text-sm text-expense">{formatCurrency(p.custo)}</TableCell>
                <TableCell className="text-right text-sm text-income">
                  {formatCurrency(p.valorVenda - p.custo)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpen(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir plano</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o plano <strong>{p.codigo}</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {planosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nenhum plano encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog add/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Código</Label>
                <Input
                  placeholder="Ex: RMC"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Servidor</Label>
                <Select value={form.servidorId} onValueChange={(v) => setForm({ ...form, servidorId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {servidores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Renovação Mensal P2Cine"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as 'renovacao' | 'novo' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="renovacao">Renovação</SelectItem>
                    <SelectItem value="novo">Cliente Novo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Meses</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.meses}
                  onChange={(e) => setForm({ ...form, meses: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Créditos</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.creditos}
                  onChange={(e) => setForm({ ...form, creditos: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.valorVenda || ''}
                  onChange={(e) => setForm({ ...form, valorVenda: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.custo || ''}
                  onChange={(e) => setForm({ ...form, custo: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 border px-4 py-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Lucro calculado:</span>
              <span className={`font-semibold ${lucroCalculado >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(lucroCalculado)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.codigo.trim() || !form.servidorId}>
              {editingPlano ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
