'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parsePrintingAmount } from '@/lib/activity'
import type { Transaction } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  activitySelector?: ReactNode
  onSave: (transaction: Transaction) => Promise<boolean>
}

export function PrintingTransactionDialog({ open, onOpenChange, transaction, activitySelector, onSave }: Props) {
  const [date, setDate] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [description, setDescription] = useState('')
  const [customer, setCustomer] = useState('')
  const [product, setProduct] = useState('')
  const [category, setCategory] = useState('')
  const [payment, setPayment] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!open) return
    setDate(transaction?.date || format(new Date(), 'yyyy-MM-dd'))
    setType(transaction?.type || 'income')
    setDescription(transaction?.description || '')
    setCustomer(transaction?.printingDetails?.customerName || '')
    setProduct(transaction?.printingDetails?.productName || '')
    setCategory(transaction?.printingDetails?.category || '')
    setPayment(transaction?.printingDetails?.paymentMethod || '')
    setAmount(transaction ? Number(transaction.amount).toFixed(2).replace('.', ',') : '')
    setError('')
  }, [open, transaction])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const numericAmount = parsePrintingAmount(amount)
    if (!date || !description.trim() || numericAmount === null) {
      setError('Informe a data, a descrição e um valor válido maior que zero.')
      return
    }
    inFlight.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await onSave({
        ...transaction,
        id: transaction?.id || crypto.randomUUID(),
        createdAt: transaction?.createdAt || new Date().toISOString(),
        date, type, description: description.trim(), amount: numericAmount,
        activity: 'printing_3d',
        serverId: undefined, creditsDelta: undefined,
        printingDetails: {
          customerName: customer.trim(), productName: product.trim(),
          category: category.trim(), paymentMethod: payment.trim(),
        },
      })
      if (!saved) throw new Error('save_failed')
      onOpenChange(false)
    } catch {
      setError('Não foi possível salvar. Confira a conexão e tente novamente; o formulário foi mantido.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!inFlight.current) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar lançamento 3D' : 'Novo lançamento 3D'}</DialogTitle>
          <DialogDescription>Registre o valor recebido ou uma despesa da impressão 3D.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={saving}>{activitySelector}</fieldset>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="printing-date">Data</Label>
                <Input id="printing-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printing-type">Tipo</Label>
                <select id="printing-type" value={type} onChange={e => setType(e.target.value as 'income' | 'expense')}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="income">Entrada / venda</option><option value="expense">Saída / despesa</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="printing-description">Descrição</Label>
              <Input id="printing-description" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            {type === 'income' && <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="printing-customer">Cliente (opcional)</Label>
                <Input id="printing-customer" maxLength={150} value={customer} onChange={e => setCustomer(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="printing-product">Peça / produto (opcional)</Label>
                <Input id="printing-product" maxLength={150} value={product} onChange={e => setProduct(e.target.value)} /></div>
            </div>}
            <div className="space-y-2">
              <Label htmlFor="printing-category">{type === 'expense' ? 'Categoria da despesa' : 'Categoria'} (opcional)</Label>
              <Input id="printing-category" list="printing-categories" maxLength={100} value={category} onChange={e => setCategory(e.target.value)} />
              <datalist id="printing-categories"><option value="Filamentos" /><option value="Embalagens" /><option value="Manutenção" /><option value="Outros" /></datalist>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="printing-amount">Valor (R$)</Label>
                <Input id="printing-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="printing-payment">Pagamento (opcional)</Label>
                <Input id="printing-payment" list="printing-payments" maxLength={100} value={payment} onChange={e => setPayment(e.target.value)} />
                <datalist id="printing-payments"><option value="Pix" /><option value="Dinheiro" /><option value="Cartão" /><option value="Transferência" /></datalist></div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar lançamento 3D'}</Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
