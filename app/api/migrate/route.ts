import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/migrate
// Migra dados recebidos no body para o Supabase.
// Importante: este endpoint NÃO cria mais dados padrão automaticamente.
// Conta nova deve começar vazia.
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
      activationTransactions = [],
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const servidorMap: Record<string, string> = {}
    const transactionMap: Record<string, string> = {}
    const productMap: Record<string, string> = {}

    let servidoresInserted = 0
    let transactionsInserted = 0
    let planosInserted = 0
    let saidasRapidasInserted = 0
    let creditMovementsInserted = 0
    let activationProductsInserted = 0
    let activationTransactionsInserted = 0

    // 1. Inserir servidores recebidos
    // Antes: se viesse vazio, criava DEFAULT_SERVIDORES.
    // Agora: se vier vazio, não cria nada.
    for (const servidor of servidores) {
      const { data, error } = await supabase
        .from('servidores')
        .insert({
          user_id: userId,
          nome: servidor.nome,
          custo_unitario: servidor.custo_unitario ?? servidor.custoUnitario ?? 0,
          credits_balance: servidor.credits_balance ?? servidor.creditsBalance ?? 0,
          permite_venda_fracionada:
            servidor.permite_venda_fracionada ?? servidor.permiteVendaFracionada ?? false,
          supplier_whatsapp: servidor.supplier_whatsapp ?? servidor.supplierWhatsapp ?? null,
          risk_credits: servidor.risk_credits ?? servidor.riskCredits ?? 10,
        })
        .select('id, nome')
        .single()

      if (error) {
        console.error('[migrate] Error inserting servidor:', error)
        continue
      }

      if (data) {
        servidoresInserted += 1

        const oldId =
          servidor.id ||
          servidor.nome?.toLowerCase?.().replace(/\s+/g, '') ||
          data.id

        servidorMap[oldId] = data.id
        servidorMap[data.nome] = data.id
        servidorMap[data.nome.toLowerCase().replace(/\s+/g, '')] = data.id
      }
    }

    // 2. Inserir transações recebidas
    for (const tx of transactions) {
      const serverId = tx.serverId
        ? servidorMap[tx.serverId] || servidorMap[tx.server_id] || null
        : tx.server_id
          ? servidorMap[tx.server_id] || null
          : null

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          date: tx.date,
          type: tx.type,
          description: tx.description,
          amount: tx.amount,
          server_id: serverId,
          credits_delta: tx.creditsDelta ?? tx.credits_delta ?? null,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[migrate] Error inserting transaction:', error)
        continue
      }

      if (data) {
        transactionsInserted += 1
        if (tx.id) transactionMap[tx.id] = data.id
      }
    }

    // 3. Inserir planos recebidos
    for (const plano of planos) {
      const servidorId =
        servidorMap[plano.servidorId] ||
        servidorMap[plano.servidor_id] ||
        plano.servidor_id ||
        null

      if (!servidorId) {
        console.warn('[migrate] Plano ignorado por falta de servidor:', plano.codigo)
        continue
      }

      const { error } = await supabase.from('planos').insert({
        user_id: userId,
        codigo: plano.codigo,
        descricao: plano.descricao,
        servidor_id: servidorId,
        tipo: plano.tipo,
        meses: plano.meses,
        creditos: plano.creditos,
        valor_venda: plano.valor_venda ?? plano.valorVenda,
        custo: plano.custo,
        validade_tipo: plano.validade_tipo ?? plano.validadeTipo ?? null,
        validade_quantidade: plano.validade_quantidade ?? plano.validadeQuantidade ?? null,
      })

      if (error) {
        console.error('[migrate] Error inserting plano:', error)
        continue
      }

      planosInserted += 1
    }

    // 4. Inserir saídas rápidas recebidas
    for (const saida of saidasRapidas) {
      const serverId = saida.serverId
        ? servidorMap[saida.serverId] || servidorMap[saida.server_id] || null
        : saida.server_id
          ? servidorMap[saida.server_id] || saida.server_id
          : null

      const { error } = await supabase.from('saidas_rapidas').insert({
        user_id: userId,
        nome: saida.nome,
        categoria: saida.categoria,
        server_id: serverId,
        valor_unitario: saida.valor_unitario ?? saida.valorUnitario ?? 0,
        usa_quantidade: saida.usa_quantidade ?? saida.usaQuantidade ?? false,
        descricao_padrao: saida.descricao_padrao ?? saida.descricaoPadrao ?? '',
      })

      if (error) {
        console.error('[migrate] Error inserting saida rapida:', error)
        continue
      }

      saidasRapidasInserted += 1
    }

    // 5. Inserir movimentações de crédito recebidas
    for (const movement of creditMovements) {
      const serverId =
        servidorMap[movement.serverId] ||
        servidorMap[movement.server_id] ||
        movement.server_id ||
        null

      const transactionId = movement.transactionId
        ? transactionMap[movement.transactionId] || null
        : movement.transaction_id
          ? transactionMap[movement.transaction_id] || movement.transaction_id
          : null

      if (!serverId) {
        console.warn('[migrate] Movimento de crédito ignorado por falta de servidor')
        continue
      }

      const { error } = await supabase.from('credit_movements').insert({
        user_id: userId,
        server_id: serverId,
        date: movement.date,
        type: movement.type,
        credits: movement.credits,
        transaction_id: transactionId,
      })

      if (error) {
        console.error('[migrate] Error inserting credit movement:', error)
        continue
      }

      creditMovementsInserted += 1
    }

    // 6. Inserir produtos de ativação recebidos
    for (const product of activationProducts) {
      const linkedServerId = product.linkedServerId
        ? servidorMap[product.linkedServerId] || null
        : product.linked_server_id
          ? servidorMap[product.linked_server_id] || product.linked_server_id
          : null

      const { data, error } = await supabase
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

      if (error) {
        console.error('[migrate] Error inserting activation product:', error)
        continue
      }

      if (data) {
        activationProductsInserted += 1
        if (product.id) productMap[product.id] = data.id
      }
    }

    // 7. Inserir transações de ativação recebidas
    for (const atx of activationTransactions) {
      const productId = atx.productId
        ? productMap[atx.productId] || null
        : atx.product_id
          ? productMap[atx.product_id] || atx.product_id
          : null

      const transactionId = atx.transactionId
        ? transactionMap[atx.transactionId] || null
        : atx.transaction_id
          ? transactionMap[atx.transaction_id] || atx.transaction_id
          : null

      const { error } = await supabase.from('activation_transactions').insert({
        user_id: userId,
        date: atx.date,
        product_id: productId,
        product_nome: atx.product_nome ?? atx.productNome ?? '',
        custo: atx.custo,
        valor_venda: atx.valor_venda ?? atx.valorVenda,
        lucro: atx.lucro,
        transaction_id: transactionId,
      })

      if (error) {
        console.error('[migrate] Error inserting activation transaction:', error)
        continue
      }

      activationTransactionsInserted += 1
    }

    return NextResponse.json({
      success: true,
      message: 'Migração concluída. Nenhum dado padrão foi criado automaticamente.',
      counts: {
        servidores: servidoresInserted,
        transactions: transactionsInserted,
        planos: planosInserted,
        saidasRapidas: saidasRapidasInserted,
        creditMovements: creditMovementsInserted,
        activationProducts: activationProductsInserted,
        activationTransactions: activationTransactionsInserted,
      },
    })
  } catch (err) {
    console.error('[migrate]', err)
    return NextResponse.json({ error: 'Erro na migração' }, { status: 500 })
  }
}

// GET /api/migrate
// Antes este GET populava dados padrão automaticamente.
// Agora fica desativado para evitar que contas novas nasçam preenchidas.
export async function GET() {
  return NextResponse.json({
    success: true,
    seeded: false,
    disabled: true,
    message:
      'Seed automático desativado. Conta nova deve começar vazia. Use uma ação manual específica caso queira importar modelo padrão futuramente.',
  })
}