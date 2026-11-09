import type { Category, EditionKind, Network, NftImage } from '@/api/contracts'
import { compareEth, fromWei, percentOfEth } from '@/lib/eth'
import type { NftRecord } from '../db/types'

/**
 * Catálogo determinístico, fiel ao Figma:
 *  - os 9 primeiros NFTs reproduzem nomes, preços, artes, selo RARO e preço anterior dos frames;
 *  - as contagens por coleção são exatamente as do filtro do Figma (33, 12, 65, 39, 23, 17, 19, 13, 18 = 239 NFTs);
 *  - todo NFT tem as 4 edições do Figma (1/1, 1/10, 1/50, ABERTA); a 1/50 é a padrão e tem o preço do card.
 * As contagens de rede do Figma (119/78/86 = 283) não somam 239 — são distribuídas proporcionalmente (ver ARCHITECTURE.md).
 */

const BASE_DATE = Date.UTC(2026, 6, 29, 12, 0, 0) // 29 Jul 2026 (data do recibo no Figma)
const HOUR = 3_600_000

type Seed = {
  name: string
  image: NftImage
  price: string
  previousPrice?: string
  rare?: boolean
  rating?: { average: number; count: number }
}

/** Nomes e preços exatamente como no Figma (Início / Cadastro / Detalhes). */
const FIGMA_SEEDS: Seed[] = [
  { name: 'Emerald Ape #042', image: 'emerald-ape', price: '1.19', rating: { average: 4.8, count: 19 } },
  { name: 'Sage Nomad #009', image: 'sage-nomad', price: '1.69' },
  { name: 'Neon Vessel #552', image: 'neon-vessel', price: '1.99', previousPrice: '2.29', rare: true },
  { name: 'Cosmic Bloom #118', image: 'sage-nomad', price: '1.29' },
  { name: 'Violet Nomad #314', image: 'sage-nomad', price: '1.39' },
  { name: 'Ivory Baron #088', image: 'neon-vessel', price: '1.79' },
  { name: 'Golden Beat #207', image: 'golden-beat', price: '0.99' },
  { name: 'Golden Frequency #071', image: 'golden-beat', price: '0.59' },
  { name: 'Golden Signal #160', image: 'golden-beat', price: '0.39' },
]
const FIGMA_COUNT = FIGMA_SEEDS.length

/** Contagens do filtro "Coleções" no Figma. */
const CATEGORY_COUNTS: [Category, number][] = [
  ['arte-digital', 33],
  ['fotografia', 12],
  ['musica', 65],
  ['arte-3d', 39],
  ['colecionaveis', 23],
  ['generativa', 17],
  ['jogos', 19],
  ['assinaturas', 13],
  ['utilidade', 18],
]
const TOTAL = CATEGORY_COUNTS.reduce((n, [, c]) => n + c, 0) // 239

/** Proporção das redes do Figma (119/78/86) aplicada a 239 NFTs. */
const NETWORK_COUNTS: [Network, number][] = [
  ['ethereum', 100],
  ['polygon', 66],
  ['solana', 73],
]

const PREFIXES = ['Amber', 'Cobalt', 'Velvet', 'Lunar', 'Rustic', 'Quiet', 'Solar', 'Copper', 'Jade', 'Cedar', 'Onyx', 'Saffron', 'Misty', 'Royal', 'Wild', 'Ember', 'Frost']
const SUFFIXES = ['Ape', 'Nomad', 'Baron', 'Signal', 'Bloom', 'Vessel', 'Pilot', 'Echo', 'Sage', 'Rider', 'Monk', 'Drifter', 'Oracle', 'Frequency']
const IMAGES: NftImage[] = ['emerald-ape', 'sage-nomad', 'neon-vessel', 'golden-beat']
const COLLECTIONS: Record<NftImage, string> = {
  'emerald-ape': 'Kurio Apes',
  'sage-nomad': 'Nomad Club',
  'neon-vessel': 'Neon Society',
  'golden-beat': 'Golden Sounds',
}
const CREATORS = ['Nova Sato', 'Iris Moreau', 'Kenji Ward', 'Lia Okafor']
const ATTRIBUTES: Record<NftImage, string[]> = {
  'emerald-ape': ['Óculos', 'Esmeralda', 'Raro'],
  'sage-nomad': ['Chapéu', 'Moletom', 'Comum'],
  'neon-vessel': ['Blazer', 'Gola alta', 'Épico'],
  'golden-beat': ['Fones', 'Jaqueta', 'Incomum'],
}

/** PRNG determinístico (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function shuffled<T>(list: T[], random: () => number) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const expand = <T,>(counts: [T, number][]) => counts.flatMap(([v, n]) => Array.from({ length: n }, () => v))

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Regras das edições (preço relativo ao preço base do card, que é o da 1/50). */
const EDITION_RULES: Record<EditionKind, { label: string; supply: number | null; maxPerOrder: number; priceBps: number }> = {
  '1-1': { label: '1/1', supply: 1, maxPerOrder: 1, priceBps: 80_000 },
  '1-10': { label: '1/10', supply: 10, maxPerOrder: 3, priceBps: 30_000 },
  '1-50': { label: '1/50', supply: 50, maxPerOrder: 10, priceBps: 10_000 },
  aberta: { label: 'ABERTA', supply: null, maxPerOrder: 20, priceBps: 8_000 },
}
const KINDS: EditionKind[] = ['1-1', '1-10', '1-50', 'aberta']

function buildNft(index: number, seed: Seed, category: Category, network: Network, random: () => number): NftRecord {
  const id = slugify(seed.name)
  const number = seed.name.split('#')[1] ?? String(index).padStart(3, '0')
  const fromFigma = index < FIGMA_COUNT

  const editions = KINDS.map((kind) => {
    const rule = EDITION_RULES[kind]
    let available: number
    if (kind === 'aberta') available = 500
    else if (kind === '1-50') available = 50 - Math.floor(random() * 15) // sempre ≥ 36 (cabe o carrinho do Figma)
    else if (kind === '1-10') available = 2 + Math.floor(random() * 9)
    else available = 1
    // Estados de indisponibilidade só fora dos NFTs exibidos no Figma
    if (!fromFigma && kind === '1-1' && index % 4 === 1) available = 0
    return {
      id: `${id}--${kind}`,
      kind,
      label: rule.label,
      supply: rule.supply,
      available,
      maxPerOrder: rule.maxPerOrder,
      price: percentOfEth(seed.price, rule.priceBps),
    }
  })

  return {
    id,
    name: seed.name,
    tokenId: `#${number.padStart(4, '0')}`,
    image: seed.image,
    // Galeria do Figma: a mesma arte nas 4 miniaturas
    gallery: [seed.image, seed.image, seed.image, seed.image],
    collection: COLLECTIONS[seed.image],
    creator: CREATORS[index % CREATORS.length],
    category,
    network,
    previousPrice: seed.previousPrice ?? null,
    rare: fromFigma ? !!seed.rare : random() > 0.82,
    listedAt: new Date(BASE_DATE - index * 3 * HOUR).toISOString(),
    trendingScore: Math.round(random() * 1000),
    attributes: ATTRIBUTES[seed.image],
    rating: seed.rating ?? { average: Math.round((3.8 + random() * 1.2) * 10) / 10, count: 5 + Math.floor(random() * 40) },
    royaltyPercent: 5,
    contractAddress: `0x7A42${(index * 7919).toString(16).padStart(6, '0').toUpperCase()}${'0'.repeat(26)}19E8`,
    standard: 'ERC-721',
    editions,
    version: 1,
  }
}

export function createNftFixtures(): NftRecord[] {
  const random = rng(20260729)

  const seeds: Seed[] = [...FIGMA_SEEDS]
  const used = new Set(seeds.map((s) => s.name))
  let i = 0
  while (seeds.length < TOTAL) {
    const name = `${PREFIXES[i % PREFIXES.length]} ${SUFFIXES[(i * 7) % SUFFIXES.length]} #${String(100 + ((i * 37) % 900)).padStart(3, '0')}`
    i++
    if (used.has(name)) continue
    used.add(name)
    // Faixa do filtro de preço do Figma: 0,02 – 12,30 ETH
    const cents = seeds.length === FIGMA_COUNT ? 2n : seeds.length === FIGMA_COUNT + 1 ? 1230n : BigInt(20 + Math.floor(random() * 480))
    seeds.push({ name, image: IMAGES[i % 4], price: fromWei(cents * 10n ** 16n) })
  }

  // Coleções: os 9 do Figma em "Arte digital"; o restante embaralhado mantendo as contagens exatas.
  const categoriesRest = expand(CATEGORY_COUNTS)
  for (let k = 0; k < FIGMA_COUNT; k++) categoriesRest.splice(categoriesRest.indexOf('arte-digital'), 1)
  const categories: Category[] = [...Array.from({ length: FIGMA_COUNT }, () => 'arte-digital' as const), ...shuffled(categoriesRest, random)]

  // Redes: os 9 do Figma na Ethereum (o detalhe diz "verificado na Ethereum").
  const networksRest = expand(NETWORK_COUNTS)
  for (let k = 0; k < FIGMA_COUNT; k++) networksRest.splice(networksRest.indexOf('ethereum'), 1)
  const networks: Network[] = [...Array.from({ length: FIGMA_COUNT }, () => 'ethereum' as const), ...shuffled(networksRest, random)]

  const nfts = seeds.map((seed, index) => buildNft(index, seed, categories[index], networks[index], random))
  // Um NFT totalmente esgotado (fora do Figma) para o estado "indisponível".
  nfts[FIGMA_COUNT + 2].editions.forEach((e) => (e.available = 0))
  return nfts
}

/** Edição padrão: a 1/50 (como selecionada no Figma); se esgotada, a mais barata disponível. */
export function defaultEdition(nft: NftRecord) {
  const preferred = nft.editions.find((e) => e.kind === '1-50' && e.available > 0)
  if (preferred) return preferred
  const pool = nft.editions.some((e) => e.available > 0) ? nft.editions.filter((e) => e.available > 0) : nft.editions
  return pool.reduce((min, e) => (compareEth(e.price, min.price) < 0 ? e : min))
}

/** Preço exibido no card = preço da edição padrão. */
export function displayPrice(nft: NftRecord): string {
  return defaultEdition(nft).price
}
