import { delay, http, HttpResponse } from 'msw'
import {
  AddCartItemInput,
  CouponInput,
  CreateOrderInput,
  IDEMPOTENCY_HEADER,
  MergeCartInput,
  QuoteInput,
  UpdateCartItemInput,
  type Order,
  type Quote,
} from '@/api/contracts'
import { addEth } from '@/lib/eth'
import { getDb, nextId, nowIso, transact } from '../db/store'
import type { CartRecord, DbState, OrderRecord, QuoteRecord } from '../db/types'
import {
  adjustAvailability,
  bumpNft,
  checkCoupon,
  computeQuote,
  createQuoteRecord,
  findEdition,
  newOrderSettleAt,
  resolveCart,
  sameQuote,
  scheduleSettlement,
  toCartView,
  touchCart,
} from '../domain/commerce'
import { sha256Hex, stableStringify } from '../lib/crypto'
import { api, apiError, optionalUser, parseBody, requireUser } from '../lib/http'
import { publishNftUpdated } from '../realtime'
import { consumeCheckoutFlag, getScenario } from '../scenarios'

export const CART_HEADER = 'X-Cart-Id'

function cartFor(request: Request, db: DbState, create = true) {
  const user = optionalUser(request)
  return resolveCart(db, user?.id ?? null, request.headers.get(CART_HEADER), create)!
}

function limitFor(db: DbState, nftId: string, editionId: string) {
  const found = findEdition(db, nftId, editionId)
  if (!found) throw apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrada')
  const { edition } = found
  return { edition, limit: Math.min(edition.available, edition.maxPerOrder) }
}

function availabilityError(limit: number, maxPerOrder: number) {
  return apiError(
    409,
    'AVAILABILITY_CONFLICT',
    limit === 0 ? 'Esta edição está esgotada' : `Quantidade indisponível: máximo de ${limit} por pedido`,
    { details: { limit, maxPerOrder } },
  )
}

function toQuote(record: QuoteRecord, issues: Quote['issues']): Quote {
  return {
    id: record.id,
    cartVersion: record.cartVersion,
    lines: record.lines,
    subtotal: record.subtotal,
    discount: record.discount,
    networkFee: record.networkFee,
    total: record.total,
    coupon: record.coupon,
    issues,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }
}

function toOrder(o: OrderRecord): Order {
  const { outcome: _o, settleAt: _s, reservations: _r, ...order } = o
  return order
}

export const cartHandlers = [
  http.get(api('/cart'), ({ request }) => {
    const view = transact((db) => toCartView(db, cartFor(request, db)))
    return HttpResponse.json(view)
  }),

  http.post(api('/cart/items'), async ({ request }) => {
    const input = await parseBody(request, AddCartItemInput)
    const view = transact((db) => {
      const cart = cartFor(request, db)
      const { edition, limit } = limitFor(db, input.nftId, input.editionId)
      const existing = cart.items.find((i) => i.editionId === input.editionId)
      const quantity = (existing?.quantity ?? 0) + input.quantity
      if (quantity > limit) throw availabilityError(limit, edition.maxPerOrder)
      if (existing) {
        existing.quantity = quantity
        existing.seenUnitPrice = edition.price
      } else {
        cart.items.push({ id: nextId('item'), nftId: input.nftId, editionId: input.editionId, quantity, seenUnitPrice: edition.price })
      }
      touchCart(cart)
      return toCartView(db, cart)
    })
    return HttpResponse.json(view, { status: 201 })
  }),

  http.patch(api('/cart/items/:itemId'), async ({ request, params }) => {
    const input = await parseBody(request, UpdateCartItemInput)
    const view = transact((db) => {
      const cart = cartFor(request, db)
      const item = cart.items.find((i) => i.id === params.itemId)
      if (!item) throw apiError(404, 'NOT_FOUND', 'Item não está no carrinho')
      const { edition, limit } = limitFor(db, item.nftId, item.editionId)
      if (input.quantity > limit) throw availabilityError(limit, edition.maxPerOrder)
      item.quantity = input.quantity
      touchCart(cart)
      return toCartView(db, cart)
    })
    return HttpResponse.json(view)
  }),

  http.delete(api('/cart/items/:itemId'), ({ request, params }) => {
    const view = transact((db) => {
      const cart = cartFor(request, db)
      if (!cart.items.some((i) => i.id === params.itemId)) throw apiError(404, 'NOT_FOUND', 'Item não está no carrinho')
      cart.items = cart.items.filter((i) => i.id !== params.itemId)
      if (!cart.items.length) cart.couponCode = null
      touchCart(cart)
      return toCartView(db, cart)
    })
    return HttpResponse.json(view)
  }),

  /** O usuário confirma que viu os preços atuais (após "preço alterado"). */
  http.post(api('/cart/acknowledge'), ({ request }) => {
    const view = transact((db) => {
      const cart = cartFor(request, db)
      for (const item of cart.items) {
        const found = findEdition(db, item.nftId, item.editionId)
        if (found) item.seenUnitPrice = found.edition.price
      }
      touchCart(cart)
      return toCartView(db, cart)
    })
    return HttpResponse.json(view)
  }),

  http.put(api('/cart/coupon'), async ({ request }) => {
    const input = await parseBody(request, CouponInput)
    const check = checkCoupon(getDb(), input.code)
    if (!check.ok) {
      const expired = check.code === 'COUPON_EXPIRED'
      return apiError(422, check.code, expired ? 'Este código promocional expirou' : 'Código promocional inválido', {
        fieldErrors: { code: [expired ? 'Este código promocional expirou' : 'Código promocional inválido'] },
      })
    }
    const view = transact((db) => {
      const cart = cartFor(request, db)
      if (!cart.items.length) throw apiError(422, 'VALIDATION_ERROR', 'Adicione itens antes de aplicar um cupom')
      cart.couponCode = check.coupon.code
      touchCart(cart)
      return toCartView(db, cart)
    })
    return HttpResponse.json(view)
  }),

  http.delete(api('/cart/coupon'), ({ request }) => {
    const view = transact((db) => {
      const cart = cartFor(request, db)
      cart.couponCode = null
      touchCart(cart)
      return toCartView(db, cart)
    })
    return HttpResponse.json(view)
  }),

  /** Ao autenticar: incorpora o carrinho do visitante ao do usuário (respeitando limites). */
  http.post(api('/cart/merge'), async ({ request }) => {
    const user = requireUser(request)
    const input = await parseBody(request, MergeCartInput)
    const view = transact((db) => {
      const userCart = resolveCart(db, user.id, null, true)!
      const guest = db.carts.find((c) => c.id === input.guestCartId && c.userId === null)
      if (guest) {
        for (const g of guest.items) {
          const found = findEdition(db, g.nftId, g.editionId)
          if (!found) continue
          const limit = Math.min(found.edition.available, found.edition.maxPerOrder)
          const existing = userCart.items.find((i) => i.editionId === g.editionId)
          if (existing) existing.quantity = Math.min(limit, existing.quantity + g.quantity)
          else if (limit > 0) userCart.items.push({ ...g, id: nextId('item'), quantity: Math.min(limit, g.quantity) })
        }
        userCart.couponCode ??= guest.couponCode
        db.carts = db.carts.filter((c) => c !== guest)
        touchCart(userCart)
      }
      return toCartView(db, userCart)
    })
    return HttpResponse.json(view)
  }),
]

export const quoteHandlers = [
  http.post(api('/quotes'), async ({ request }) => {
    const input = await parseBody(request, QuoteInput)
    const quote = transact((db) => {
      const user = optionalUser(request)
      const cart = cartFor(request, db)
      const { record, issues } = createQuoteRecord(db, cart, user?.id ?? null, input.network)
      return toQuote(record, issues)
    })
    return HttpResponse.json(quote, { status: 201 })
  }),
]

/** Aplica, uma única vez, as mudanças de catálogo dos cenários "preço alterado" e "esgotado". */
function applyCheckoutScenario(db: DbState, quote: QuoteRecord) {
  const { checkout } = getScenario()
  const first = quote.lines[0]
  if (!first) return
  const found = findEdition(db, first.nftId, first.editionId)
  if (!found) return
  if (checkout.priceChangeOnOrder) {
    found.edition.price = addEth(found.edition.price, '0.05')
    bumpNft(found.nft)
    publishNftUpdated(found.nft)
    consumeCheckoutFlag('priceChangeOnOrder')
  }
  if (checkout.soldOutOnOrder) {
    found.edition.available = 0
    bumpNft(found.nft)
    publishNftUpdated(found.nft)
    consumeCheckoutFlag('soldOutOnOrder')
  }
}

export const orderHandlers = [
  http.post(api('/orders'), async ({ request }) => {
    const user = requireUser(request)
    const key = request.headers.get(IDEMPOTENCY_HEADER)
    if (!key) return apiError(400, 'VALIDATION_ERROR', `Header ${IDEMPOTENCY_HEADER} é obrigatório`)
    const input = await parseBody(request, CreateOrderInput)
    const bodyHash = await sha256Hex(stableStringify(input))

    // 1) Idempotência: mesma tentativa → mesmo pedido; mesma chave com outro conteúdo → conflito.
    const previous = getDb().idempotency.find((r) => r.key === key)
    if (previous) {
      if (previous.userId !== user.id || previous.bodyHash !== bodyHash) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo')
      }
      transact((db) => (db.idempotency.find((r) => r.key === key)!.responded = true))
      const existing = getDb().orders.find((o) => o.id === previous.orderId)!
      return HttpResponse.json(toOrder(existing), { status: 200 })
    }

    // 2) Revalidação da cotação contra o estado atual (preço, disponibilidade, cupom, taxas).
    // Erros lançados aqui (Response) são devolvidos pelo MSW como resposta mockada.
    const created: OrderRecord = transact((db) => {
        const quote = db.quotes.find((q) => q.id === input.quoteId && q.userId === user.id)
        const cart: CartRecord | null = resolveCart(db, user.id, null, false)
        if (!cart || !cart.items.length) throw apiError(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio')
        const wallet = db.wallets.find((w) => w.id === input.walletId && w.userId === user.id)
        if (!wallet) throw apiError(422, 'VALIDATION_ERROR', 'Selecione uma carteira cadastrada', { fieldErrors: { walletId: ['Selecione uma carteira cadastrada'] } })

        if (quote) applyCheckoutScenario(db, quote)
        const fresh = computeQuote(db, cart, input.network)
        const stale = () => {
          const { record, issues } = createQuoteRecord(db, cart, user.id, input.network)
          return { quote: toQuote(record, issues) }
        }
        if (fresh.issues.some((i) => i.type === 'SOLD_OUT' || i.type === 'QUANTITY_EXCEEDS')) {
          throw apiError(409, 'AVAILABILITY_CONFLICT', 'A disponibilidade de um ou mais itens mudou. Revise o carrinho.', { details: stale() })
        }
        if (!quote || quote.expiresAt <= nowIso() || quote.network !== input.network || fresh.issues.length || !sameQuote(quote, fresh)) {
          throw apiError(409, 'QUOTE_STALE', 'Os valores do pedido mudaram. Revise e confirme novamente.', { details: stale() })
        }

        const reservations = quote.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity }))
        adjustAvailability(db, reservations, -1)
        const now = nowIso()
        const id = nextId('ord')
        const order: OrderRecord = {
          id,
          number: `KUR-${id.slice(4)}`,
          userId: user.id,
          status: 'pending',
          lines: quote.lines,
          subtotal: quote.subtotal,
          discount: quote.discount,
          networkFee: quote.networkFee,
          total: quote.total,
          coupon: quote.coupon,
          network: input.network,
          wallet: { id: wallet.id, displayName: wallet.displayName, address: wallet.address, walletType: wallet.walletType },
          collector: { displayName: input.collector.displayName, username: input.collector.username, email: input.collector.email },
          txHash: null,
          explorerUrl: null,
          failureReason: null,
          createdAt: now,
          updatedAt: now,
          confirmedAt: null,
          version: 1,
          outcome: getScenario().checkout.paymentOutcome,
          settleAt: newOrderSettleAt(),
          reservations,
        }
        db.orders.push(order)
        db.idempotency.push({ key, userId: user.id, bodyHash, orderId: id, responded: false })
        return order
      })
    scheduleSettlement(created)

    // 3) Cenário "timeout após criação": o pedido já existe, mas a 1ª resposta atrasa além do timeout do cliente.
    const wait = getScenario().checkout.orderResponseDelayMs
    if (wait > 0) await delay(wait)
    transact((db) => (db.idempotency.find((r) => r.key === key)!.responded = true))
    return HttpResponse.json(toOrder(getDb().orders.find((o) => o.id === created.id)!), { status: 201 })
  }),

  http.get(api('/orders'), ({ request }) => {
    const user = requireUser(request)
    const status = new URL(request.url).searchParams.get('status')
    const items = getDb()
      .orders.filter((o) => o.userId === user.id && (!status || o.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toOrder)
    return HttpResponse.json({ items })
  }),

  http.get(api('/orders/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const order = getDb().orders.find((o) => o.id === params.id)
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado')
    if (order.userId !== user.id) return apiError(403, 'FORBIDDEN', 'Você não tem permissão para ver este pedido')
    scheduleSettlement(order)
    return HttpResponse.json(toOrder(order))
  }),
]
