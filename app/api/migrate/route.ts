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

// Função auxiliar para gerar planos de um servidor
function gerarPlanosServidor(
  servidorNome: string,
  sufixoCodigo: string,
  custoUnitario: number,
  creditosSemestral: number = 6,
  creditosAnual: number = 12
) {
  const planos = [
    // Novos
    { codigo: `NM${sufixoCodigo}`, descricao: `Cliente Novo Mensal ${servidorNome}`, tipo: 'novo', meses: 1, creditos: 1, valor_venda: 30, custo: custoUnitario },
    { codigo: `NT${sufixoCodigo}`, descricao: `Cliente Novo Trimestral ${servidorNome}`, tipo: 'novo', meses: 3, creditos: 3, valor_venda: 75, custo: custoUnitario * 3 },
    { codigo: `NS${sufixoCodigo}`, descricao: `Cliente Novo Semestral ${servidorNome}`, tipo: 'novo', meses: 6, creditos: creditosSemestral, valor_venda: 144, custo: custoUnitario * creditosSemestral },
    { codigo: `NA${sufixoCodigo}`, descricao: `Cliente Novo Anual ${servidorNome}`, tipo: 'novo', meses: 12, creditos: creditosAnual, valor_venda: 264, custo: custoUnitario * creditosAnual },
    // Renovações
    { codigo: `RM${sufixoCodigo}`, descricao: `Renovação Mensal ${servidorNome}`, tipo: 'renovacao', meses: 1, creditos: 1, valor_venda: 30, custo: custoUnitario },
    { codigo: `RT${sufixoCodigo}`, descricao: `Renovação Trimestral ${servidorNome}`, tipo: 'renovacao', meses: 3, creditos: 3, valor_venda: 75, custo: custoUnitario * 3 },
    { codigo: `RS${sufixoCodigo}`, descricao: `Renovação Semestral ${servidorNome}`, tipo: 'renovacao', meses: 6, creditos: creditosSemestral, valor_venda: 144, custo: custoUnitario * creditosSemestral },
    { codigo: `RA${sufixoCodigo}`, descricao: `Renovação Anual ${servidorNome}`, tipo: 'renovacao', meses: 12, creditos: creditosAnual, valor_venda: 264, custo: custoUnitario * creditosAnual },
  ]
  return planos
}

// Dados padrão dos planos (56 planos = 7 servidores × 8 variações)
const DEFAULT_PLANOS_CONFIG = [
  { servidor: 'BOX', sufixo: 'X', custo: 4.10, creditosSem: 6, creditosAnual: 12 },
  { servidor: 'BR PRO', sufixo: 'P', custo: 5.00, creditosSem: 6, creditosAnual: 12 },
  { servidor: 'P2Cine', sufixo: 'C', custo: 5.00, creditosSem: 6, creditosAnual: 12 },
  { servidor: 'P2BRAZ', sufixo: 'B', custo: 7.00, creditosSem: 5, creditosAnual: 10 },
  { servidor: 'WAREZ', sufixo: 'W', custo: 7.00, creditosSem: 5, creditosAnual: 10 },
  { servidor: 'FIRE', sufixo: 'F', custo: 7.00, creditosSem: 5, creditosAnual: 10 },
  { servidor: 'BRAZIL', sufixo: 'Z', custo: 7.00, creditosSem: 6, creditosAnual: 12 },
]

// Dados padrão das saídas rápidas (8)
const DEFAULT_SAIDAS_RAPIDAS = [
  { nome: 'ATIVA APP', categoria: 'Servidor', servidor: 'ATIVA APP', valor_unitario: 13.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos ATIVA APP' },
  { nome: 'BOX', categoria: 'Servidor', servidor: 'BOX', valor_unitario: 4.10, usa_quantidade: true, descricao_padrao: 'Compra de créditos BOX' },
  { nome: 'BR PRO', categoria: 'Servidor', servidor: 'BR PRO', valor_unitario: 5.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos BR PRO' },
  { nome: 'BRAZIL', categoria: 'Servidor', servidor: 'BRAZIL', valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos BRAZIL' },
  { nome: 'FIRE', categoria: 'Servidor', servidor: 'FIRE', valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos FIRE' },
  { nome: 'P2BRAZ', categoria: 'Servidor', servidor: 'P2BRAZ', valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos P2BRAZ' },
  { nome: 'P2Cine', categoria: 'Servidor', servidor: 'P2Cine', valor_unitario: 5.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos P2Cine' },
  { nome: 'WAREZ', categoria: 'Servidor', servidor: 'WAREZ', valor_unitario: 7.00, usa_quantidade: true, descricao_padrao: 'Compra de créditos WAREZ' },
]

// Dados padrão do produto de ativação
const DEFAULT_ACTIVATION_PRODUCT = {
  nome: 'ATIVA APP',
  servidor: 'ATIVA APP',
  validade_meses: 12,
  custos_permitidos: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
  regras_preco: [
    { custoMin: 0.5, custoMax: 1.0, precoVenda: 20.00 },
    { custoMin: 1.1, custoMax: 1.9, precoVenda: 25.00 },
  ],
}

// Dados padrão dos grupos de revenda (3)
const DEFAULT_REVENDA_GRUPOS = [
  {
    nome: 'BOX',
    servidores: ['BOX'],
    faixas: [
      { min: 10, max: 29, preco: 7.00 },
      { min: 30, max: 49, preco: 6.50 },
      { min: 50, max: 99, preco: 6.00 },
      { min: 100, max: 299, preco: 5.00 },
      { min: 300, max: 999, preco: 4.50 },
    ],
  },
  {
    nome: 'FIRE / WAREZ / P2BRAZ / BRAZIL',
    servidores: ['FIRE', 'WAREZ', 'P2BRAZ', 'BRAZIL'],
    faixas: [
      { min: 10, max: 29, preco: 12.00 },
      { min: 30, max: 49, preco: 10.00 },
      { min: 50, max: 99, preco: 8.00 },
      { min: 100, max: 299, preco: 7.00 },
      { min: 300, max: 999, preco: 6.00 },
    ],
  },
  {
    nome: 'P2CINE / BR PRO',
    servidores: ['P2Cine', 'BR PRO'],
    faixas: [
      { min: 10, max: 29, preco: 9.00 },
      { min: 30, max: 49, preco: 8.00 },
      { min: 50, max: 99, preco: 7.00 },
      { min: 100, max: 299, preco: 6.00 },
      { min: 300, max: 999, preco: 5.00 },
    ],
  },
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

  // 1. Seed servidores e criar mapeamento de nomes para IDs
  const servidorMap: Record<string, string> = {}

  for (const servidor of DEFAULT_SERVIDORES) {
    const { data, error } = await supabase
      .from('servidores')
      .insert({ ...servidor, user_id: userId })
      .select('id, nome')
      .single()

    if (error) {
      console.error('[seed] Error inserting servidor:', error)
      continue
    }

    if (data) {
      servidorMap[data.nome] = data.id
    }
  }

  // 2. Seed planos de entrada (56 planos)
  for (const config of DEFAULT_PLANOS_CONFIG) {
    const servidorId = servidorMap[config.servidor]
    if (!servidorId) continue

    const planos = gerarPlanosServidor(
      config.servidor,
      config.sufixo,
      config.custo,
      config.creditosSem,
      config.creditosAnual
    )

    for (const plano of planos) {
      await supabase.from('planos').insert({
        user_id: userId,
        servidor_id: servidorId,
        ...plano,
      })
    }
  }

  // 3. Seed saídas rápidas (8)
  for (const saida of DEFAULT_SAIDAS_RAPIDAS) {
    const serverId = servidorMap[saida.servidor]
    await supabase.from('saidas_rapidas').insert({
      user_id: userId,
      nome: saida.nome,
      categoria: saida.categoria,
      server_id: serverId || null,
      valor_unitario: saida.valor_unitario,
      usa_quantidade: saida.usa_quantidade,
      descricao_padrao: saida.descricao_padrao,
    })
  }

  // 4. Seed produto de ativação (1)
  const linkedServerId = servidorMap[DEFAULT_ACTIVATION_PRODUCT.servidor]
  await supabase.from('activation_products').insert({
    user_id: userId,
    nome: DEFAULT_ACTIVATION_PRODUCT.nome,
    validade_meses: DEFAULT_ACTIVATION_PRODUCT.validade_meses,
    custos_permitidos: DEFAULT_ACTIVATION_PRODUCT.custos_permitidos,
    regras_preco: DEFAULT_ACTIVATION_PRODUCT.regras_preco,
    linked_server_id: linkedServerId || null,
  })

  // 5. Seed grupos de revenda (3)
  for (const grupo of DEFAULT_REVENDA_GRUPOS) {
    const servidorIds = grupo.servidores
      .map(nome => servidorMap[nome])
      .filter(Boolean)

    await supabase.from('revenda_grupos').insert({
      user_id: userId,
      nome: grupo.nome,
      servidor_ids: servidorIds,
      faixas: grupo.faixas,
    })
  }

  return NextResponse.json({
    message: 'Default data seeded',
    seeded: true,
    counts: {
      servidores: DEFAULT_SERVIDORES.length,
      planos: DEFAULT_PLANOS_CONFIG.length * 8,
      saidasRapidas: DEFAULT_SAIDAS_RAPIDAS.length,
      activationProducts: 1,
      revendaGrupos: DEFAULT_REVENDA_GRUPOS.length,
    }
  })
}
