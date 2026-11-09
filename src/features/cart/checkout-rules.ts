import type { Cart, Quote } from '@/api/contracts'

/** Pendências da cotação que impedem finalizar (o usuário precisa revisar o carrinho). */
export function blockingReason(cart: Cart, quote: Quote | undefined) {
  if (cart.items.some((i) => i.status === 'sold_out' || i.status === 'quantity_exceeds')) return 'Ajuste os itens indisponíveis para continuar.'
  if (cart.items.some((i) => i.status === 'price_changed')) return 'Aceite os novos preços para continuar.'
  if (quote?.issues.some((i) => i.type === 'COUPON_EXPIRED' || i.type === 'COUPON_INVALID')) return 'Remova o cupom inválido para continuar.'
  return null
}

/** Cotações equivalentes: mesmos itens, quantidades, preços, desconto, taxa e total (ids podem diferir). */
export function sameQuoteValues(a: Quote, b: Quote) {
  const key = (q: Quote) => JSON.stringify([q.total, q.discount, q.networkFee, q.lines.map((l) => [l.editionId, l.quantity, l.unitPrice])])
  return key(a) === key(b)
}
