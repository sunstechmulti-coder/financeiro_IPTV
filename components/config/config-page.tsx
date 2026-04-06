'use client'

import { Settings, Server, LayoutList, ArrowDownCircle, Zap, UserCog, DollarSign } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServidoresList } from '@/components/config/servidores-list'
import { PlanosList } from '@/components/config/planos-list'
import { SaidasRapidasList } from '@/components/config/saidas-rapidas-list'
import { AtivacoesList } from '@/components/config/ativacoes-list'
import { RevendaConfig } from '@/components/config/revenda-config'
import { ChangePassword } from '@/components/config/change-password'
import type { Servidor, PlanoEntrada, SaidaRapida, ActivationProduct, RevendaGrupo } from '@/lib/types'

interface ConfigPageProps {
  servidores: Servidor[]
  planos: PlanoEntrada[]
  saidasRapidas: SaidaRapida[]
  activationProducts: ActivationProduct[]
  onAddServidor: (servidor: Omit<Servidor, 'id'>) => Promise<Servidor | null>
  onUpdateServidor: (servidor: Servidor) => Promise<Servidor | null>
  onDeleteServidor: (id: string) => Promise<boolean>
  onAddPlano: (plano: Omit<PlanoEntrada, 'id'>) => Promise<PlanoEntrada | null>
  onUpdatePlano: (plano: PlanoEntrada) => Promise<PlanoEntrada | null>
  onDeletePlano: (id: string) => Promise<boolean>
  onAddSaidaRapida: (saida: Omit<SaidaRapida, 'id'>) => Promise<SaidaRapida | null>
  onUpdateSaidaRapida: (saida: SaidaRapida) => Promise<SaidaRapida | null>
  onDeleteSaidaRapida: (id: string) => Promise<boolean>
  onAddActivationProduct: (product: Omit<ActivationProduct, 'id'>) => Promise<ActivationProduct | null>
  onUpdateActivationProduct: (product: ActivationProduct) => Promise<ActivationProduct | null>
  onDeleteActivationProduct: (id: string) => Promise<boolean>
  revendaGrupos: RevendaGrupo[]
  onAddRevendaGrupo: (grupo: Omit<RevendaGrupo, 'id'>) => Promise<RevendaGrupo | null>
  onUpdateRevendaGrupo: (grupo: RevendaGrupo) => Promise<boolean>
  onDeleteRevendaGrupo: (id: string) => Promise<boolean>
}

export function ConfigPage({
  servidores,
  planos,
  saidasRapidas,
  activationProducts,
  onAddServidor,
  onUpdateServidor,
  onDeleteServidor,
  onAddPlano,
  onUpdatePlano,
  onDeletePlano,
  onAddSaidaRapida,
  onUpdateSaidaRapida,
  onDeleteSaidaRapida,
  onAddActivationProduct,
  onUpdateActivationProduct,
  onDeleteActivationProduct,
  revendaGrupos,
  onAddRevendaGrupo,
  onUpdateRevendaGrupo,
  onDeleteRevendaGrupo,
}: ConfigPageProps) {
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
        <TabsList className="grid w-full grid-cols-6 max-w-2xl">
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
          <TabsTrigger value="revenda" className="gap-1.5">
            <DollarSign className="h-4 w-4" />
            Revenda
          </TabsTrigger>
          <TabsTrigger value="conta" className="gap-1.5">
            <UserCog className="h-4 w-4" />
            Conta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servidores" className="mt-6">
          <ServidoresList 
            servidores={servidores} 
            onAdd={onAddServidor}
            onUpdate={onUpdateServidor}
            onDelete={onDeleteServidor}
          />
        </TabsContent>

        <TabsContent value="planos" className="mt-6">
          <PlanosList 
            planos={planos} 
            servidores={servidores} 
            onAdd={onAddPlano}
            onUpdate={onUpdatePlano}
            onDelete={onDeletePlano}
          />
        </TabsContent>

        <TabsContent value="saidas" className="mt-6">
          <SaidasRapidasList 
            saidas={saidasRapidas} 
            servidores={servidores} 
            onAdd={onAddSaidaRapida}
            onUpdate={onUpdateSaidaRapida}
            onDelete={onDeleteSaidaRapida}
          />
        </TabsContent>

        <TabsContent value="ativacoes" className="mt-6">
          <AtivacoesList 
            products={activationProducts} 
            servidores={servidores} 
            onAdd={onAddActivationProduct}
            onUpdate={onUpdateActivationProduct}
            onDelete={onDeleteActivationProduct}
          />
        </TabsContent>

        <TabsContent value="revenda" className="mt-6">
          <RevendaConfig
            grupos={revendaGrupos}
            servidores={servidores}
            onAdd={onAddRevendaGrupo}
            onUpdate={onUpdateRevendaGrupo}
            onDelete={onDeleteRevendaGrupo}
          />
        </TabsContent>

        <TabsContent value="conta" className="mt-6">
          <ChangePassword />
        </TabsContent>
      </Tabs>
    </div>
  )
}
