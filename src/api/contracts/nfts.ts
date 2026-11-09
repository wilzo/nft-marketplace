import { z } from 'zod'
import { EthAmount, IsoDateTime, Network, paginated } from './common'

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const Category = z.enum(CATEGORIES)
export type Category = z.infer<typeof Category>

export const CATEGORY_LABELS: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

/** Abas do catálogo (Figma: "Todos os NFTs", "Novos lançamentos", "Em alta"). */
export const CATALOG_TABS = ['todos', 'novos', 'em-alta'] as const
export const CatalogTab = z.enum(CATALOG_TABS)
export type CatalogTab = z.infer<typeof CatalogTab>

export const CATALOG_SORTS = ['recentes', 'preco-asc', 'preco-desc', 'nome'] as const
export const CatalogSort = z.enum(CATALOG_SORTS)
export type CatalogSort = z.infer<typeof CatalogSort>

export const SORT_LABELS: Record<CatalogSort, string> = {
  recentes: 'Listados recentemente',
  'preco-asc': 'Menor preço',
  'preco-desc': 'Maior preço',
  nome: 'Nome (A–Z)',
}

/** Imagens disponíveis (artes do Figma, servidas em public/images/nfts/{key}-{320|640|960}.webp). */
export const NFT_IMAGES = ['emerald-ape', 'sage-nomad', 'neon-vessel', 'golden-beat'] as const
export const NftImage = z.enum(NFT_IMAGES)
export type NftImage = z.infer<typeof NftImage>

/** Edições do Figma: 1/1, 1/10, 1/50 e ABERTA. */
export const EDITION_KINDS = ['1-1', '1-10', '1-50', 'aberta'] as const
export const EditionKind = z.enum(EDITION_KINDS)
export type EditionKind = z.infer<typeof EditionKind>

export const Edition = z.object({
  id: z.string(),
  kind: EditionKind,
  label: z.string(),
  /** null = edição aberta (sem limite de tiragem). */
  supply: z.number().int().positive().nullable(),
  /** Unidades ainda disponíveis para compra. 0 = esgotada. */
  available: z.number().int().min(0),
  /** Limite por pedido (independente do estoque). */
  maxPerOrder: z.number().int().positive(),
  price: EthAmount,
})
export type Edition = z.infer<typeof Edition>

export const NftSummary = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: NftImage,
  collection: z.string(),
  creator: z.string(),
  category: Category,
  network: Network,
  /** Menor preço entre as edições disponíveis. */
  price: EthAmount,
  /** Preço anterior, quando houve redução (exibido riscado). */
  previousPrice: EthAmount.nullable(),
  rare: z.boolean(),
  /** Soma das unidades disponíveis em todas as edições. */
  available: z.number().int().min(0),
  listedAt: IsoDateTime,
  /** Versão do recurso; incrementa a cada alteração (usada para ordenar eventos). */
  version: z.number().int().min(1),
})
export type NftSummary = z.infer<typeof NftSummary>

export const NftDetail = NftSummary.extend({
  summary: z.string(),
  description: z.string(),
  attributes: z.array(z.string()),
  contractAddress: z.string(),
  standard: z.string(),
  royaltyPercent: z.number(),
  rating: z.object({ average: z.number().min(0).max(5), count: z.number().int().min(0) }),
  editions: z.array(Edition).min(1),
  gallery: z.array(NftImage).min(1),
})
export type NftDetail = z.infer<typeof NftDetail>

/** Parâmetros da listagem. Arrays trafegam como parâmetros repetidos (?category=a&category=b). */
export const CatalogQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.array(Category).optional(),
  network: z.array(Network).optional(),
  minPrice: EthAmount.optional(),
  maxPrice: EthAmount.optional(),
  tab: CatalogTab.default('todos'),
  sort: CatalogSort.default('recentes'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(9),
})
export type CatalogQuery = z.input<typeof CatalogQuery>

export const FacetCount = z.object({ value: z.string(), count: z.number().int().min(0) })

export const CatalogPage = paginated(NftSummary).extend({
  facets: z.object({
    category: z.array(FacetCount),
    network: z.array(FacetCount),
    priceRange: z.object({ min: EthAmount, max: EthAmount }),
  }),
})
export type CatalogPage = z.infer<typeof CatalogPage>

/** Destaques da home: hero, card "NFT em destaque / oferta limitada" e banners. */
export const Highlights = z.object({
  hero: NftSummary,
  spotlight: NftSummary,
  related: z.array(NftSummary),
})
export type Highlights = z.infer<typeof Highlights>

export const RelatedNfts = z.object({ items: z.array(NftSummary) })
