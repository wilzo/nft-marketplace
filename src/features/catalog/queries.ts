import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { nftsApi } from '@/api/endpoints'
import { qk } from '@/lib/query-keys'
import { realtime } from '@/lib/realtime'

/** Registra a versão vinda do REST para descartar eventos Socket.IO mais antigos. */
function note<T extends { id: string; version: number }>(items: T[]) {
  for (const i of items) realtime.noteVersion('nft', i.id, i.version)
  return items
}


export const catalogQuery = (params: CatalogQuery) =>
  queryOptions({
    queryKey: qk.nfts.list(params),
    // O AbortSignal do Query cancela a requisição quando os parâmetros mudam:
    // respostas de buscas antigas são descartadas (não sobrescrevem a atual).
    queryFn: async ({ signal }) => {
      const page = await nftsApi.list(params, { signal })
      note(page.items)
      return page
    },
    placeholderData: keepPreviousData,
  })

export const highlightsQuery = queryOptions({
  queryKey: qk.highlights,
  queryFn: async ({ signal }) => {
    const h = await nftsApi.highlights({ signal })
    note([h.hero, h.spotlight, ...h.related])
    return h
  },
  staleTime: 60_000,
})

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.detail(id),
    queryFn: async ({ signal }) => {
      const nft = await nftsApi.detail(id, { signal })
      note([nft])
      return nft
    },
  })

export const relatedQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.related(id),
    queryFn: async ({ signal }) => {
      const r = await nftsApi.related(id, { signal })
      note(r.items)
      return r
    },
    staleTime: 60_000,
  })

export const useCatalog = (params: CatalogQuery) => useQuery(catalogQuery(params))
export const useHighlights = () => useQuery(highlightsQuery)
export const useNftDetail = (id: string) => useQuery(nftDetailQuery(id))
export const useRelated = (id: string) => useQuery(relatedQuery(id))
