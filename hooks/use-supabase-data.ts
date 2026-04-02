'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { 
  Transaction, 
  Servidor, 
  PlanoEntrada, 
  SaidaRapida, 
  CreditMovement,
  ActivationProduct,
  ActivationTransaction
} from '@/lib/types'

// Hook to manage all Supabase data with real-time sync
export function useSupabaseData() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [planos, setPlanos] = useState<PlanoEntrada[]>([])
  const [saidasRapidas, setSaidasRapidas] = useState<SaidaRapida[]>([])
  const [creditMovements, setCreditMovements] = useState<CreditMovement[]>([])
  const [activationProducts, setActivationProducts] = useState<ActivationProduct[]>([])
  const [activationTransactions, setActivationTransactions] = useState<ActivationTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  
  const supabase = createClient()

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)

    // Fetch servidores
    const { data: servidoresData } = await supabase
      .from('servidores')
      .select('*')
      .order('nome')
    
    if (servidoresData) {
      setServidores(servidoresData.map(mapServidorFromDB))
    }

    // Fetch transactions
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
    
    if (transactionsData) {
      setTransactions(transactionsData.map(mapTransactionFromDB))
    }

    // Fetch planos
    const { data: planosData } = await supabase
      .from('planos')
      .select('*')
      .order('codigo')
    
    if (planosData) {
      setPlanos(planosData.map(mapPlanoFromDB))
    }

    // Fetch saidas rapidas
    const { data: saidasData } = await supabase
      .from('saidas_rapidas')
      .select('*')
      .order('nome')
    
    if (saidasData) {
      setSaidasRapidas(saidasData.map(mapSaidaRapidaFromDB))
    }

    // Fetch credit movements
    const { data: movementsData } = await supabase
      .from('credit_movements')
      .select('*')
      .order('date', { ascending: false })
    
    if (movementsData) {
      setCreditMovements(movementsData.map(mapCreditMovementFromDB))
    }

    // Fetch activation products
    const { data: productsData } = await supabase
      .from('activation_products')
      .select('*')
      .order('nome')
    
    if (productsData) {
      setActivationProducts(productsData.map(mapActivationProductFromDB))
    }

    // Fetch activation transactions
    const { data: actTxData } = await supabase
      .from('activation_transactions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (actTxData) {
      setActivationTransactions(actTxData.map(mapActivationTransactionFromDB))
    }

    setLoading(false)
  }, [supabase])

  // Seed default data if user has none
  const seedDefaultData = useCallback(async () => {
    if (!userId || servidores.length > 0) return

    const response = await fetch(`/api/migrate?userId=${userId}`)
    const result = await response.json()
    
    if (result.seeded) {
      fetchAllData()
    }
  }, [userId, servidores.length, fetchAllData])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  useEffect(() => {
    if (!loading && userId && servidores.length === 0) {
      seedDefaultData()
    }
  }, [loading, userId, servidores.length, seedDefaultData])

  // ─── Transaction operations ────────────────────────────────────────────────
  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        date: transaction.date,
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
        server_id: transaction.serverId || null,
        credits_delta: transaction.creditsDelta || null,
      })
      .select()
      .single()

    if (error || !data) return null

    const newTx = mapTransactionFromDB(data)
    setTransactions(prev => [newTx, ...prev])
    return newTx
  }

  const updateTransaction = async (transaction: Transaction): Promise<Transaction | null> => {
    if (!userId) return null

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
      .select()
      .single()

    if (error || !data) return null

    const updatedTx = mapTransactionFromDB(data)
    setTransactions(prev => prev.map(t => t.id === transaction.id ? updatedTx : t))
    return updatedTx
  }

  const deleteTransaction = async (id: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) return false

    setTransactions(prev => prev.filter(t => t.id !== id))
    return true
  }

  // ─── Servidor operations ───────────────────────────────────────────────────
  const addServidor = async (servidor: Omit<Servidor, 'id'>): Promise<Servidor | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('servidores')
      .insert({
        user_id: userId,
        nome: servidor.nome,
        custo_unitario: servidor.custoUnitario,
        credits_balance: servidor.creditsBalance || 0,
        permite_venda_fracionada: servidor.permiteVendaFracionada || false,
      })
      .select()
      .single()

    if (error || !data) return null

    const newServidor = mapServidorFromDB(data)
    setServidores(prev => [...prev, newServidor].sort((a, b) => a.nome.localeCompare(b.nome)))
    return newServidor
  }

  const updateServidor = async (servidor: Servidor): Promise<Servidor | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('servidores')
      .update({
        nome: servidor.nome,
        custo_unitario: servidor.custoUnitario,
        credits_balance: servidor.creditsBalance,
        permite_venda_fracionada: servidor.permiteVendaFracionada || false,
      })
      .eq('id', servidor.id)
      .select()
      .single()

    if (error || !data) return null

    const updatedServidor = mapServidorFromDB(data)
    setServidores(prev => prev.map(s => s.id === servidor.id ? updatedServidor : s))
    return updatedServidor
  }

  const deleteServidor = async (id: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('servidores')
      .delete()
      .eq('id', id)

    if (error) return false

    setServidores(prev => prev.filter(s => s.id !== id))
    return true
  }

  const adjustCreditsBalance = async (serverId: string, delta: number): Promise<boolean> => {
    const servidor = servidores.find(s => s.id === serverId)
    if (!servidor) return false

    const newBalance = Math.max(0, servidor.creditsBalance + delta)
    
    const { error } = await supabase
      .from('servidores')
      .update({ credits_balance: newBalance })
      .eq('id', serverId)

    if (error) return false

    setServidores(prev => prev.map(s => 
      s.id === serverId ? { ...s, creditsBalance: newBalance } : s
    ))
    return true
  }

  // ─── Plano operations ──────────────────────────────────────────────────────
  const addPlano = async (plano: Omit<PlanoEntrada, 'id'>): Promise<PlanoEntrada | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('planos')
      .insert({
        user_id: userId,
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

    if (error || !data) return null

    const newPlano = mapPlanoFromDB(data)
    setPlanos(prev => [...prev, newPlano])
    return newPlano
  }

  const updatePlano = async (plano: PlanoEntrada): Promise<PlanoEntrada | null> => {
    if (!userId) return null

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
      .select()
      .single()

    if (error || !data) return null

    const updatedPlano = mapPlanoFromDB(data)
    setPlanos(prev => prev.map(p => p.id === plano.id ? updatedPlano : p))
    return updatedPlano
  }

  const deletePlano = async (id: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('planos')
      .delete()
      .eq('id', id)

    if (error) return false

    setPlanos(prev => prev.filter(p => p.id !== id))
    return true
  }

  // ─── Saida Rapida operations ───────────────────────────────────────────────
  const addSaidaRapida = async (saida: Omit<SaidaRapida, 'id'>): Promise<SaidaRapida | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('saidas_rapidas')
      .insert({
        user_id: userId,
        nome: saida.nome,
        categoria: saida.categoria,
        server_id: saida.serverId || null,
        valor_unitario: saida.valorUnitario,
        usa_quantidade: saida.usaQuantidade,
        descricao_padrao: saida.descricaoPadrao,
      })
      .select()
      .single()

    if (error || !data) return null

    const newSaida = mapSaidaRapidaFromDB(data)
    setSaidasRapidas(prev => [...prev, newSaida])
    return newSaida
  }

  const updateSaidaRapida = async (saida: SaidaRapida): Promise<SaidaRapida | null> => {
    if (!userId) return null

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
      .select()
      .single()

    if (error || !data) return null

    const updatedSaida = mapSaidaRapidaFromDB(data)
    setSaidasRapidas(prev => prev.map(s => s.id === saida.id ? updatedSaida : s))
    return updatedSaida
  }

  const deleteSaidaRapida = async (id: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('saidas_rapidas')
      .delete()
      .eq('id', id)

    if (error) return false

    setSaidasRapidas(prev => prev.filter(s => s.id !== id))
    return true
  }

  // ─── Credit Movement operations ────────────────────────────────────────────
  const addCreditMovement = async (movement: Omit<CreditMovement, 'id'>): Promise<CreditMovement | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('credit_movements')
      .insert({
        user_id: userId,
        server_id: movement.serverId,
        date: movement.date,
        type: movement.type,
        credits: movement.credits,
        transaction_id: movement.transactionId || null,
      })
      .select()
      .single()

    if (error || !data) return null

    const newMovement = mapCreditMovementFromDB(data)
    setCreditMovements(prev => [newMovement, ...prev])
    return newMovement
  }

  const removeCreditMovementByTransaction = async (transactionId: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('credit_movements')
      .delete()
      .eq('transaction_id', transactionId)

    if (error) return false

    setCreditMovements(prev => prev.filter(m => m.transactionId !== transactionId))
    return true
  }

  // ─── Activation Product operations ─────────────────────────────────────────
  const addActivationProduct = async (product: Omit<ActivationProduct, 'id'>): Promise<ActivationProduct | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('activation_products')
      .insert({
        user_id: userId,
        nome: product.nome,
        validade_meses: product.validadeMeses,
        custos_permitidos: product.custosPermitidos,
        regras_preco: product.regrasPreco,
        linked_server_id: product.linkedServerId || null,
      })
      .select()
      .single()

    if (error || !data) return null

    const newProduct = mapActivationProductFromDB(data)
    setActivationProducts(prev => [...prev, newProduct])
    return newProduct
  }

  const updateActivationProduct = async (product: ActivationProduct): Promise<ActivationProduct | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('activation_products')
      .update({
        nome: product.nome,
        validade_meses: product.validadeMeses,
        custos_permitidos: product.custosPermitidos,
        regras_preco: product.regrasPreco,
        linked_server_id: product.linkedServerId || null,
      })
      .eq('id', product.id)
      .select()
      .single()

    if (error || !data) return null

    const updatedProduct = mapActivationProductFromDB(data)
    setActivationProducts(prev => prev.map(p => p.id === product.id ? updatedProduct : p))
    return updatedProduct
  }

  const deleteActivationProduct = async (id: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('activation_products')
      .delete()
      .eq('id', id)

    if (error) return false

    setActivationProducts(prev => prev.filter(p => p.id !== id))
    return true
  }

  // ─── Activation Transaction operations ─────────────────────────────────────
  const addActivationTransaction = async (
    atx: Omit<ActivationTransaction, 'id' | 'createdAt'>
  ): Promise<ActivationTransaction | null> => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('activation_transactions')
      .insert({
        user_id: userId,
        date: atx.date,
        product_id: atx.productId,
        product_nome: atx.productNome,
        custo: atx.custo,
        valor_venda: atx.valorVenda,
        lucro: atx.lucro,
        transaction_id: atx.transactionId,
      })
      .select()
      .single()

    if (error || !data) return null

    const newAtx = mapActivationTransactionFromDB(data)
    setActivationTransactions(prev => [newAtx, ...prev])
    return newAtx
  }

  const removeActivationTransactionByTransactionId = async (transactionId: string): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('activation_transactions')
      .delete()
      .eq('transaction_id', transactionId)

    if (error) return false

    setActivationTransactions(prev => prev.filter(a => a.transactionId !== transactionId))
    return true
  }

  const getActivationTransactionByTransactionId = (transactionId: string): ActivationTransaction | undefined => {
    return activationTransactions.find(a => a.transactionId === transactionId)
  }

  return {
    // Data
    transactions,
    servidores,
    planos,
    saidasRapidas,
    creditMovements,
    activationProducts,
    activationTransactions,
    loading,
    userId,
    
    // Refresh
    refreshData: fetchAllData,
    
    // Transaction operations
    addTransaction,
    updateTransaction,
    deleteTransaction,
    
    // Servidor operations
    addServidor,
    updateServidor,
    deleteServidor,
    adjustCreditsBalance,
    
    // Plano operations
    addPlano,
    updatePlano,
    deletePlano,
    
    // Saida Rapida operations
    addSaidaRapida,
    updateSaidaRapida,
    deleteSaidaRapida,
    
    // Credit Movement operations
    addCreditMovement,
    removeCreditMovementByTransaction,
    
    // Activation Product operations
    addActivationProduct,
    updateActivationProduct,
    deleteActivationProduct,
    
    // Activation Transaction operations
    addActivationTransaction,
    removeActivationTransactionByTransactionId,
    getActivationTransactionByTransactionId,
  }
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
