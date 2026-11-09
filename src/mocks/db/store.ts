import { createSeed, DB_SCHEMA_VERSION } from '../fixtures/seed'
import type { DbState } from './types'

/**
 * Banco simulado em memória, persistido em localStorage para sustentar refresh.
 * Toda mutação passa por `transact`, que grava o estado ao final.
 * `resetDb` restaura integralmente o cenário conhecido (seed).
 */

export const DB_STORAGE_KEY = 'kurio:mock-db'

let state: DbState | null = null

function persist() {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Armazenamento indisponível (modo privado/cota): o mock segue só em memória.
  }
}

function load(): DbState | null {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbState
    return parsed.schemaVersion === DB_SCHEMA_VERSION ? parsed : null
  } catch {
    return null
  }
}

export async function initDb() {
  state = load() ?? (await createSeed())
  persist()
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
