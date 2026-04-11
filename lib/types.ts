export interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  description: string
  amount: number
  createdAt: string
  serverId?: string
  creditsDelta?: number
  unitCostSnapshot?: number
  costSnapshot?: number
  profitSnapshot?: number
}

export type SortDirection = 'asc' | 'desc'
export type FilterType = 'all' | 'income' | 'expense'

// --- Configurações ---

export interface Servidor {
  id: string
  nome: string
  custoUnitario: number
  creditsBalance: number // estoque de créditos
  permiteVendaFracionada?: boolean // permite quantidades decimais
  supplierWhatsapp?: string
  riskCredits?: number
  rechargeQuantity?: number
}

export interface PlanoEntrada {
  id: string
  codigo: string
  descricao: string
  servidorId: string
  tipo: 'renovacao' | 'novo'
  meses: number
  validadeTipo: 'dias' | 'meses'
  validadeQuantidade: number
  creditos: number
  valorVenda: number
  custo: number
}

export interface SaidaRapida {
  id: string
  nome: string
  categoria: string
  // When categoria === 'Servidor', serverId is required
  serverId?: string
  valorUnitario: number
  usaQuantidade: boolean
  descricaoPadrao: string
}

export interface CreditMovement {
  id: string
  serverId: string
  date: string
  type: 'purchase' | 'sale'  // purchase = saída (compra créditos), sale = entrada (venda plano)
  credits: number            // sempre positivo
  transactionId: string
}

// ─── Ativações ───────────────────────────────────────────────────────────────

export interface PricingRule {
  minCost: number  // custo mínimo da faixa (inclusivo)
  maxCost: number  // custo máximo da faixa (inclusivo)
  salePrice: number
}

export interface ActivationProduct {
  id: string
  nome: string
  validadeMeses: number
  custosPermitidos: number[]   // ex: [0.5, 0.6, ..., 1.9]
  regrasPreco: PricingRule[]
  linkedServerId?: string      // servidor cujo creditsBalance é consumido ao vender
}

export interface ActivationTransaction {
  id: string
  date: string
  productId: string
  productNome: string
  custo: number
  valorVenda: number
  lucro: number
  transactionId: string  // referência para a Transaction de income
  createdAt: string
}

// ─── Revenda de Créditos ─────────────────────────────────────────────────────

export interface RevendaFaixa {
  min: number
  max: number
  preco: number
}

export interface RevendaGrupo {
  id: string
  nome: string
  servidorIds: string[]
  faixas: RevendaFaixa[]
}