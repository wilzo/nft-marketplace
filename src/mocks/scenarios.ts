/**
 * Cenários de simulação: condições de rede e comportamentos de negócio configuráveis e reproduzíveis.
 *
 * Seleção:
 *  - URL: `?cenario=<nome>` (aplicado no boot do MSW e removido da URL);
 *  - API de controle: `PUT /api/__mock/scenario` { name, overrides? };
 *  - Reset: `POST /api/__mock/reset` { scenario? } restaura banco + cenário.
 * O cenário ativo fica em localStorage e sobrevive a refresh.
 */

export type LatencyConfig =
  | { mode: 'none' }
  | { mode: 'fixed'; ms: number }
  /** Latência variável determinística: derivada do hash da URL (mesma URL → mesmo atraso). */
  | { mode: 'variable'; minMs: number; maxMs: number }

export interface FailureRule {
  /** Método HTTP (omitido = qualquer). */
  method?: string
  /** Caminho relativo à API com curinga `*` (ex.: "/favorites/*"). */
  path: string
  status: number
  code: string
  message?: string
  /** Quantas vezes falhar antes de voltar ao normal (omitido = sempre). */
  times?: number
}

export interface ScenarioConfig {
  name: string
  description: string
  latency: LatencyConfig
  /** Simula queda de conexão: toda requisição REST falha em nível de rede. */
  offline: boolean
  failures: FailureRule[]
  /** Catálogo sem nenhum resultado. */
  emptyCatalog: boolean
  /** Duração das sessões criadas no login/cadastro. */
  sessionTtlSeconds: number
  checkout: {
    /** No próximo pedido, o preço do 1º item sobe antes da revalidação (uma vez). */
    priceChangeOnOrder: boolean
    /** No próximo pedido, a edição do 1º item esgota antes da revalidação (uma vez). */
    soldOutOnOrder: boolean
    /** Atraso da 1ª resposta de criação do pedido (> timeout do cliente = timeout após criação). */
    orderResponseDelayMs: number
    paymentOutcome: 'confirmed' | 'declined'
    /** Tempo até o pagamento simulado sair de "pendente". */
    settleDelayMs: number
  }
  wallet: { connectOutcome: 'connected' | 'rejected' }
  realtime: {
    /** Recusa conexões Socket.IO (simula servidor de eventos fora do ar). */
    down: boolean
  }
}

const BASE: ScenarioConfig = {
  name: 'padrao',
  description: 'Sucesso: rede rápida, pagamento confirmado.',
  latency: { mode: 'fixed', ms: 150 },
  offline: false,
  failures: [],
  emptyCatalog: false,
  sessionTtlSeconds: 60 * 60,
  checkout: {
    priceChangeOnOrder: false,
    soldOutOnOrder: false,
    orderResponseDelayMs: 0,
    paymentOutcome: 'confirmed',
    settleDelayMs: 3_000,
  },
  wallet: { connectOutcome: 'connected' },
  realtime: { down: false },
}

type Preset = Omit<Partial<ScenarioConfig>, 'checkout' | 'wallet' | 'realtime'> & {
  description: string
  checkout?: Partial<ScenarioConfig['checkout']>
  wallet?: Partial<ScenarioConfig['wallet']>
  realtime?: Partial<ScenarioConfig['realtime']>
}

export const SCENARIO_PRESETS: Record<string, Preset> = {
  padrao: { description: BASE.description },
  'sem-latencia': { description: 'Sucesso sem latência (testes rápidos).', latency: { mode: 'none' } },
  vazio: { description: 'Catálogo sem resultados.', emptyCatalog: true },
  lento: { description: 'Rede lenta: 2,5 s por requisição (skeletons).', latency: { mode: 'fixed', ms: 2_500 } },
  'latencia-variavel': {
    description: 'Latência variável (100–1800 ms) determinística por URL: respostas fora de ordem.',
    latency: { mode: 'variable', minMs: 100, maxMs: 1_800 },
  },
  offline: { description: 'Sem conexão: requisições REST falham em nível de rede.', offline: true },
  'erro-servidor': {
    description: 'HTTP 500 na listagem e no detalhe de NFTs.',
    failures: [
      { method: 'GET', path: '/nfts', status: 500, code: 'INTERNAL_ERROR' },
      { method: 'GET', path: '/nfts/*', status: 500, code: 'INTERNAL_ERROR' },
    ],
  },
  'falha-transitoria': {
    description: 'HTTP 503 nas 2 primeiras chamadas da listagem; depois recupera.',
    failures: [{ method: 'GET', path: '/nfts', status: 503, code: 'SERVICE_UNAVAILABLE', times: 2 }],
  },
  'favoritos-falha': {
    description: 'Inclusão/remoção de favoritos falha com 503 (rollback otimista).',
    failures: [
      { method: 'PUT', path: '/favorites/*', status: 503, code: 'SERVICE_UNAVAILABLE' },
      { method: 'DELETE', path: '/favorites/*', status: 503, code: 'SERVICE_UNAVAILABLE' },
    ],
  },
  'sessao-curta': { description: 'Sessões expiram 30 s após o login.', sessionTtlSeconds: 30 },
  'preco-alterado': { description: 'Preço muda durante a confirmação do pedido.', checkout: { priceChangeOnOrder: true } },
  esgotado: { description: 'Edição esgota durante a confirmação do pedido.', checkout: { soldOutOnOrder: true } },
  'timeout-pedido': {
    description: 'Pedido é criado, mas a 1ª resposta demora 15 s (timeout); reenvio recupera o mesmo pedido.',
    checkout: { orderResponseDelayMs: 15_000 },
  },
  'pagamento-recusado': { description: 'Pagamento simulado é recusado.', checkout: { paymentOutcome: 'declined' } },
  'carteira-recusada': { description: 'Conexão com a carteira é recusada pelo usuário.', wallet: { connectOutcome: 'rejected' } },
  'tempo-real-fora': { description: 'Servidor Socket.IO recusa conexões.', realtime: { down: true } },
}

export const DEFAULT_SCENARIO = 'padrao'
export const SCENARIO_STORAGE_KEY = 'kurio:mock-scenario'

export type ScenarioOverrides = Omit<Preset, 'description'> & { description?: string }

export function buildScenario(name: string, overrides: ScenarioOverrides = {}): ScenarioConfig {
  const preset = SCENARIO_PRESETS[name]
  if (!preset) throw new Error(`Cenário desconhecido: ${name}`)
  const merged = [preset, overrides].reduce<ScenarioConfig>(
    (acc, p) => ({
      ...acc,
      ...p,
      checkout: { ...acc.checkout, ...p.checkout },
      wallet: { ...acc.wallet, ...p.wallet },
      realtime: { ...acc.realtime, ...p.realtime },
    }),
    { ...BASE },
  )
  return { ...merged, name }
}

let active: ScenarioConfig = buildScenario(DEFAULT_SCENARIO)
/** Contagem de falhas já aplicadas por regra (para `times`). Não persiste: reinicia a cada carga. */
const failureHits = new Map<number, number>()

export function loadScenario() {
  try {
    const raw = localStorage.getItem(SCENARIO_STORAGE_KEY)
    if (raw) active = JSON.parse(raw) as ScenarioConfig
  } catch {
    active = buildScenario(DEFAULT_SCENARIO)
  }
}

export function setScenario(config: ScenarioConfig) {
  active = config
  failureHits.clear()
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // mantém em memória
  }
}

export function getScenario(): ScenarioConfig {
  return active
}

/** Consome flags de "uma vez" (ex.: priceChangeOnOrder) após aplicadas. */
export function consumeCheckoutFlag(flag: 'priceChangeOnOrder' | 'soldOutOnOrder') {
  setScenario({ ...active, checkout: { ...active.checkout, [flag]: false } })
}

export function matchFailure(method: string, path: string): FailureRule | null {
  for (const [index, rule] of active.failures.entries()) {
    if (rule.method && rule.method.toUpperCase() !== method.toUpperCase()) continue
    const re = new RegExp(`^${rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}$`)
    if (!re.test(path)) continue
    const hits = failureHits.get(index) ?? 0
    if (rule.times !== undefined && hits >= rule.times) continue
    failureHits.set(index, hits + 1)
    return rule
  }
  return null
}

/** Atraso determinístico para a requisição, conforme o cenário. */
export function latencyFor(url: string): number {
  const l = active.latency
  if (l.mode === 'none') return 0
  if (l.mode === 'fixed') return l.ms
  let h = 2166136261
  for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 16777619)
  return l.minMs + ((h >>> 0) % (l.maxMs - l.minMs + 1))
}
