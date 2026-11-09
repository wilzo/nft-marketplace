import { http, HttpResponse } from 'msw'
import {
  CatalogQuery,
  CATEGORIES,
  NETWORKS,
  type CatalogPage,
  type Highlights,
  type NftSummary,
} from '@/api/contracts'
import { compareEth } from '@/lib/eth'
import { getDb } from '../db/store'
import type { NftRecord } from '../db/types'
import { displayPrice } from '../fixtures/nfts'
import { toNftDetail, toNftSummary } from '../domain/mappers'
import { api, apiError, toFieldErrors } from '../lib/http'
import { getScenario } from '../scenarios'

const DAY = 86_400_000
/** "Novos lançamentos": listados até 10 dias antes do mais recente. */
const NEW_WINDOW_MS = 10 * DAY
/** "Em alta": pontuação de tendência mínima. */
const TRENDING_MIN = 600

/** Lista exibida no Figma em "Mais desta coleção" e "Colecionadores também viram". */
const CURATED_RELATED = ['cosmic-bloom-118', 'violet-nomad-314', 'ivory-baron-088', 'golden-beat-207', 'golden-signal-160']
const RELATED_SIZE = 15 // 3 páginas de 5 (indicadores do carrossel no Figma)

function relatedTo(all: NftRecord[], excludeId: string | null) {
  const byId = new Map(all.map((n) => [n.id, n]))
  const curated = CURATED_RELATED.filter((id) => id !== excludeId).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  const rest = [...all]
    .filter((n) => n.id !== excludeId && !CURATED_RELATED.includes(n.id) && n.editions.some((e) => e.available > 0))
    .sort((a, b) => b.trendingScore - a.trendingScore)
  return [...curated, ...rest].slice(0, RELATED_SIZE)
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type Query = ReturnType<typeof CatalogQuery.parse>

function matches(n: NftRecord, q: Query, newest: number, skip?: 'category' | 'network') {
  if (q.q) {
    const term = normalize(q.q)
    if (![n.name, n.collection, n.creator].some((f) => normalize(f).includes(term))) return false
  }
  if (skip !== 'category' && q.category?.length && !q.category.includes(n.category)) return false
  if (skip !== 'network' && q.network?.length && !q.network.includes(n.network)) return false
  const price = displayPrice(n)
  if (q.minPrice && compareEth(price, q.minPrice) < 0) return false
  if (q.maxPrice && compareEth(price, q.maxPrice) > 0) return false
  if (q.tab === 'novos' && newest - new Date(n.listedAt).getTime() > NEW_WINDOW_MS) return false
  if (q.tab === 'em-alta' && n.trendingScore < TRENDING_MIN) return false
  return true
}

function sortNfts(list: NftRecord[], sort: Query['sort']) {
  const byName = (a: NftRecord, b: NftRecord) => a.name.localeCompare(b.name, 'pt-BR')
  const sorted = [...list]
  switch (sort) {
    case 'preco-asc':
      return sorted.sort((a, b) => compareEth(displayPrice(a), displayPrice(b)) || byName(a, b))
    case 'preco-desc':
      return sorted.sort((a, b) => compareEth(displayPrice(b), displayPrice(a)) || byName(a, b))
    case 'nome':
      return sorted.sort(byName)
    default:
      return sorted.sort((a, b) => b.listedAt.localeCompare(a.listedAt) || byName(a, b))
  }
}

export const catalogHandlers = [
  http.get(api('/nfts'), ({ request }) => {
    const sp = new URL(request.url).searchParams
    const parsed = CatalogQuery.safeParse({
      q: sp.get('q') ?? undefined,
      category: sp.getAll('category'),
      network: sp.getAll('network'),
      minPrice: sp.get('minPrice') ?? undefined,
      maxPrice: sp.get('maxPrice') ?? undefined,
      tab: sp.get('tab') ?? undefined,
      sort: sp.get('sort') ?? undefined,
      page: sp.get('page') ?? undefined,
      pageSize: sp.get('pageSize') ?? undefined,
    })
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos', { fieldErrors: toFieldErrors(parsed.error) })
    }
    const q = parsed.data
    const all = getScenario().emptyCatalog ? [] : getDb().nfts
    const newest = Math.max(0, ...all.map((n) => new Date(n.listedAt).getTime()))

    const filtered = sortNfts(all.filter((n) => matches(n, q, newest)), q.sort)
    const total = filtered.length
    const totalPages = Math.ceil(total / q.pageSize)
    const start = (q.page - 1) * q.pageSize

    const countBy = <T extends string>(values: readonly T[], key: 'category' | 'network') => {
      const base = all.filter((n) => matches(n, q, newest, key))
      return values.map((value) => ({ value, count: base.filter((n) => n[key] === value).length }))
    }
    const prices = all.map(displayPrice).sort(compareEth)

    const body: CatalogPage = {
      items: filtered.slice(start, start + q.pageSize).map(toNftSummary),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages,
      facets: {
        category: countBy(CATEGORIES, 'category'),
        network: countBy(NETWORKS, 'network'),
        priceRange: { min: prices[0] ?? '0', max: prices.at(-1) ?? '0' },
      },
    }
    return HttpResponse.json(body)
  }),

  http.get(api('/nfts/:id'), ({ params }) => {
    const nft = getDb().nfts.find((n) => n.id === params.id)
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
    return HttpResponse.json(toNftDetail(nft))
  }),

  http.get(api('/nfts/:id/related'), ({ params }) => {
    const db = getDb()
    const nft = db.nfts.find((n) => n.id === params.id)
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
    const items: NftSummary[] = relatedTo(db.nfts, nft.id).map(toNftSummary)
    return HttpResponse.json({ items })
  }),

  http.get(api('/highlights'), () => {
    const db = getDb()
    const byId = (id: string) => toNftSummary(db.nfts.find((n) => n.id === id)!)
    const body: Highlights = {
      hero: byId('emerald-ape-042'),
      spotlight: byId('sage-nomad-009'),
      related: relatedTo(db.nfts, null).map(toNftSummary),
    }
    return HttpResponse.json(body)
  }),
]
