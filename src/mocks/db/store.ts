import { createSeed, DB_SCHEMA_VERSION } from '../fixtures/seed'
import type { DbState } from './types'

/**
 * Banco simulado em memória, persistido em localStorage para sustentar refresh.
 * Toda mutação passa por `transact`, que grava o estado ao final.
 * `resetDb` restaura integralmente o cenário conhecido (seed).
 *
 * Várias abas: cada aba mantém uma cópia em memória e grava o banco inteiro. Sem sincronização, uma aba antiga
 * sobrescrevia as sessões criadas em outra (o login "não ficava"). O evento `storage` atualiza a cópia desta aba
 * sempre que outra aba grava (o evento chega antes das requisições seguintes desta aba).
 */

export const DB_STORAGE_KEY = 'kurio:mock-db'

let state: DbState | null = null
/** Último conteúdo gravado/lido por esta aba (evita reprocessar o mesmo JSON). */
let lastRaw: string | null = null
let syncing = false

const ARRAY_KEYS = ['nfts', 'users', 'sessions', 'wallets', 'carts', 'coupons', 'quotes', 'orders', 'idempotency', 'walletConnections', 'oauthIdentities', 'oauthRequests'] as const

/** Banco salvo por outra versão do seed, parcial ou corrompido → descartado (recriado a partir do seed). */
export function parseDb(raw: string | null): DbState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DbState> | null
    if (!parsed || parsed.schemaVersion !== DB_SCHEMA_VERSION) return null
    if (!ARRAY_KEYS.every((k) => Array.isArray(parsed[k]))) return null
    if (typeof parsed.favorites !== 'object' || typeof parsed.counters !== 'object' || !parsed.favorites || !parsed.counters) return null
    if (parsed.users!.length === 0 || parsed.nfts!.length === 0) return null
    return parsed as DbState
  } catch {
    return null
  }
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(DB_STORAGE_KEY)
  } catch {
    return null
  }
}

function persist() {
  try {
    lastRaw = JSON.stringify(state)
    localStorage.setItem(DB_STORAGE_KEY, lastRaw)
  } catch {
    // Armazenamento indisponível (modo privado/cota): o mock segue só em memória.
  }
}

/** Adota o banco gravado por outra aba, se for válido e diferente do atual. */
function syncFromStorage(raw: string | null) {
  if (raw === null || raw === lastRaw) return
  const parsed = parseDb(raw)
  if (parsed) {
    state = parsed
    lastRaw = raw
  }
}

export async function initDb() {
  const raw = readStorage()
  const loaded = parseDb(raw)
  state = loaded ?? (await createSeed())
  if (loaded) lastRaw = raw
  else persist()
  if (!syncing && typeof window !== 'undefined') {
    syncing = true
    window.addEventListener('storage', (event) => {
      if (event.key === DB_STORAGE_KEY) syncFromStorage(event.newValue)
    })
  }
}

export async function resetDb() {
  state = await createSeed()
  persist()
}

export function getDb(): DbState {
  if (!state) throw new Error('Banco simulado não inicializado (initDb)')
  return state
}

/**
 * Executa uma mutação e persiste — inclusive quando a função lança uma resposta de erro,
 * pois cenários como "preço alterado" mudam o catálogo e respondem 409 na mesma operação.
 */
export function transact<T>(fn: (db: DbState) => T): T {
  try {
    return fn(getDb())
  } finally {
    persist()
  }
}

/** Ids determinísticos por prefixo: ord_0001, evt_0001... (resetados junto com o banco). */
export function nextId(prefix: string) {
  const db = getDb()
  db.counters[prefix] = (db.counters[prefix] ?? 0) + 1
  return `${prefix}_${String(db.counters[prefix]).padStart(4, '0')}`
}

/** Relógio do mock (Date.now é controlável pelo Playwright via page.clock). */
export function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}
