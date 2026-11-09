import { z } from 'zod'
import { DisplayName, Email, EnsName, ProfileName, ReferralCode, Username, WalletType } from './account'
import { EthAmount, IsoDateTime, Network, optionalText } from './common'
import { NftImage } from './nfts'

// ---------- Carrinho ----------

/**
 * Situação do item frente ao catálogo atual:
 * - ok: preço e disponibilidade válidos
 * - price_changed: preço atual difere do preço visto ao adicionar
 * - quantity_exceeds: quantidade maior que o disponível/limite
 * - sold_out: edição esgotada
 */
export const CartItemStatus = z.enum(['ok', 'price_changed', 'quantity_exceeds', 'sold_out'])
export type CartItemStatus = z.infer<typeof CartItemStatus>

export const CartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: NftImage,
  editionLabel: z.string(),
  quantity: z.number().int().positive(),
  /** Preço unitário atual do catálogo. */
  unitPrice: EthAmount,
  /** Preço unitário quando o item foi adicionado/confirmado pela última vez. */
  seenUnitPrice: EthAmount,
  lineTotal: EthAmount,
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().positive(),
  status: CartItemStatus,
})
export type CartItem = z.infer<typeof CartItem>

export const Cart = z.object({
  id: z.string(),
  /** 'guest' (visitante, identificado pelo header X-Cart-Id) ou 'user'. */
  owner: z.enum(['guest', 'user']),
  items: z.array(CartItem),
  couponCode: z.string().nullable(),
  itemCount: z.number().int().min(0),
  version: z.number().int().min(1),
  updatedAt: IsoDateTime,
})
export type Cart = z.infer<typeof Cart>

const Quantity = z.number().int('Quantidade deve ser inteira').min(1, 'Quantidade mínima é 1')

export const AddCartItemInput = z.object({ nftId: z.string(), editionId: z.string(), quantity: Quantity })
export type AddCartItemInput = z.infer<typeof AddCartItemInput>

export const UpdateCartItemInput = z.object({ quantity: Quantity })
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInput>

export const CouponInput = z.object({ code: z.string().trim().toUpperCase().min(1, 'Informe o código promocional').max(32) })
export type CouponInput = z.infer<typeof CouponInput>

export const MergeCartInput = z.object({ guestCartId: z.string() })

// ---------- Cotação ----------

export const QuoteLine = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: NftImage,
  editionLabel: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: EthAmount,
  lineTotal: EthAmount,
})
export type QuoteLine = z.infer<typeof QuoteLine>

export const AppliedCoupon = z.object({
  code: z.string(),
  label: z.string(),
  /** Desconto em pontos-base (1000 = 10%). */
  basisPoints: z.number().int().positive(),
})
export type AppliedCoupon = z.infer<typeof AppliedCoupon>

export const QuoteIssue = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PRICE_CHANGED'), itemId: z.string(), previous: EthAmount, current: EthAmount }),
  z.object({ type: z.literal('QUANTITY_EXCEEDS'), itemId: z.string(), requested: z.number().int(), available: z.number().int() }),
  z.object({ type: z.literal('SOLD_OUT'), itemId: z.string() }),
  z.object({ type: z.literal('COUPON_EXPIRED'), code: z.string() }),
  z.object({ type: z.literal('COUPON_INVALID'), code: z.string() }),
])
export type QuoteIssue = z.infer<typeof QuoteIssue>

export const QuoteInput = z.object({ network: Network.default('ethereum') })
export type QuoteInput = z.input<typeof QuoteInput>

/** Cotação: referência de valores para finalizar o pedido. Expira e é revalidada na criação do pedido. */
export const Quote = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  lines: z.array(QuoteLine),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  coupon: AppliedCoupon.nullable(),
  /** Pendências que impedem o pedido até o usuário revisar o carrinho. */
  issues: z.array(QuoteIssue),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime,
})
export type Quote = z.infer<typeof Quote>

// ---------- Pedidos ----------

export const ORDER_STATUSES = ['pending', 'confirmed', 'declined'] as const
export const OrderStatus = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof OrderStatus>

/** Campos do bloco "Perfil do colecionador" na tela de Pagamento. */
export const CollectorInput = z.object({
  displayName: DisplayName,
  username: Username,
  email: Email,
  // Obrigatórios como no layout (asterisco no Figma)
  profileName: ProfileName,
  ensName: EnsName,
  referralCode: ReferralCode,
  note: optionalText(z.string().trim().max(280, 'Use no máximo 280 caracteres')),
})
export type CollectorInput = z.input<typeof CollectorInput>

export const CreateOrderInput = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  network: Network,
  collector: CollectorInput,
})
export type CreateOrderInput = z.input<typeof CreateOrderInput>

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

export const Order = z.object({
  id: z.string(),
  number: z.string(),
  userId: z.string(),
  status: OrderStatus,
  /** Snapshot imutável da cotação aceita: alterações no catálogo não alteram o recibo. */
  lines: z.array(QuoteLine),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  coupon: AppliedCoupon.nullable(),
  network: Network,
  wallet: z.object({ id: z.string(), displayName: z.string(), address: z.string(), walletType: WalletType }),
  collector: z.object({ displayName: z.string(), username: z.string(), email: z.string() }),
  /** Referência de transação simulada (presente quando confirmado). */
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  confirmedAt: IsoDateTime.nullable(),
  version: z.number().int().min(1),
})
export type Order = z.infer<typeof Order>

export const OrderList = z.object({ items: z.array(Order) })

// ---------- Eventos de tempo real (Socket.IO) ----------

const EventBase = z.object({
  /** Identidade estável do evento: reentregas carregam o mesmo id. */
  eventId: z.string(),
  occurredAt: IsoDateTime,
  /** Versão do recurso após a mudança; o cliente ignora versões <= à que já possui. */
  version: z.number().int().min(1),
})

export const NftUpdatedEvent = EventBase.extend({
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  data: z.object({
    price: EthAmount,
    previousPrice: EthAmount.nullable(),
    available: z.number().int().min(0),
    defaultEditionId: z.string(),
    editions: z.array(z.object({ id: z.string(), price: EthAmount, available: z.number().int().min(0) })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = EventBase.extend({
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  /** Dono do pedido: o cliente descarta eventos de outro usuário. */
  userId: z.string(),
  data: z.object({
    status: OrderStatus,
    txHash: z.string().nullable(),
    failureReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export const RealtimeEvent = z.discriminatedUnion('type', [NftUpdatedEvent, OrderUpdatedEvent])
export type RealtimeEvent = z.infer<typeof RealtimeEvent>

export const REALTIME_EVENTS = ['nft.updated', 'order.updated'] as const
