import type { Edition } from '@/api/contracts'

/** Limite de compra da edição: menor entre o disponível e o limite por pedido. */
export function editionLimit(e: Edition) {
  return Math.min(e.available, e.maxPerOrder)
}
