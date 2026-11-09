import { z } from 'zod'
import { CATEGORIES, CatalogSort, CatalogTab, EthAmount, NETWORKS, type CatalogQuery } from '@/api/contracts'

export const CATALOG_PAGE_SIZE = 9

/** Lista da URL em qualquer formato aceito: `["a","b"]` (padrão do Router), `a&a` repetido ou valor único. */
function listParam<T extends string>(values: readonly T[]) {
  return z.preprocess((raw) => {
    const list = (Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw]).map(String)
    // Mantém só os valores conhecidos (um valor inválido não descarta os demais), sem repetição.
    const valid = [...new Set(list.filter((v): v is T => (values as readonly string[]).includes(v)))]
    return valid.length ? valid : undefined
  }, z.array(z.enum(values as [T, ...T[]])).optional())
}

/** Preço da URL: string ("1.5"), número (1.5, quando o Router converte) ou inválido → descartado. */
const priceParam = z.preprocess((raw) => {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : undefined
  return text && EthAmount.safeParse(text).success && Number(text) > 0 ? text : undefined
}, EthAmount.optional())

/** Página: inteiro ≥ 2 (1 é o padrão e não aparece na URL); aceita "2" como texto. */
const pageParam = z.preprocess((raw) => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof n === 'number' && Number.isInteger(n) && n >= 2 ? n : undefined
}, z.number().int().min(2).optional())

/**
 * Estado do catálogo na URL (busca, filtros, ordenação, paginação).
 * Nenhum parâmetro digitado ou compartilhado quebra a página: valores inválidos caem no padrão, listas aceitam
 * os formatos JSON, repetido e valor único, e uma faixa de preço invertida é corrigida.
 * Valores padrão são omitidos da URL (tab=todos, sort=recentes, page=1).
 */
export const catalogSearchSchema = z
  .object({
    q: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().trim().min(1).max(80).optional().catch(undefined)),
    category: listParam(CATEGORIES),
    network: listParam(NETWORKS),
    minPrice: priceParam,
    maxPrice: priceParam,
    tab: CatalogTab.exclude(['todos']).optional().catch(undefined),
    sort: CatalogSort.exclude(['recentes']).optional().catch(undefined),
    page: pageParam,
  })
  .transform((search) => {
    const { minPrice, maxPrice } = search
    // Faixa invertida (mín. > máx.): troca os limites em vez de mostrar uma lista vazia sem motivo.
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) return { ...search, minPrice: maxPrice, maxPrice: minPrice }
    return search
  })
export type CatalogSearch = z.output<typeof catalogSearchSchema>

/** Converte o estado da URL nos parâmetros enviados à API. */
export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  return {
    q: search.q,
    category: search.category,
    network: search.network,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab ?? 'todos',
    sort: search.sort ?? 'recentes',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

/** Mudança de filtro/busca/ordenação sempre reinicia a paginação. */
export function withFilters(prev: CatalogSearch, patch: Partial<CatalogSearch>): CatalogSearch {
  const next = { ...prev, ...patch, page: undefined }
  if (next.category?.length === 0) next.category = undefined
  if (next.network?.length === 0) next.network = undefined
  return next
}

export function hasActiveFilters(s: CatalogSearch) {
  return Boolean(s.q || s.category || s.network || s.minPrice || s.maxPrice)
}
