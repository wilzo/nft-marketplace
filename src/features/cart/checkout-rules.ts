import type { Cart, Quote } from '@/api/contracts'

/** Pendências da cotação que impedem finalizar (o usuário precisa revisar o carrinho). */
export function blockingReason(cart: Cart, quote: Quote | undefined) {
  if (cart.items.some((i) => i.status === 'sold_out' || i.status === 'quantity_exceeds')) return 'Ajuste os itens indisponíveis para continuar.'
  if (cart.items.some((i) => i.status === 'price_changed')) return 'Aceite os novos preços para continuar.'
  if (quote?.issues.some((i) => i.type === 'COUPON_EXPIRED' || i.type === 'COUPON_INVALID')) return 'Remova o cupom inválido para continuar.'
  return null
}
