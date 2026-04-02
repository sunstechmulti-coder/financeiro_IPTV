'use client'

import { useState, useEffect } from 'react'
import { Settings, Server, LayoutList, ArrowDownCircle, Zap } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServidoresList } from '@/components/config/servidores-list'
import { PlanosList } from '@/components/config/planos-list'
import { SaidasRapidasList } from '@/components/config/saidas-rapidas-list'
import { AtivacoesList } from '@/components/config/ativacoes-list'
import type { Servidor, PlanoEntrada, SaidaRapida, ActivationProduct } from '@/lib/types'
import {
  getServidores,
  getPlanos,
  getSaidasRapidas,
} from '@/lib/config-storage'
import { getActivationProducts } from '@/lib/activation-storage'

export function ConfigPage() {
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [planos, setPlanos] = useState<PlanoEntrada[]>([])
  const [saidas, setSaidas] = useState<SaidaRapida[]>([])
  const [ativacoes, setAtivacoes] = useState<ActivationProduct[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setServidores(getServidores())
    setPlanos(getPlanos())
    setSaidas(getSaidasRapidas())
    setAtivacoes(getActivationProducts())
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Configurações</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie servidores, planos, saídas e ativações.
          </p>
        </div>
      </div>

      <Tabs defaultValue="servidores">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="servidores" className="gap-1.5">
            <Server className="h-4 w-4" />
            Servidores
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-1.5">
            <LayoutList className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="saidas" className="gap-1.5">
            <ArrowDownCircle className="h-4 w-4" />
            Saídas
          </TabsTrigger>
          <TabsTrigger value="ativacoes" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Ativações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servidores" className="mt-6">
          <ServidoresList servidores={servidores} onChange={setServidores} />
        </TabsContent>

        <TabsContent value="planos" className="mt-6">
          <PlanosList planos={planos} servidores={servidores} onChange={setPlanos} />
        </TabsContent>

        <TabsContent value="saidas" className="mt-6">
          <SaidasRapidasList saidas={saidas} servidores={servidores} onChange={setSaidas} />
        </TabsContent>

        <TabsContent value="ativacoes" className="mt-6">
          <AtivacoesList products={ativacoes} servidores={servidores} onChange={setAtivacoes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
