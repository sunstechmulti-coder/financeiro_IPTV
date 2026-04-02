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
import { Checkbox } from '@/components/ui/checkbox'
import type { SaidaRapida, Servidor } from '@/lib/types'
import { addSaidaRapida, updateSaidaRapida, deleteSaidaRapida } from '@/lib/config-storage'
import { formatCurrency } from '@/lib/format'

interface SaidasRapidasListProps {
  saidas: SaidaRapida[]
  servidores: Servidor[]
  onChange: (list: SaidaRapida[]) => void
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

export function SaidasRapidasList({ saidas, servidores, onChange }: SaidasRapidasListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSaida, setEditingSaida] = useState<SaidaRapida | null>(null)
  const [form, setForm] = useState<Omit<SaidaRapida, 'id'>>(EMPTY_FORM)

  const isServidor = form.categoria === 'Servidor'

  // When servidor is selected, auto-fill nome and valor from server data
  const handleServidorChange = (sid: string) => {
    const srv = servidores.find((s) => s.id === sid)
    if (!srv) return
    setForm((prev) => ({
      ...prev,
      serverId: sid,
      nome: srv.nome,
      valorUnitario: srv.custoUnitario,
      usaQuantidade: true,
      descricaoPadrao: `Compra de créditos ${srv.nome}`,
    }))
  }

  const handleCategoriaChange = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categoria: cat,
      // reset server-specific fields when switching away from Servidor
      serverId: cat === 'Servidor' ? prev.serverId : undefined,
      usaQuantidade: cat === 'Servidor' ? true : prev.usaQuantidade,
    }))
  }

  const handleOpen = (s?: SaidaRapida) => {
    if (s) {
      setEditingSaida(s)
      setForm({
        nome: s.nome,
        categoria: s.categoria,
        serverId: s.serverId,
        valorUnitario: s.valorUnitario,
        usaQuantidade: s.usaQuantidade,
        descricaoPadrao: s.descricaoPadrao,
      })
    } else {
      setEditingSaida(null)
      setForm(EMPTY_FORM)
    }
    setDialogOpen(true)
  }

  const handleSave = () => {
    // Servidor category requires a server selection
    if (isServidor && !form.serverId) return
    if (!isServidor && !form.nome.trim()) return

    if (editingSaida) {
      onChange(updateSaidaRapida({ id: editingSaida.id, ...form }))
    } else {
      onChange(addSaidaRapida(form))
    }
    setDialogOpen(false)
  }

  const isSaveDisabled = isServidor ? !form.serverId : !form.nome.trim()

  const getServidorNome = (id?: string) =>
    servidores.find((s) => s.id === id)?.nome ?? id ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Saídas Rápidas</h3>
          <p className="text-sm text-muted-foreground">
            Categorias de saída pré-cadastradas para apontamento rápido.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpen()}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor Unit.</TableHead>
              <TableHead>Usa Qtd.</TableHead>
              <TableHead>Desc. Padrão</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saidas.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    s.categoria === 'Servidor'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {s.categoria}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {s.valorUnitario > 0 ? formatCurrency(s.valorUnitario) : '—'}
                </TableCell>
                <TableCell className="text-sm">{s.usaQuantidade ? 'Sim' : 'Não'}</TableCell>
                <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                  {s.descricaoPadrao || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpen(s)}>
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
                          <AlertDialogTitle>Excluir saída rápida</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{s.nome}</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onChange(deleteSaidaRapida(s.id))}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {saidas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhuma saída rápida cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingSaida ? 'Editar Saída Rápida' : 'Nova Saída Rápida'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Categoria first — drives the rest */}
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={handleCategoriaChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Servidor SELECT — only when categoria = Servidor */}
            {isServidor ? (
              <div className="grid gap-2">
                <Label>Servidor</Label>
                {servidores.length === 0 ? (
                  <p className="text-sm text-destructive">
                    Nenhum servidor cadastrado. Adicione um servidor primeiro.
                  </p>
                ) : (
                  <Select
                    value={form.serverId ?? ''}
                    onValueChange={handleServidorChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o servidor" />
                    </SelectTrigger>
                    <SelectContent>
                      {servidores.map((srv) => (
                        <SelectItem key={srv.id} value={srv.id}>
                          <span className="flex items-center justify-between gap-4">
                            <span>{srv.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(srv.custoUnitario)}/crédito
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  O nome, valor unitário e quantidade serão preenchidos automaticamente a partir do servidor.
                </p>
              </div>
            ) : (
              /* Manual name for non-server categories */
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Conta de Energia"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  autoFocus
                />
              </div>
            )}

            {/* Description */}
            <div className="grid gap-2">
              <Label>Descrição Padrão</Label>
              <Input
                placeholder="Descrição preenchida automaticamente"
                value={form.descricaoPadrao}
                onChange={(e) => setForm({ ...form, descricaoPadrao: e.target.value })}
              />
            </div>

            {/* Valor + Usa Quantidade — hidden for Servidor (auto from server) */}
            {!isServidor && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Valor Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0,00"
                    value={form.valorUnitario || ''}
                    onChange={(e) =>
                      setForm({ ...form, valorUnitario: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe 0 para informar manualmente
                  </p>
                </div>
                <div className="flex flex-col gap-2 justify-center">
                  <Label>Opções</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="usa-quantidade"
                      checked={form.usaQuantidade}
                      onCheckedChange={(v) => setForm({ ...form, usaQuantidade: v === true })}
                    />
                    <label htmlFor="usa-quantidade" className="text-sm">
                      Usa quantidade
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Preview for servidor */}
            {isServidor && form.serverId && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo automático</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{form.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo por crédito:</span>
                  <span className="font-medium">{formatCurrency(form.valorUnitario)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usa quantidade:</span>
                  <span className="font-medium">Sim (obrigatório)</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaveDisabled}>
              {editingSaida ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
