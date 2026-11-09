import type { AppliedCoupon, Cart, CartItem, CartItemStatus, Network, QuoteIssue, QuoteLine } from '@/api/contracts'
import { addEth, compareEth, fromWei, mulEth, percentOfEth, toWei } from '@/lib/eth'
import { getDb, nextId, nowIso, transact } from '../db/store'
import type { CartRecord, DbState, NftRecord, OrderRecord, QuoteRecord } from '../db/types'
import { publishNftUpdated, publishOrderUpdated } from '../realtime'
import { getScenario } from '../scenarios'
import { sha256Hex } from '../lib/crypto'

/** Taxa de rede simulada por rede (Figma: 0.016 ETH na Ethereum). */
export const NETWORK_FEES: Record<Network, string> = { ethereum: '0.016', polygon: '0.002', solana: '0.001' }
export const QUOTE_TTL_MS = 5 * 60_000

export function findEdition(db: DbState, nftId: string, editionId: string) {
  const nft = db.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : null
}

function itemStatus(quantity: number, available: number, maxPerOrder: number, price: string, seen: string): CartItemStatus {
  if (available === 0) return 'sold_out'
  if (quantity > Math.min(available, maxPerOrder)) return 'quantity_exceeds'
  if (compareEth(price, seen) !== 0) return 'price_changed'
  return 'ok'
}

export function toCartView(db: DbState, cart: CartRecord): Cart {
  const items: CartItem[] = cart.items.flatMap((item) => {
    const found = findEdition(db, item.nftId, item.editionId)
    if (!found) return []
    const { nft, edition } = found
    return [
      {
        id: item.id,
        nftId: nft.id,
        editionId: edition.id,
        name: nft.name,
        tokenId: nft.tokenId,
        image: nft.image,
        editionLabel: edition.label,
        quantity: item.quantity,
        unitPrice: edition.price,
        seenUnitPrice: item.seenUnitPrice,
        lineTotal: mulEth(edition.price, item.quantity),
        available: edition.available,
        maxPerOrder: edition.maxPerOrder,
        status: itemStatus(item.quantity, edition.available, edition.maxPerOrder, edition.price, item.seenUnitPrice),
      },
    ]
  })
  return {
    id: cart.id,
    owner: cart.userId ? 'user' : 'guest',
    items,
    couponCode: cart.couponCode,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

export function touchCart(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = nowIso()
}

/** Carrinho do usuário autenticado ou do visitante (header X-Cart-Id). Cria se `create`. */
export function resolveCart(db: DbState, userId: string | null, guestCartId: string | null, create: boolean): CartRecord | null {
  let cart = userId
    ? db.carts.find((c) => c.userId === userId)
    : guestCartId
      ? db.carts.find((c) => c.id === guestCartId && c.userId === null)
      : undefined
  if (!cart && create) {
    cart = { id: userId ? `cart_${userId}` : nextId('cart_guest'), userId, items: [], couponCode: null, version: 1, updatedAt: nowIso() }
    db.carts.push(cart)
  }
  return cart ?? null
}

export type CouponCheck = { ok: true; coupon: AppliedCoupon } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED' }

export function checkCoupon(db: DbState, code: string): CouponCheck {
  const coupon = db.coupons.find((c) => c.code === code.toUpperCase())
  if (!coupon) return { ok: false, code: 'COUPON_INVALID' }
  if (coupon.expiresAt <= nowIso()) return { ok: false, code: 'COUPON_EXPIRED' }
  return { ok: true, coupon: { code: coupon.code, label: coupon.label, basisPoints: coupon.basisPoints } }
}

/** Calcula a cotação a partir do estado atual do catálogo (sempre em wei, sem float). */
export function computeQuote(db: DbState, cart: CartRecord, network: Network) {
  const view = toCartView(db, cart)
  const lines: QuoteLine[] = view.items.map((i) => ({
    itemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    name: i.name,
    tokenId: i.tokenId,
    image: i.image,
    editionLabel: i.editionLabel,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  }))
  const issues: QuoteIssue[] = view.items.flatMap<QuoteIssue>((i) => {
    if (i.status === 'sold_out') return [{ type: 'SOLD_OUT', itemId: i.id }]
    if (i.status === 'quantity_exceeds') return [{ type: 'QUANTITY_EXCEEDS', itemId: i.id, requested: i.quantity, available: Math.min(i.available, i.maxPerOrder) }]
    if (i.status === 'price_changed') return [{ type: 'PRICE_CHANGED', itemId: i.id, previous: i.seenUnitPrice, current: i.unitPrice }]
    return []
  })
  const subtotal = lines.length ? addEth(...lines.map((l) => l.lineTotal)) : '0'
  let coupon: AppliedCoupon | null = null
  if (cart.couponCode) {
    const check = checkCoupon(db, cart.couponCode)
    if (check.ok) coupon = check.coupon
    else issues.push({ type: check.code === 'COUPON_EXPIRED' ? 'COUPON_EXPIRED' : 'COUPON_INVALID', code: cart.couponCode })
  }
  const discount = coupon ? percentOfEth(subtotal, coupon.basisPoints) : '0'
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const total = fromWei(toWei(subtotal) - toWei(discount) + toWei(networkFee))
  return { lines, subtotal, discount, networkFee, total, coupon, issues }
}

export function createQuoteRecord(db: DbState, cart: CartRecord, userId: string | null, network: Network) {
  const computed = computeQuote(db, cart, network)
  const record: QuoteRecord = {
    id: nextId('quo'),
    cartId: cart.id,
    cartVersion: cart.version,
    userId,
    network,
    lines: computed.lines,
    subtotal: computed.subtotal,
    discount: computed.discount,
    networkFee: computed.networkFee,
    total: computed.total,
    coupon: computed.coupon,
    createdAt: nowIso(),
    expiresAt: nowIso(QUOTE_TTL_MS),
  }
  db.quotes = [...db.quotes.filter((q) => q.cartId !== cart.id || q.expiresAt > nowIso()), record].slice(-50)
  return { record, issues: computed.issues }
}

/** Duas cotações são equivalentes se itens, quantidades e valores forem idênticos. */
export function sameQuote(a: Pick<QuoteRecord, 'lines' | 'total' | 'discount' | 'networkFee'>, b: typeof a) {
  const key = (q: typeof a) =>
    JSON.stringify([q.total, q.discount, q.networkFee, q.lines.map((l) => [l.editionId, l.quantity, l.unitPrice])])
  return key(a) === key(b)
}

export function bumpNft(nft: NftRecord) {
  nft.version += 1
}

/** Ajusta disponibilidade (reserva negativa, liberação positiva) e publica nft.updated. */
export function adjustAvailability(db: DbState, reservations: OrderRecord['reservations'], sign: 1 | -1) {
  const touched = new Set<NftRecord>()
  for (const r of reservations) {
    const found = findEdition(db, r.nftId, r.editionId)
    if (!found) continue
    found.edition.available = Math.max(0, found.edition.available + sign * r.quantity)
    touched.add(found.nft)
  }
  for (const nft of touched) {
    bumpNft(nft)
    publishNftUpdated(nft)
  }
}

// ---------- Liquidação do pagamento simulado ----------

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Liquida o pagamento simulado imediatamente (também usado pela API de controle). */
export async function settle(orderId: string) {
  clearTimeout(timers.get(orderId))
  timers.delete(orderId)
  const txHash = `0x${await sha256Hex(`kurio-tx-${orderId}`)}`
  const order = transact((db) => {
    const o = db.orders.find((x) => x.id === orderId)
    if (!o || o.status !== 'pending') return null // terminais não mudam
    o.version += 1
    o.updatedAt = nowIso()
    if (o.outcome === 'confirmed') {
      o.status = 'confirmed'
      o.confirmedAt = o.updatedAt
      o.txHash = txHash
      o.explorerUrl = `https://etherscan.io/tx/${txHash}`
      // Remove do carrinho apenas os itens e quantidades comprados.
      const cart = db.carts.find((c) => c.userId === o.userId)
      if (cart) {
        for (const line of o.lines) {
          const item = cart.items.find((i) => i.editionId === line.editionId)
          if (!item) continue
          item.quantity -= line.quantity
        }
        cart.items = cart.items.filter((i) => i.quantity > 0)
        cart.couponCode = cart.items.length ? cart.couponCode : null
        touchCart(cart)
      }
    } else {
      o.status = 'declined'
      o.failureReason = 'Pagamento recusado pela carteira na simulação. Nenhum valor foi cobrado.'
      adjustAvailability(db, o.reservations, 1)
    }
    return o
  })
  if (order) publishOrderUpdated(order)
}

export function scheduleSettlement(order: OrderRecord) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const delay = Math.max(0, new Date(order.settleAt).getTime() - Date.now())
  timers.set(order.id, setTimeout(() => void settle(order.id), delay))
}

/** Recuperação após refresh: reagenda pedidos pendentes (liquidando os vencidos). */
export function resumePendingOrders() {
  for (const order of getDb().orders) scheduleSettlement(order)
}

export function newOrderSettleAt() {
  return nowIso(getScenario().checkout.settleDelayMs)
}

export function clearSettlementTimers() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}
