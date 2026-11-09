import type { Category, EditionKind, NftImage } from '@/api/contracts'
import type { Network } from '@/api/contracts'
import { compareEth, fromWei, percentOfEth } from '@/lib/eth'
import type { NftRecord } from '../db/types'

/**
 * Catálogo determinístico. Os 9 primeiros NFTs reproduzem os nomes e preços do Figma;
 * o restante é gerado com variedade suficiente para filtros, ordenação e paginação.
 */

const BASE_DATE = Date.UTC(2026, 6, 29, 12, 0, 0) // 29 Jul 2026 (data do recibo no Figma)
const HOUR = 3_600_000

type Seed = {
  name: string
  rating?: { average: number; count: number }
  image: NftImage
  price: string
  previousPrice?: string
  rare?: boolean
}

/** Nomes e preços exatamente como no Figma (Início / Cadastro). */
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

const PREFIXES = ['Amber', 'Cobalt', 'Velvet', 'Lunar', 'Rustic', 'Quiet', 'Solar', 'Copper', 'Jade', 'Cedar', 'Onyx', 'Saffron', 'Misty', 'Royal', 'Wild']
const SUFFIXES = ['Ape', 'Nomad', 'Baron', 'Signal', 'Bloom', 'Vessel', 'Pilot', 'Echo', 'Sage', 'Rider', 'Monk', 'Drifter', 'Oracle']
const IMAGES: NftImage[] = ['emerald-ape', 'sage-nomad', 'neon-vessel', 'golden-beat']
const CATEGORIES: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
const NETWORKS: Network[] = ['ethereum', 'ethereum', 'polygon', 'solana']
// Uma coleção por arte (mesma ordem de IMAGES)
const COLLECTIONS = ['Kurio Apes', 'Nomad Club', 'Neon Society', 'Golden Sounds']
const CREATORS = ['Nova Sato', 'Iris Moreau', 'Kenji Ward', 'Lia Okafor']
const ATTRIBUTES = [['Óculos', 'Esmeralda', 'Raro'], ['Chapéu', 'Moletom', 'Comum'], ['Blazer', 'Gola alta', 'Épico'], ['Fones', 'Jaqueta', 'Incomum']]

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

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const EDITION_RULES: Record<EditionKind, { label: string; supply: number | null; maxPerOrder: number; priceBps: number }> = {
  '1-1': { label: '1/1', supply: 1, maxPerOrder: 1, priceBps: 80_000 }, // 8× o preço base
  '1-10': { label: '1/10', supply: 10, maxPerOrder: 3, priceBps: 30_000 }, // 3×
  '1-50': { label: '1/50', supply: 50, maxPerOrder: 10, priceBps: 15_000 }, // 1,5×
  aberta: { label: 'ABERTA', supply: null, maxPerOrder: 20, priceBps: 10_000 }, // preço base
}

function buildNft(index: number, seed: Seed, random: () => number): NftRecord {
  const id = slugify(seed.name)
  const number = seed.name.split('#')[1] ?? String(index).padStart(3, '0')
  const imageIndex = IMAGES.indexOf(seed.image)

  // Todo NFT tem a edição aberta (preço base = preço exibido no card) e de 1 a 3 edições limitadas.
  const limited: EditionKind[] = (['1-1', '1-10', '1-50'] as const).filter((_, i) => index % 3 === i || random() > 0.4)
  const kinds: EditionKind[] = [...(limited.length ? limited : (['1-50'] as EditionKind[])), 'aberta']

  const editions = kinds.map((kind) => {
    const rule = EDITION_RULES[kind]
    let available = rule.supply === null ? 500 : Math.max(0, rule.supply - Math.floor(random() * rule.supply))
    if (kind === '1-1' && index % 4 === 0) available = 0 // algumas 1/1 já vendidas → "edição indisponível"
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
    gallery: [0, 1, 2, 3].map((k) => IMAGES[(imageIndex + k) % 4]),
    collection: COLLECTIONS[imageIndex],
    creator: CREATORS[index % CREATORS.length],
    category: CATEGORIES[index % CATEGORIES.length],
    network: NETWORKS[index % NETWORKS.length],
    previousPrice: seed.previousPrice ?? null,
    rare: seed.rare ?? random() > 0.8,
    listedAt: new Date(BASE_DATE - index * 7 * HOUR).toISOString(),
    trendingScore: Math.round(random() * 1000),
    attributes: ATTRIBUTES[imageIndex],
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
  let i = 0
  while (seeds.length < 54) {
    const prefix = PREFIXES[i % PREFIXES.length]
    const suffix = SUFFIXES[(i * 7) % SUFFIXES.length]
    const number = String(100 + ((i * 37) % 900)).padStart(3, '0')
    // Preços distribuídos entre 0.02 e 12.30 ETH (faixa do filtro no Figma), com 2 casas.
    const cents = i === 0 ? 2n : i === 1 ? 1230n : BigInt(20 + Math.floor(random() * 480))
    seeds.push({ name: `${prefix} ${suffix} #${number}`, image: IMAGES[i % 4], price: fromWei(cents * 10n ** 16n) })
    i++
  }
  const nfts = seeds.map((seed, index) => buildNft(index, seed, random))
  // Um NFT totalmente esgotado para o estado "indisponível".
  const soldOut = nfts.find((n) => n.id === 'golden-frequency-071')!
  soldOut.editions.forEach((e) => (e.available = 0))
  return nfts
}

/** Menor preço entre edições disponíveis (ou entre todas, se esgotado). */
export function displayPrice(nft: NftRecord): string {
  const pool = nft.editions.some((e) => e.available > 0) ? nft.editions.filter((e) => e.available > 0) : nft.editions
  return pool.map((e) => e.price).reduce((min, p) => (compareEth(p, min) < 0 ? p : min))
}
