import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Dados padrão dos servidores
const DEFAULT_SERVIDORES = [
  { nome: 'P2Cine', custo_unitario: 5.00, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'BR PRO', custo_unitario: 5.00, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'BOX', custo_unitario: 4.10, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'P2BRAZ', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'WAREZ', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'FIRE', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'BRAZIL', custo_unitario: 7.00, credits_balance: 0, permite_venda_fracionada: false },
  { nome: 'ATIVA APP', custo_unitario: 13.00, credits_balance: 0, permite_venda_fracionada: true },
]

// POST /api/migrate - Migrate localStorage data to Supabase for a specific user
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { 
      userId,
      transactions = [],
      servidores = [],
      planos = [],
      saidasRapidas = [],
      creditMovements = [],
      activationProducts = [],
      activationTransactions = []
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Clear existing data for this user (optional - comment out if you want to keep)
    // await supabase.from('transactions').delete().eq('user_id', userId)
    // await supabase.from('servidores').delete().eq('user_id', userId)

    // 2. Insert servidores first (they are referenced by other tables)
    const servidoresToInsert = servidores.length > 0 ? servidores : DEFAULT_SERVIDORES
    const servidorMap: Record<string, string> = {}

    for (const servidor of servidoresToInsert) {
      const { data, error } = await supabase
        .from('servidores')
        .insert({
          user_id: userId,
          nome: servidor.nome,
          custo_unitario: servidor.custo_unitario ?? servidor.custoUnitario ?? 0,
          credits_balance: servidor.credits_balance ?? servidor.creditsBalance ?? 0,
          permite_venda_fracionada: servidor.permite_venda_fracionada ?? servidor.permiteVendaFracionada ?? false,
        })
        .select('id, nome')
        .single()

      if (data) {
        // Map old ID or name to new UUID
        const oldId = servidor.id || servidor.nome.toLowerCase().replace(/\s+/g, '')
        servidorMap[oldId] = data.id
        servidorMap[servidor.nome] = data.id
        servidorMap[servidor.nome.toLowerCase().replace(/\s+/g, '')] = data.id
      }
    }

    // 3. Insert transactions
    const transactionMap: Record<string, string> = {}
    for (const tx of transactions) {
      const serverId = tx.serverId ? (servidorMap[tx.serverId] || null) : null
      
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          date: tx.date,
          type: tx.type,
          description: tx.description,
          amount: tx.amount,
          server_id: serverId,
          credits_delta: tx.creditsDelta || null,
        })
        .select('id')
        .single()

      if (data) {
        transactionMap[tx.id] = data.id
      }
    }

    // 4. Insert planos
    for (const plano of planos) {
      const servidorId = servidorMap[plano.servidorId] || servidorMap[plano.servidor_id]
      if (!servidorId) continue

      await supabase
        .from('planos')
        .insert({
          user_id: userId,
          codigo: plano.codigo,
          descricao: plano.descricao,
          servidor_id: servidorId,
          tipo: plano.tipo,
          meses: plano.meses,
          creditos: plano.creditos,
          valor_venda: plano.valor_venda ?? plano.valorVenda,
          custo: plano.custo,
        })
    }

    // 5. Insert saidas rapidas
    for (const saida of saidasRapidas) {
      const serverId = saida.serverId ? (servidorMap[saida.serverId] || servidorMap[saida.server_id]) : null

      await supabase
        .from('saidas_rapidas')
        .insert({
          user_id: userId,
          nome: saida.nome,
          categoria: saida.categoria,
          server_id: serverId,
          valor_unitario: saida.valor_unitario ?? saida.valorUnitario ?? 0,
          usa_quantidade: saida.usa_quantidade ?? saida.usaQuantidade ?? false,
          descricao_padrao: saida.descricao_padrao ?? saida.descricaoPadrao ?? '',
        })
    }

    // 6. Insert credit movements
    for (const movement of creditMovements) {
      const serverId = servidorMap[movement.serverId] || servidorMap[movement.server_id]
      const transactionId = movement.transactionId ? transactionMap[movement.transactionId] : null
      if (!serverId) continue

      await supabase
        .from('credit_movements')
        .insert({
          user_id: userId,
          server_id: serverId,
          date: movement.date,
          type: movement.type,
          credits: movement.credits,
          transaction_id: transactionId,
        })
    }

    // 7. Insert activation products
    const productMap: Record<string, string> = {}
    for (const product of activationProducts) {
      const linkedServerId = product.linkedServerId ? servidorMap[product.linkedServerId] : null

      const { data } = await supabase
        .from('activation_products')
        .insert({
          user_id: userId,
          nome: product.nome,
          validade_meses: product.validade_meses ?? product.validadeMeses ?? 12,
          custos_permitidos: product.custos_permitidos ?? product.custosPermitidos ?? [],
          regras_preco: product.regras_preco ?? product.regrasPreco ?? [],
          linked_server_id: linkedServerId,
        })
        .select('id')
        .single()

      if (data) {
        productMap[product.id] = data.id
      }
    }

    // 8. Insert activation transactions
    for (const atx of activationTransactions) {
      const productId = atx.productId ? productMap[atx.productId] : null
      const transactionId = atx.transactionId ? transactionMap[atx.transactionId] : null

      await supabase
        .from('activation_transactions')
        .insert({
          user_id: userId,
          date: atx.date,
          product_id: productId,
          product_nome: atx.product_nome ?? atx.productNome ?? '',
          custo: atx.custo,
          valor_venda: atx.valor_venda ?? atx.valorVenda,
          lucro: atx.lucro,
          transaction_id: transactionId,
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Dados migrados com sucesso',
      counts: {
        servidores: Object.keys(servidorMap).length / 2, // divided by 2 because we have multiple keys per servidor
        transactions: Object.keys(transactionMap).length,
        planos: planos.length,
        saidasRapidas: saidasRapidas.length,
        creditMovements: creditMovements.length,
        activationProducts: Object.keys(productMap).length,
        activationTransactions: activationTransactions.length,
      }
    })
  } catch (err) {
    console.error('[migrate]', err)
    return NextResponse.json({ error: 'Erro na migração' }, { status: 500 })
  }
}

// GET /api/migrate/seed - Seed default data for a user
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check if user already has servidores
  const { data: existingServidores } = await supabase
    .from('servidores')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existingServidores && existingServidores.length > 0) {
    return NextResponse.json({ message: 'User already has data', seeded: false })
  }

  // Seed default servidores
  const { error } = await supabase
    .from('servidores')
    .insert(DEFAULT_SERVIDORES.map(s => ({ ...s, user_id: userId })))

  if (error) {
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Default data seeded', seeded: true })
}
