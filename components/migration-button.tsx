'use client'

import { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'

interface MigrationButtonProps {
  onMigrationComplete: () => void
}

export function MigrationButton({ onMigrationComplete }: MigrationButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const supabase = createClient()

  const handleMigrate = async () => {
    setLoading(true)
    setResult(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setResult('Erro: Usuário não autenticado')
        setLoading(false)
        return
      }

      // Read data from localStorage
      const getAllLocalStorageData = () => {
        const data: Record<string, unknown> = {}
        
        // Try different key patterns used by the old system
        const patterns = [
          'cashflow:',
          'cf_',
          'transactions',
          'servidores',
          'planos',
          'saidas',
          'credits',
          'activation',
        ]

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            const matchesPattern = patterns.some(p => key.toLowerCase().includes(p))
            if (matchesPattern) {
              try {
                const value = localStorage.getItem(key)
                if (value) {
                  data[key] = JSON.parse(value)
                }
              } catch {
                // Skip non-JSON values
              }
            }
          }
        }
        return data
      }

      const localData = getAllLocalStorageData()
      
      // Extract data from localStorage
      let transactions: unknown[] = []
      let servidores: unknown[] = []
      let planos: unknown[] = []
      let saidasRapidas: unknown[] = []
      let creditMovements: unknown[] = []
      let activationProducts: unknown[] = []
      let activationTransactions: unknown[] = []

      // Try to find the data in various key formats
      Object.entries(localData).forEach(([key, value]) => {
        const keyLower = key.toLowerCase()
        if (Array.isArray(value)) {
          if (keyLower.includes('transaction') && !keyLower.includes('activation')) {
            transactions = [...transactions, ...value]
          } else if (keyLower.includes('servidor')) {
            servidores = [...servidores, ...value]
          } else if (keyLower.includes('plano')) {
            planos = [...planos, ...value]
          } else if (keyLower.includes('saida')) {
            saidasRapidas = [...saidasRapidas, ...value]
          } else if (keyLower.includes('credit') && keyLower.includes('movement')) {
            creditMovements = [...creditMovements, ...value]
          } else if (keyLower.includes('activation') && keyLower.includes('product')) {
            activationProducts = [...activationProducts, ...value]
          } else if (keyLower.includes('activation') && keyLower.includes('transaction')) {
            activationTransactions = [...activationTransactions, ...value]
          }
        }
      })

      // Check if we found any data
      const totalItems = transactions.length + servidores.length + planos.length + 
                        saidasRapidas.length + creditMovements.length + 
                        activationProducts.length + activationTransactions.length

      if (totalItems === 0) {
        setResult('Nenhum dado encontrado no localStorage para migrar.')
        setLoading(false)
        return
      }

      // Send to migration API
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactions,
          servidores,
          planos,
          saidasRapidas,
          creditMovements,
          activationProducts,
          activationTransactions,
        }),
      })

      const apiResult = await response.json()

      if (apiResult.success) {
        setResult(`Migração concluída! ${JSON.stringify(apiResult.counts)}`)
        onMigrationComplete()
      } else {
        setResult(`Erro: ${apiResult.error}`)
      }
    } catch (err) {
      setResult(`Erro na migração: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Migrar Dados Locais
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Migrar Dados do Navegador</DialogTitle>
          <DialogDescription>
            Esta ação irá copiar os dados salvos no seu navegador (localStorage) 
            para o banco de dados na nuvem (Supabase). Seus dados atuais no 
            navegador não serão apagados.
          </DialogDescription>
        </DialogHeader>
        
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.includes('Erro') ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
            {result}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleMigrate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrando...
              </>
            ) : (
              'Iniciar Migração'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
