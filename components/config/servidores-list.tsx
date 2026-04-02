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
import { addServidor, updateServidor, deleteServidor } from '@/lib/config-storage'
import { formatCurrency } from '@/lib/format'

interface ServidoresListProps {
  servidores: Servidor[]
  onChange: (list: Servidor[]) => void
}

const EMPTY: Omit<Servidor, 'id'> = {
  nome: '',
  custoUnitario: 0,
  creditsBalance: 0,
  permiteVendaFracionada: false,
}

export function ServidoresList({ servidores, onChange }: ServidoresListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<Servidor, 'id'>>(EMPTY)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Omit<Servidor, 'id'>>(EMPTY)

  const handleEdit = (s: Servidor) => {
    setEditingId(s.id)
    setEditForm({
      nome: s.nome,
      custoUnitario: s.custoUnitario,
      creditsBalance: s.creditsBalance ?? 0,
      permiteVendaFracionada: s.permiteVendaFracionada ?? false,
    })
  }

  const handleEditSave = (id: string) => {
    if (!editForm.nome.trim()) return
    onChange(updateServidor({ id, ...editForm }))
    setEditingId(null)
  }

  const handleEditCancel = () => setEditingId(null)

  const handleAdd = () => {
    if (!addForm.nome.trim()) return
    onChange(addServidor(addForm))
    setAddForm(EMPTY)
    setShowAdd(false)
  }

  const handleDelete = (id: string) => onChange(deleteServidor(id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Servidores</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os servidores, custos e saldo de créditos.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Custo Unitário</TableHead>
              <TableHead className="text-center">Fracionado</TableHead>
              <TableHead className="text-right">Créditos Disponíveis</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ── Linha de adição ── */}
            {showAdd && (
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="Nome do servidor"
                    value={addForm.nome}
                    onChange={(e) => setAddForm({ ...addForm, nome: e.target.value })}
                    className="h-8"
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={addForm.custoUnitario || ''}
                    onChange={(e) =>
                      setAddForm({ ...addForm, custoUnitario: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 w-28"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={addForm.permiteVendaFracionada ?? false}
                    onCheckedChange={(v) =>
                      setAddForm({ ...addForm, permiteVendaFracionada: v === true })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={addForm.creditsBalance || ''}
                    onChange={(e) =>
                      setAddForm({ ...addForm, creditsBalance: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 w-24 ml-auto block"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd}>
                      <Check className="h-4 w-4 text-income" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { setShowAdd(false); setAddForm(EMPTY) }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {servidores.map((s) =>
              editingId === s.id ? (
                /* ── Linha de edição ── */
                <TableRow key={s.id}>
                  <TableCell>
                    <Input
                      value={editForm.nome}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      className="h-8"
                      autoFocus
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.custoUnitario || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, custoUnitario: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 w-28"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={editForm.permiteVendaFracionada ?? false}
                      onCheckedChange={(v) =>
                        setEditForm({ ...editForm, permiteVendaFracionada: v === true })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      value={editForm.creditsBalance ?? 0}
                      onChange={(e) =>
                        setEditForm({ ...editForm, creditsBalance: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 w-24 ml-auto block"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEditSave(s.id)}
                      >
                        <Check className="h-4 w-4 text-income" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={handleEditCancel}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                /* ── Linha normal ── */
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>{formatCurrency(s.custoUnitario)}</TableCell>
                  <TableCell className="text-center">
                    {s.permiteVendaFracionada ? (
                      <span className="text-xs font-medium text-income">Sim</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        (s.creditsBalance ?? 0) > 0 ? 'text-income' : 'text-muted-foreground'
                      }`}
                    >
                      {(s.creditsBalance ?? 0).toLocaleString('pt-BR')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEdit(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir servidor</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir <strong>{s.nome}</strong>? Os planos
                              vinculados deixarão de funcionar.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(s.id)}
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
              )
            )}

            {servidores.length === 0 && !showAdd && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
