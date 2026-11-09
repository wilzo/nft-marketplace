import type {
  AppliedCoupon,
  Category,
  Edition,
  Network,
  NftImage,
  Order,
  QuoteLine,
  WalletSlot,
  WalletType,
} from '@/api/contracts'

/** Registros internos do banco simulado (mais ricos que os contratos expostos). */

export interface NftRecord {
  id: string
  name: string
  tokenId: string
  image: NftImage
  gallery: NftImage[]
  collection: string
  creator: string
  category: Category
  network: Network
  previousPrice: string | null
  rare: boolean
  listedAt: string
  trendingScore: number
  attributes: string[]
  rating: { average: number; count: number }
  royaltyPercent: number
  contractAddress: string
  standard: string
  editions: Edition[]
  version: number
}

export interface UserRecord {
  id: string
  username: string
  displayName: string
  email: string
  ensName: string | null
  walletNickname: string | null
  avatarUrl: string | null
  /** PBKDF2-SHA256 (base64). A senha nunca é armazenada em claro. */
  passwordHash: string
  passwordSalt: string
  updatedAt: string
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface WalletRecord {
  id: string
  userId: string
  slot: WalletSlot
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress: string | null
  walletType: WalletType
  referralCode: string
  email: string
  ensName: string
  updatedAt: string
}

export interface CartItemRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Último preço unitário visto/aceito pelo usuário (base para "preço alterado"). */
  seenUnitPrice: string
}

export interface CartRecord {
  id: string
  /** null = carrinho de visitante. */
  userId: string | null
  items: CartItemRecord[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface CouponRecord {
  code: string
  label: string
  basisPoints: number
  expiresAt: string
}

export interface QuoteRecord {
  id: string
  cartId: string
  cartVersion: number
  userId: string | null
  network: Network
  lines: QuoteLine[]
  subtotal: string
  discount: string
  networkFee: string
  total: string
  coupon: AppliedCoupon | null
  createdAt: string
  expiresAt: string
}

export interface OrderRecord extends Order {
  /** Desfecho predeterminado pelo cenário ativo na criação. */
  outcome: 'confirmed' | 'declined'
  /** Momento em que o pagamento simulado é liquidado (pendente → terminal). */
  settleAt: string
  /** Itens e quantidades reservados (para liberar em caso de recusa). */
  reservations: { nftId: string; editionId: string; quantity: number }[]
}

export interface IdempotencyRecord {
  key: string
  userId: string
  bodyHash: string
  orderId: string
  /** Primeira resposta já foi entregue? (usado pelo cenário de timeout) */
  responded: boolean
}

export interface WalletConnectionRecord {
  id: string
  userId: string
  walletId: string
  network: Network
  connectedAt: string
}

export interface DbState {
  schemaVersion: number
  nfts: NftRecord[]
  users: UserRecord[]
  sessions: SessionRecord[]
  wallets: WalletRecord[]
  favorites: Record<string, string[]>
  carts: CartRecord[]
  coupons: CouponRecord[]
  quotes: QuoteRecord[]
  orders: OrderRecord[]
  idempotency: IdempotencyRecord[]
  walletConnections: WalletConnectionRecord[]
  /** Contadores para ids determinísticos. */
  counters: Record<string, number>
}
