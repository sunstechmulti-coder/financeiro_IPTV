/**
 * Supabase Database Service
 * Handles all CRUD operations with Supabase
 */
import { createClient } from '@/lib/supabase/client'
import type { 
  Transaction, 
  Servidor, 
  PlanoEntrada, 
  SaidaRapida, 
  CreditMovement,
  ActivationProduct,
  ActivationTransaction
} from './types'

// ─── Transactions ────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<Transaction[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }

  return (data || []).map(mapTransactionFromDB)
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      date: transaction.date,
      type: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      server_id: transaction.serverId || null,
      credits_delta: transaction.creditsDelta || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding transaction:', error)
    return null
  }

  return mapTransactionFromDB(data)
}

export async function updateTransaction(transaction: Transaction): Promise<Transaction | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('transactions')
    .update({
      date: transaction.date,
      type: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      server_id: transaction.serverId || null,
      credits_delta: transaction.creditsDelta || null,
    })
    .eq('id', transaction.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating transaction:', error)
    return null
  }

  return mapTransactionFromDB(data)
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting transaction:', error)
    return false
  }

  return true
}

// ─── Servidores ──────────────────────────────────────────────────────────────

export async function getServidores(): Promise<Servidor[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('servidores')
    .select('*')
    .eq('user_id', user.id)
    .order('nome')

  if (error) {
    console.error('Error fetching servidores:', error)
    return []
  }

  return (data || []).map(mapServidorFromDB)
}

export async function addServidor(servidor: Omit<Servidor, 'id'>): Promise<Servidor | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('servidores')
    .insert({
      user_id: user.id,
      nome: servidor.nome,
      custo_unitario: servidor.custoUnitario,
      credits_balance: servidor.creditsBalance,
      permite_venda_fracionada: servidor.permiteVendaFracionada || false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding servidor:', error)
    return null
  }

  return mapServidorFromDB(data)
}

export async function updateServidor(servidor: Servidor): Promise<Servidor | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('servidores')
    .update({
      nome: servidor.nome,
      custo_unitario: servidor.custoUnitario,
      credits_balance: servidor.creditsBalance,
      permite_venda_fracionada: servidor.permiteVendaFracionada || false,
    })
    .eq('id', servidor.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating servidor:', error)
    return null
  }

  return mapServidorFromDB(data)
}

export async function deleteServidor(id: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('servidores')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting servidor:', error)
    return false
  }

  return true
}

export async function adjustCreditsBalance(serverId: string, delta: number): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // First get current balance
  const { data: servidor } = await supabase
    .from('servidores')
    .select('credits_balance')
    .eq('id', serverId)
    .eq('user_id', user.id)
    .single()

  if (!servidor) return false

  const newBalance = Math.max(0, (servidor.credits_balance || 0) + delta)

  const { error } = await supabase
    .from('servidores')
    .update({ credits_balance: newBalance })
    .eq('id', serverId)
    .eq('user_id', user.id)

  return !error
}

// ─── Planos ──────────────────────────────────────────────────────────────────

export async function getPlanos(): Promise<PlanoEntrada[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('planos')
    .select('*')
    .eq('user_id', user.id)
    .order('codigo')

  if (error) {
    console.error('Error fetching planos:', error)
    return []
  }

  return (data || []).map(mapPlanoFromDB)
}

export async function addPlano(plano: Omit<PlanoEntrada, 'id'>): Promise<PlanoEntrada | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('planos')
    .insert({
      user_id: user.id,
      codigo: plano.codigo,
      descricao: plano.descricao,
      servidor_id: plano.servidorId,
      tipo: plano.tipo,
      meses: plano.meses,
      creditos: plano.creditos,
      valor_venda: plano.valorVenda,
      custo: plano.custo,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding plano:', error)
    return null
  }

  return mapPlanoFromDB(data)
}

export async function updatePlano(plano: PlanoEntrada): Promise<PlanoEntrada | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('planos')
    .update({
      codigo: plano.codigo,
      descricao: plano.descricao,
      servidor_id: plano.servidorId,
      tipo: plano.tipo,
      meses: plano.meses,
      creditos: plano.creditos,
      valor_venda: plano.valorVenda,
      custo: plano.custo,
    })
    .eq('id', plano.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating plano:', error)
    return null
  }

  return mapPlanoFromDB(data)
}

export async function deletePlano(id: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('planos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  return !error
}

// ─── Saídas Rápidas ──────────────────────────────────────────────────────────

export async function getSaidasRapidas(): Promise<SaidaRapida[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('saidas_rapidas')
    .select('*')
    .eq('user_id', user.id)
    .order('nome')

  if (error) {
    console.error('Error fetching saidas rapidas:', error)
    return []
  }

  return (data || []).map(mapSaidaRapidaFromDB)
}

export async function addSaidaRapida(saida: Omit<SaidaRapida, 'id'>): Promise<SaidaRapida | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('saidas_rapidas')
    .insert({
      user_id: user.id,
      nome: saida.nome,
      categoria: saida.categoria,
      server_id: saida.serverId || null,
      valor_unitario: saida.valorUnitario,
      usa_quantidade: saida.usaQuantidade,
      descricao_padrao: saida.descricaoPadrao,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding saida rapida:', error)
    return null
  }

  return mapSaidaRapidaFromDB(data)
}

export async function updateSaidaRapida(saida: SaidaRapida): Promise<SaidaRapida | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('saidas_rapidas')
    .update({
      nome: saida.nome,
      categoria: saida.categoria,
      server_id: saida.serverId || null,
      valor_unitario: saida.valorUnitario,
      usa_quantidade: saida.usaQuantidade,
      descricao_padrao: saida.descricaoPadrao,
    })
    .eq('id', saida.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating saida rapida:', error)
    return null
  }

  return mapSaidaRapidaFromDB(data)
}

export async function deleteSaidaRapida(id: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('saidas_rapidas')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  return !error
}

// ─── Credit Movements ────────────────────────────────────────────────────────

export async function getCreditMovements(): Promise<CreditMovement[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('credit_movements')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching credit movements:', error)
    return []
  }

  return (data || []).map(mapCreditMovementFromDB)
}

export async function addCreditMovement(movement: Omit<CreditMovement, 'id'>): Promise<CreditMovement | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('credit_movements')
    .insert({
      user_id: user.id,
      server_id: movement.serverId,
      date: movement.date,
      type: movement.type,
      credits: movement.credits,
      transaction_id: movement.transactionId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding credit movement:', error)
    return null
  }

  return mapCreditMovementFromDB(data)
}

export async function removeCreditMovementByTransaction(transactionId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('credit_movements')
    .delete()
    .eq('transaction_id', transactionId)
    .eq('user_id', user.id)

  return !error
}

// ─── Activation Products ─────────────────────────────────────────────────────

export async function getActivationProducts(): Promise<ActivationProduct[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('activation_products')
    .select('*')
    .eq('user_id', user.id)
    .order('nome')

  if (error) {
    console.error('Error fetching activation products:', error)
    return []
  }

  return (data || []).map(mapActivationProductFromDB)
}

export async function addActivationProduct(product: Omit<ActivationProduct, 'id'>): Promise<ActivationProduct | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('activation_products')
    .insert({
      user_id: user.id,
      nome: product.nome,
      validade_meses: product.validadeMeses,
      custos_permitidos: product.custosPermitidos,
      regras_preco: product.regrasPreco,
      linked_server_id: product.linkedServerId || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding activation product:', error)
    return null
  }

  return mapActivationProductFromDB(data)
}

// ─── Activation Transactions ─────────────────────────────────────────────────

export async function getActivationTransactions(): Promise<ActivationTransaction[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('activation_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching activation transactions:', error)
    return []
  }

  return (data || []).map(mapActivationTransactionFromDB)
}

export async function addActivationTransaction(
  trans: Omit<ActivationTransaction, 'id' | 'createdAt'>
): Promise<ActivationTransaction | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('activation_transactions')
    .insert({
      user_id: user.id,
      date: trans.date,
      product_id: trans.productId,
      product_nome: trans.productNome,
      custo: trans.custo,
      valor_venda: trans.valorVenda,
      lucro: trans.lucro,
      transaction_id: trans.transactionId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding activation transaction:', error)
    return null
  }

  return mapActivationTransactionFromDB(data)
}

// ─── Seed Initial Data ───────────────────────────────────────────────────────

export async function seedInitialData(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Check if user already has data
  const { data: existingServidores } = await supabase
    .from('servidores')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (existingServidores && existingServidores.length > 0) {
    return true // Already seeded
  }

  // Seed servidores
  const servidores = [
    { nome: 'P2Cine', custo_unitario: 5.00, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'BR PRO', custo_unitario: 5.00, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'BOX', custo_unitario: 4.10, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'P2BRAZ', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'WAREZ', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'FIRE', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'BRAZIL', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
    { nome: 'ATIVA APP', custo_unitario: 13.00, credits_balance: 0, permite_venda_fracionada: true },
  ]

  const { data: insertedServidores, error: servidorError } = await supabase
    .from('servidores')
    .insert(servidores.map(s => ({ ...s, user_id: user.id })))
    .select()

  if (servidorError) {
    console.error('Error seeding servidores:', servidorError)
    return false
  }

  // Create servidor ID map
  const servidorMap: Record<string, string> = {}
  insertedServidores?.forEach(s => {
    const key = s.nome.toLowerCase().replace(/\s+/g, '')
    servidorMap[key] = s.id
  })

  // Seed saidas rapidas
  const saidasRapidas = [
    { nome: 'P2Cine', categoria: 'Servidor', server_id: servidorMap['p2cine'], valor_unitario: 5.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos P2Cine' },
    { nome: 'BR PRO', categoria: 'Servidor', server_id: servidorMap['brpro'], valor_unitario: 5.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos BR PRO' },
    { nome: 'BOX', categoria: 'Servidor', server_id: servidorMap['box'], valor_unitario: 4.10, usa_quantidade: true, descricao_padrao: 'Compra de créditos BOX' },
    { nome: 'P2BRAZ', categoria: 'Servidor', server_id: servidorMap['p2braz'], valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos P2BRAZ' },
    { nome: 'WAREZ', categoria: 'Servidor', server_id: servidorMap['warez'], valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos WAREZ' },
    { nome: 'FIRE', categoria: 'Servidor', server_id: servidorMap['fire'], valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos FIRE' },
    { nome: 'BRAZIL', categoria: 'Servidor', server_id: servidorMap['brazil'], valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos BRAZIL' },
    { nome: 'Aplicativo', categoria: 'Operacional', server_id: null, valor_unitario: 0, usa_quantidade: false, descricao_padrao: 'Assinatura de aplicativo' },
    { nome: 'Internet', categoria: 'Operacional', server_id: null, valor_unitario: 0, usa_quantidade: false, descricao_padrao: 'Conta de internet' },
    { nome: 'Energia', categoria: 'Operacional', server_id: null, valor_unitario: 0, usa_quantidade: false, descricao_padrao: 'Conta de energia' },
    { nome: 'Marketing', categoria: 'Marketing', server_id: null, valor_unitario: 0, usa_quantidade: false, descricao_padrao: 'Gasto com marketing' },
    { nome: 'Comissão', categoria: 'Pessoal', server_id: null, valor_unitario: 0, usa_quantidade: false, descricao_padrao: 'Pagamento de comissão' },
    { nome: 'Outros', categoria: 'Outros', server_id: null, valor_unitario: 0, usa_quantidade: false, descricao_padrao: 'Outros custos' },
  ]

  await supabase
    .from('saidas_rapidas')
    .insert(saidasRapidas.map(s => ({ ...s, user_id: user.id })))

  // Seed activation products
  const activationProducts = [
    {
      nome: 'ATIVA APP',
      validade_meses: 12,
      linked_server_id: servidorMap['ativaapp'],
      custos_permitidos: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
      regras_preco: [
        { minCost: 0.5, maxCost: 1.0, salePrice: 20.00 },
        { minCost: 1.1, maxCost: 1.9, salePrice: 25.00 },
      ],
    },
  ]

  await supabase
    .from('activation_products')
    .insert(activationProducts.map(p => ({ ...p, user_id: user.id })))

  return true
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransactionFromDB(data: any): Transaction {
  return {
    id: data.id,
    date: data.date,
    type: data.type,
    description: data.description,
    amount: data.amount,
    createdAt: data.created_at,
    serverId: data.server_id,
    creditsDelta: data.credits_delta,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapServidorFromDB(data: any): Servidor {
  return {
    id: data.id,
    nome: data.nome,
    custoUnitario: data.custo_unitario,
    creditsBalance: data.credits_balance,
    permiteVendaFracionada: data.permite_venda_fracionada,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlanoFromDB(data: any): PlanoEntrada {
  return {
    id: data.id,
    codigo: data.codigo,
    descricao: data.descricao,
    servidorId: data.servidor_id,
    tipo: data.tipo,
    meses: data.meses,
    creditos: data.creditos,
    valorVenda: data.valor_venda,
    custo: data.custo,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSaidaRapidaFromDB(data: any): SaidaRapida {
  return {
    id: data.id,
    nome: data.nome,
    categoria: data.categoria,
    serverId: data.server_id,
    valorUnitario: data.valor_unitario,
    usaQuantidade: data.usa_quantidade,
    descricaoPadrao: data.descricao_padrao,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCreditMovementFromDB(data: any): CreditMovement {
  return {
    id: data.id,
    serverId: data.server_id,
    date: data.date,
    type: data.type,
    credits: data.credits,
    transactionId: data.transaction_id,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivationProductFromDB(data: any): ActivationProduct {
  return {
    id: data.id,
    nome: data.nome,
    validadeMeses: data.validade_meses,
    custosPermitidos: data.custos_permitidos,
    regrasPreco: data.regras_preco,
    linkedServerId: data.linked_server_id,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivationTransactionFromDB(data: any): ActivationTransaction {
  return {
    id: data.id,
    date: data.date,
    productId: data.product_id,
    productNome: data.product_nome,
    custo: data.custo,
    valorVenda: data.valor_venda,
    lucro: data.lucro,
    transactionId: data.transaction_id,
    createdAt: data.created_at,
  }
}
