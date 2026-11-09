import { z } from 'zod'
import { CatalogSort, CatalogTab, Category, EthAmount, Network, type CatalogQuery } from '@/api/contracts'

export const CATALOG_PAGE_SIZE = 9

/**
 * Estado do catálogo na URL (busca, filtros, ordenação, paginação).
 * Cada campo tem `.catch`: parâmetros inválidos digitados na URL são descartados em vez de quebrar a página.
 * Valores padrão são omitidos da URL (tab=todos, sort=recentes, page=1).
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().min(1).max(80).optional().catch(undefined),
  category: z.array(Category).min(1).optional().catch(undefined),
  network: z.array(Network).min(1).optional().catch(undefined),
  minPrice: EthAmount.optional().catch(undefined),
  maxPrice: EthAmount.optional().catch(undefined),
  tab: CatalogTab.exclude(['todos']).optional().catch(undefined),
  sort: CatalogSort.exclude(['recentes']).optional().catch(undefined),
  page: z.number().int().min(2).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

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
