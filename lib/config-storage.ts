import type { Servidor, PlanoEntrada, SaidaRapida } from './types'
import { generateId } from './storage'
import { scopedGet, scopedSet } from './scoped-storage'

// ─── Defaults (usados como seed inicial) ────────────────────────────────────

export const DEFAULT_SERVIDORES: Servidor[] = [
  { id: 'p2cine',   nome: 'P2Cine',    custoUnitario: 5.00,  creditsBalance: 0 },
  { id: 'brpro',    nome: 'BR PRO',    custoUnitario: 5.00,  creditsBalance: 0 },
  { id: 'box',      nome: 'BOX',       custoUnitario: 4.10,  creditsBalance: 0 },
  { id: 'p2braz',   nome: 'P2BRAZ',    custoUnitario: 7.00,  creditsBalance: 0 },
  { id: 'warez',    nome: 'WAREZ',     custoUnitario: 7.00,  creditsBalance: 0 },
  { id: 'fire',     nome: 'FIRE',      custoUnitario: 7.00,  creditsBalance: 0 },
  { id: 'brazil',   nome: 'BRAZIL',    custoUnitario: 7.00,  creditsBalance: 0 },
  { id: 'ativaapp', nome: 'ATIVA APP', custoUnitario: 13.00, creditsBalance: 0, permiteVendaFracionada: true },
]

export const DEFAULT_PLANOS: PlanoEntrada[] = [
  // P2Cine
  { id: 'rmc', codigo: 'RMC', descricao: 'Renovação Mensal P2Cine',    servidorId: 'p2cine', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 5.00  },
  { id: 'rtc', codigo: 'RTC', descricao: 'Renovação Trimestral P2Cine', servidorId: 'p2cine', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 15.00 },
  { id: 'rsc', codigo: 'RSC', descricao: 'Renovação Semestral P2Cine',  servidorId: 'p2cine', meses: 6,  tipo: 'renovacao', creditos: 6,  valorVenda: 144.00, custo: 30.00 },
  { id: 'rac', codigo: 'RAC', descricao: 'Renovação Anual P2Cine',      servidorId: 'p2cine', meses: 12, tipo: 'renovacao', creditos: 12, valorVenda: 264.00, custo: 60.00 },
  { id: 'nmc', codigo: 'NMC', descricao: 'Cliente Novo Mensal P2Cine',   servidorId: 'p2cine', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 5.00  },
  { id: 'ntc', codigo: 'NTC', descricao: 'Cliente Novo Trimestral P2Cine', servidorId: 'p2cine', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 15.00 },
  { id: 'nsc', codigo: 'NSC', descricao: 'Cliente Novo Semestral P2Cine',  servidorId: 'p2cine', meses: 6, tipo: 'novo',     creditos: 6,  valorVenda: 144.00, custo: 30.00 },
  { id: 'nac', codigo: 'NAC', descricao: 'Cliente Novo Anual P2Cine',      servidorId: 'p2cine', meses: 12, tipo: 'novo',    creditos: 12, valorVenda: 264.00, custo: 60.00 },

  // BR PRO
  { id: 'rmp', codigo: 'RMP', descricao: 'Renovação Mensal BR PRO',    servidorId: 'brpro', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 5.00  },
  { id: 'rtp', codigo: 'RTP', descricao: 'Renovação Trimestral BR PRO', servidorId: 'brpro', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 15.00 },
  { id: 'rsp', codigo: 'RSP', descricao: 'Renovação Semestral BR PRO',  servidorId: 'brpro', meses: 6,  tipo: 'renovacao', creditos: 6,  valorVenda: 144.00, custo: 30.00 },
  { id: 'rap', codigo: 'RAP', descricao: 'Renovação Anual BR PRO',      servidorId: 'brpro', meses: 12, tipo: 'renovacao', creditos: 12, valorVenda: 264.00, custo: 60.00 },
  { id: 'nmp', codigo: 'NMP', descricao: 'Cliente Novo Mensal BR PRO',   servidorId: 'brpro', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 5.00  },
  { id: 'ntp', codigo: 'NTP', descricao: 'Cliente Novo Trimestral BR PRO', servidorId: 'brpro', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 15.00 },
  { id: 'nsp', codigo: 'NSP', descricao: 'Cliente Novo Semestral BR PRO',  servidorId: 'brpro', meses: 6, tipo: 'novo',     creditos: 6,  valorVenda: 144.00, custo: 30.00 },
  { id: 'nap', codigo: 'NAP', descricao: 'Cliente Novo Anual BR PRO',      servidorId: 'brpro', meses: 12, tipo: 'novo',    creditos: 12, valorVenda: 264.00, custo: 60.00 },

  // BOX
  { id: 'rmx', codigo: 'RMX', descricao: 'Renovação Mensal BOX',    servidorId: 'box', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 4.10  },
  { id: 'rtx', codigo: 'RTX', descricao: 'Renovação Trimestral BOX', servidorId: 'box', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 12.30 },
  { id: 'rsx', codigo: 'RSX', descricao: 'Renovação Semestral BOX',  servidorId: 'box', meses: 6,  tipo: 'renovacao', creditos: 6,  valorVenda: 144.00, custo: 24.60 },
  { id: 'rax', codigo: 'RAX', descricao: 'Renovação Anual BOX',      servidorId: 'box', meses: 12, tipo: 'renovacao', creditos: 12, valorVenda: 264.00, custo: 49.20 },
  { id: 'nmx', codigo: 'NMX', descricao: 'Cliente Novo Mensal BOX',   servidorId: 'box', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 4.10  },
  { id: 'ntx', codigo: 'NTX', descricao: 'Cliente Novo Trimestral BOX', servidorId: 'box', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 12.30 },
  { id: 'nsx', codigo: 'NSX', descricao: 'Cliente Novo Semestral BOX',  servidorId: 'box', meses: 6, tipo: 'novo',     creditos: 6,  valorVenda: 144.00, custo: 24.60 },
  { id: 'nax', codigo: 'NAX', descricao: 'Cliente Novo Anual BOX',      servidorId: 'box', meses: 12, tipo: 'novo',    creditos: 12, valorVenda: 264.00, custo: 49.20 },

  // P2BRAZ
  { id: 'rmb', codigo: 'RMB', descricao: 'Renovação Mensal P2BRAZ',    servidorId: 'p2braz', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'rtb', codigo: 'RTB', descricao: 'Renovação Trimestral P2BRAZ', servidorId: 'p2braz', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'rsb', codigo: 'RSB', descricao: 'Renovação Semestral P2BRAZ',  servidorId: 'p2braz', meses: 5,  tipo: 'renovacao', creditos: 5,  valorVenda: 144.00, custo: 35.00 },
  { id: 'rab', codigo: 'RAB', descricao: 'Renovação Anual P2BRAZ',      servidorId: 'p2braz', meses: 12, tipo: 'renovacao', creditos: 10, valorVenda: 264.00, custo: 70.00 },
  { id: 'nmb', codigo: 'NMB', descricao: 'Cliente Novo Mensal P2BRAZ',   servidorId: 'p2braz', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'ntb', codigo: 'NTB', descricao: 'Cliente Novo Trimestral P2BRAZ', servidorId: 'p2braz', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'nsb', codigo: 'NSB', descricao: 'Cliente Novo Semestral P2BRAZ',  servidorId: 'p2braz', meses: 5, tipo: 'novo',     creditos: 5,  valorVenda: 144.00, custo: 35.00 },
  { id: 'nab', codigo: 'NAB', descricao: 'Cliente Novo Anual P2BRAZ',      servidorId: 'p2braz', meses: 12, tipo: 'novo',    creditos: 10, valorVenda: 264.00, custo: 70.00 },

  // WAREZ
  { id: 'rmw', codigo: 'RMW', descricao: 'Renovação Mensal WAREZ',    servidorId: 'warez', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'rtw', codigo: 'RTW', descricao: 'Renovação Trimestral WAREZ', servidorId: 'warez', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'rsw', codigo: 'RSW', descricao: 'Renovação Semestral WAREZ',  servidorId: 'warez', meses: 5,  tipo: 'renovacao', creditos: 5,  valorVenda: 144.00, custo: 35.00 },
  { id: 'raw', codigo: 'RAW', descricao: 'Renovação Anual WAREZ',      servidorId: 'warez', meses: 12, tipo: 'renovacao', creditos: 10, valorVenda: 264.00, custo: 70.00 },
  { id: 'nmw', codigo: 'NMW', descricao: 'Cliente Novo Mensal WAREZ',   servidorId: 'warez', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'ntw', codigo: 'NTW', descricao: 'Cliente Novo Trimestral WAREZ', servidorId: 'warez', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'nsw', codigo: 'NSW', descricao: 'Cliente Novo Semestral WAREZ',  servidorId: 'warez', meses: 5, tipo: 'novo',     creditos: 5,  valorVenda: 144.00, custo: 35.00 },
  { id: 'naw', codigo: 'NAW', descricao: 'Cliente Novo Anual WAREZ',      servidorId: 'warez', meses: 12, tipo: 'novo',    creditos: 10, valorVenda: 264.00, custo: 70.00 },

  // FIRE
  { id: 'rmf', codigo: 'RMF', descricao: 'Renovação Mensal FIRE',    servidorId: 'fire', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'rtf', codigo: 'RTF', descricao: 'Renovação Trimestral FIRE', servidorId: 'fire', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'rsf', codigo: 'RSF', descricao: 'Renovação Semestral FIRE',  servidorId: 'fire', meses: 5,  tipo: 'renovacao', creditos: 5,  valorVenda: 144.00, custo: 35.00 },
  { id: 'raf', codigo: 'RAF', descricao: 'Renovação Anual FIRE',      servidorId: 'fire', meses: 12, tipo: 'renovacao', creditos: 10, valorVenda: 264.00, custo: 70.00 },
  { id: 'nmf', codigo: 'NMF', descricao: 'Cliente Novo Mensal FIRE',   servidorId: 'fire', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'ntf', codigo: 'NTF', descricao: 'Cliente Novo Trimestral FIRE', servidorId: 'fire', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'nsf', codigo: 'NSF', descricao: 'Cliente Novo Semestral FIRE',  servidorId: 'fire', meses: 5, tipo: 'novo',     creditos: 5,  valorVenda: 144.00, custo: 35.00 },
  { id: 'naf', codigo: 'NAF', descricao: 'Cliente Novo Anual FIRE',      servidorId: 'fire', meses: 12, tipo: 'novo',    creditos: 10, valorVenda: 264.00, custo: 70.00 },

  // BRAZIL
  { id: 'rmz', codigo: 'RMZ', descricao: 'Renovação Mensal BRAZIL',    servidorId: 'brazil', meses: 1,  tipo: 'renovacao', creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'rtz', codigo: 'RTZ', descricao: 'Renovação Trimestral BRAZIL', servidorId: 'brazil', meses: 3,  tipo: 'renovacao', creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'rsz', codigo: 'RSZ', descricao: 'Renovação Semestral BRAZIL',  servidorId: 'brazil', meses: 6,  tipo: 'renovacao', creditos: 6,  valorVenda: 144.00, custo: 42.00 },
  { id: 'raz', codigo: 'RAZ', descricao: 'Renovação Anual BRAZIL',      servidorId: 'brazil', meses: 12, tipo: 'renovacao', creditos: 12, valorVenda: 264.00, custo: 84.00 },
  { id: 'nmz', codigo: 'NMZ', descricao: 'Cliente Novo Mensal BRAZIL',   servidorId: 'brazil', meses: 1,  tipo: 'novo',      creditos: 1,  valorVenda: 30.00,  custo: 7.00  },
  { id: 'ntz', codigo: 'NTZ', descricao: 'Cliente Novo Trimestral BRAZIL', servidorId: 'brazil', meses: 3, tipo: 'novo',     creditos: 3,  valorVenda: 75.00,  custo: 21.00 },
  { id: 'nsz', codigo: 'NSZ', descricao: 'Cliente Novo Semestral BRAZIL',  servidorId: 'brazil', meses: 6, tipo: 'novo',     creditos: 6,  valorVenda: 144.00, custo: 42.00 },
  { id: 'naz', codigo: 'NAZ', descricao: 'Cliente Novo Anual BRAZIL',      servidorId: 'brazil', meses: 12, tipo: 'novo',    creditos: 12, valorVenda: 264.00, custo: 84.00 },
]

export const DEFAULT_SAIDAS_RAPIDAS: SaidaRapida[] = [
  { id: 'compra-p2cine',  nome: 'P2Cine',    categoria: 'Servidor', serverId: 'p2cine',  valorUnitario: 5.00,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos P2Cine' },
  { id: 'compra-brpro',   nome: 'BR PRO',    categoria: 'Servidor', serverId: 'brpro',   valorUnitario: 5.00,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos BR PRO' },
  { id: 'compra-box',     nome: 'BOX',       categoria: 'Servidor', serverId: 'box',     valorUnitario: 4.10,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos BOX' },
  { id: 'compra-p2braz',  nome: 'P2BRAZ',    categoria: 'Servidor', serverId: 'p2braz',  valorUnitario: 7.00,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos P2BRAZ' },
  { id: 'compra-warez',   nome: 'WAREZ',     categoria: 'Servidor', serverId: 'warez',   valorUnitario: 7.00,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos WAREZ' },
  { id: 'compra-fire',    nome: 'FIRE',      categoria: 'Servidor', serverId: 'fire',    valorUnitario: 7.00,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos FIRE' },
  { id: 'compra-brazil',  nome: 'BRAZIL',    categoria: 'Servidor', serverId: 'brazil',  valorUnitario: 7.00,  usaQuantidade: true,  descricaoPadrao: 'Compra de créditos BRAZIL' },
  { id: 'aplicativo',     nome: 'Aplicativo',   categoria: 'Operacional', valorUnitario: 0, usaQuantidade: false, descricaoPadrao: 'Assinatura de aplicativo' },
  { id: 'internet',       nome: 'Internet',     categoria: 'Operacional', valorUnitario: 0, usaQuantidade: false, descricaoPadrao: 'Conta de internet' },
  { id: 'energia',        nome: 'Energia',      categoria: 'Operacional', valorUnitario: 0, usaQuantidade: false, descricaoPadrao: 'Conta de energia' },
  { id: 'marketing',      nome: 'Marketing',    categoria: 'Marketing',   valorUnitario: 0, usaQuantidade: false, descricaoPadrao: 'Gasto com marketing' },
  { id: 'comissao',       nome: 'Comissão',     categoria: 'Pessoal',     valorUnitario: 0, usaQuantidade: false, descricaoPadrao: 'Pagamento de comissão' },
  { id: 'outros',         nome: 'Outros',       categoria: 'Outros',      valorUnitario: 0, usaQuantidade: false, descricaoPadrao: 'Outros custos' },
]

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEY_SERVIDORES   = 'cashflow-servidores'
const KEY_PLANOS       = 'cashflow-planos'
const KEY_SAIDAS       = 'cashflow-saidas-rapidas'

// ─── Servidores ──────────────────────────────────────────────────────────────

export function getServidores(): Servidor[] {
  if (typeof window === 'undefined') return DEFAULT_SERVIDORES
  try {
    const stored = scopedGet(KEY_SERVIDORES)
    return stored ? JSON.parse(stored) : DEFAULT_SERVIDORES
  } catch { return DEFAULT_SERVIDORES }
}

export function saveServidores(list: Servidor[]): void {
  if (typeof window === 'undefined') return
  scopedSet(KEY_SERVIDORES, JSON.stringify(list))
}

export function addServidor(s: Omit<Servidor, 'id'>): Servidor[] {
  const list = getServidores()
  const novo = { ...s, id: generateId() }
  const updated = [...list, novo]
  saveServidores(updated)
  return updated
}

export function updateServidor(s: Servidor): Servidor[] {
  const list = getServidores().map(x => x.id === s.id ? s : x)
  saveServidores(list)
  return list
}

export function deleteServidor(id: string): Servidor[] {
  const list = getServidores().filter(x => x.id !== id)
  saveServidores(list)
  return list
}

// ─── Planos de Entrada ───────────────────────────────────────────────────────

export function getPlanos(): PlanoEntrada[] {
  if (typeof window === 'undefined') return DEFAULT_PLANOS
  try {
    const stored = scopedGet(KEY_PLANOS)
    return stored ? JSON.parse(stored) : DEFAULT_PLANOS
  } catch { return DEFAULT_PLANOS }
}

export function savePlanos(list: PlanoEntrada[]): void {
  if (typeof window === 'undefined') return
  scopedSet(KEY_PLANOS, JSON.stringify(list))
}

export function addPlano(p: Omit<PlanoEntrada, 'id'>): PlanoEntrada[] {
  const list = getPlanos()
  const novo = { ...p, id: generateId() }
  const updated = [...list, novo]
  savePlanos(updated)
  return updated
}

export function updatePlano(p: PlanoEntrada): PlanoEntrada[] {
  const list = getPlanos().map(x => x.id === p.id ? p : x)
  savePlanos(list)
  return list
}

export function deletePlano(id: string): PlanoEntrada[] {
  const list = getPlanos().filter(x => x.id !== id)
  savePlanos(list)
  return list
}

// ─── Saídas Rápidas ──────────────────────────────────────────────────────────

export function getSaidasRapidas(): SaidaRapida[] {
  if (typeof window === 'undefined') return DEFAULT_SAIDAS_RAPIDAS
  try {
    const stored = scopedGet(KEY_SAIDAS)
    return stored ? JSON.parse(stored) : DEFAULT_SAIDAS_RAPIDAS
  } catch { return DEFAULT_SAIDAS_RAPIDAS }
}

export function saveSaidasRapidas(list: SaidaRapida[]): void {
  if (typeof window === 'undefined') return
  scopedSet(KEY_SAIDAS, JSON.stringify(list))
}

export function addSaidaRapida(s: Omit<SaidaRapida, 'id'>): SaidaRapida[] {
  const list = getSaidasRapidas()
  const novo = { ...s, id: generateId() }
  const updated = [...list, novo]
  saveSaidasRapidas(updated)
  return updated
}

export function updateSaidaRapida(s: SaidaRapida): SaidaRapida[] {
  const list = getSaidasRapidas().map(x => x.id === s.id ? s : x)
  saveSaidasRapidas(list)
  return list
}

export function deleteSaidaRapida(id: string): SaidaRapida[] {
  const list = getSaidasRapidas().filter(x => x.id !== id)
  saveSaidasRapidas(list)
  return list
}

// ─── Credits Balance Helpers ─────────────────────────────────────────────────

/**
 * Adjust a server's credits balance by `delta` (positive or negative).
 * Returns the updated servidor list.
 */
export function adjustCreditsBalance(serverId: string, delta: number): Servidor[] {
  const list = getServidores().map(s =>
    s.id === serverId
      ? { ...s, creditsBalance: Math.max(0, (s.creditsBalance ?? 0) + delta) }
      : s
  )
  saveServidores(list)
  return list
}

/**
 * Set a server's credits balance to an exact value.
 */
export function setCreditsBalance(serverId: string, value: number): Servidor[] {
  const list = getServidores().map(s =>
    s.id === serverId ? { ...s, creditsBalance: Math.max(0, value) } : s
  )
  saveServidores(list)
  return list
}

/**
 * Get the current credits balance for a server.
 */
export function getCreditsBalance(serverId: string): number {
  const srv = getServidores().find(s => s.id === serverId)
  return srv?.creditsBalance ?? 0
}
