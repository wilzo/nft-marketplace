import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CatalogPage, Highlights, NftDetail, NftSummary, NftUpdatedEvent } from '@/api/contracts'
import { qk } from '@/lib/query-keys'
import { realtime } from '@/lib/realtime'

function patchSummary<T extends NftSummary>(item: T, e: NftUpdatedEvent): T {
  if (item.id !== e.resource.id || item.version >= e.version) return item
  return { ...item, price: e.data.price, previousPrice: e.data.previousPrice, available: e.data.available, version: e.version }
}

/** Aplica `nft.updated` em todas as consultas que exibem o NFT (catálogo, destaques, relacionados, detalhe). */
export function applyNftUpdated(client: QueryClient, e: NftUpdatedEvent) {
  client.setQueriesData<CatalogPage>({ queryKey: qk.nfts.lists }, (page) =>
    page ? { ...page, items: page.items.map((i) => patchSummary(i, e)) } : page,
  )
  client.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['nfts', 'related'] }, (r) =>
    r ? { ...r, items: r.items.map((i) => patchSummary(i, e)) } : r,
  )
  client.setQueryData<Highlights>(qk.highlights, (h) =>
    h ? { hero: patchSummary(h.hero, e), spotlight: patchSummary(h.spotlight, e), related: h.related.map((i) => patchSummary(i, e)) } : h,
  )
  client.setQueryData<NftDetail>(qk.nfts.detail(e.resource.id), (d) => {
    if (!d || d.version >= e.version) return d
    const editions = d.editions.map((ed) => {
      const u = e.data.editions.find((x) => x.id === ed.id)
      return u ? { ...ed, price: u.price, available: u.available } : ed
    })
    return { ...patchSummary(d, e), editions }
  })
  // O carrinho é recalculado pelo servidor (status de preço/disponibilidade por item).
  client.invalidateQueries({ queryKey: qk.private.all, predicate: (q) => q.queryKey.at(-1) === 'cart' })
}

/**
 * Liga os eventos Socket.IO ao cache do TanStack Query durante a vida da aplicação.
 * Após reconexão, reconcilia os recursos ativos com a API REST (eventos perdidos durante a queda).
 */
export function useRealtimeSync() {
  const client = useQueryClient()
  useEffect(() => {
    const offNft = realtime.on('nft.updated', (e) => applyNftUpdated(client, e))
    const offReconnect = realtime.onReconnect(() => {
      void client.invalidateQueries({ queryKey: qk.nfts.all })
      void client.invalidateQueries({ queryKey: qk.highlights })
      void client.invalidateQueries({ queryKey: qk.private.all })
    })
    return () => {
      offNft()
      offReconnect()
    }
  }, [client])
}
