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
import { Checkbox } from '@/components/ui/checkbox'
import type { SaidaRapida, Servidor } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface SaidasRapidasListProps {
  saidas: SaidaRapida[]
  servidores: Servidor[]
  onAdd: (saida: Omit<SaidaRapida, 'id'>) => Promise<SaidaRapida | null>
  onUpdate: (saida: SaidaRapida) => Promise<SaidaRapida | null>
  onDelete: (id: string) => Promise<boolean>
}

const CATEGORIAS = ['Servidor', 'Operacional', 'Marketing', 'Pessoal', 'Outros']

const EMPTY_FORM: Omit<SaidaRapida, 'id'> = {
  nome: '',
  categoria: 'Operacional',
  serverId: undefined,
  valorUnitario: 0,
  usaQuantidade: false,
  descricaoPadrao: '',
}

export function SaidasRapidasList({ saidas, servidores, onAdd, onUpdate, onDelete }: SaidasRapidasListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSaida, setEditingSaida] = useState<SaidaRapida | null>(null)
  const [form, setForm] = useState<Omit<SaidaRapida, 'id'>>(EMPTY_FORM)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const handleOpen = (saida?: SaidaRapida) => {
    if (saida) {
      setEditingSaida(saida)
      setForm({
        nome: saida.nome,
        categoria: saida.categoria,
        serverId: saida.serverId,
        valorUnitario: saida.valorUnitario,
        usaQuantidade: saida.usaQuantidade,
        descricaoPadrao: saida.descricaoPadrao,
      })
    } else {
      setEditingSaida(null)
      setForm(EMPTY_FORM)
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) return
    setLoading(true)
    if (editingSaida) {
      await onUpdate({ id: editingSaida.id, ...form })
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

  const saidasFiltradas = filtroCategoria === 'all'
    ? saidas
    : saidas.filter(s => s.categoria === filtroCategoria)

  const getServidorNome = (id?: string) => id ? servidores.find(s => s.id === id)?.nome ?? '—' : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Saídas Rápidas</h3>
          <p className="text-sm text-muted-foreground">
            Configure categorias de saídas para lançamento rápido.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpen()} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Filtro por categoria */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Filtrar por categoria:</Label>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Servidor</TableHead>
              <TableHead className="text-right">Valor Unit.</TableHead>
              <TableHead className="text-center">Usa Qtd</TableHead>
              <TableHead>Descrição Padrão</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saidasFiltradas.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>{s.categoria}</TableCell>
                <TableCell>{getServidorNome(s.serverId)}</TableCell>
                <TableCell className="text-right">{formatCurrency(s.valorUnitario)}</TableCell>
                <TableCell className="text-center">{s.usaQuantidade ? '✓' : '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{s.descricaoPadrao || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpen(s)} disabled={loading}>
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
                          <AlertDialogTitle>Excluir saída rápida?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {saidasFiltradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma saída rápida cadastrada.
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
            <DialogTitle>{editingSaida ? 'Editar Saída Rápida' : 'Nova Saída Rápida'}</DialogTitle>
            <DialogDescription>
              Configure os detalhes da saída rápida.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Internet"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Servidor (opcional)</Label>
                <Select value={form.serverId || 'none'} onValueChange={v => setForm({ ...form, serverId: v === 'none' ? undefined : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {servidores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor Unitário</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valorUnitario || ''}
                  onChange={e => setForm({ ...form, valorUnitario: parseFloat(e.target.value) || 0 })}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição Padrão</Label>
              <Input
                value={form.descricaoPadrao}
                onChange={e => setForm({ ...form, descricaoPadrao: e.target.value })}
                placeholder="Ex: Pagamento de internet"
                disabled={loading}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="usaQuantidade"
                checked={form.usaQuantidade}
                onCheckedChange={v => setForm({ ...form, usaQuantidade: v === true })}
                disabled={loading}
              />
              <Label htmlFor="usaQuantidade" className="text-sm font-normal">
                Usa quantidade (multiplica valor unitário)
              </Label>
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
