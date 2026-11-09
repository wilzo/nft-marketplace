import { authHandlers, favoriteHandlers } from './handlers/auth'
import { catalogHandlers } from './handlers/catalog'
import { cartHandlers, orderHandlers, quoteHandlers } from './handlers/commerce'
import { newsletterHandlers, profileHandlers, walletHandlers } from './handlers/account'
import { controlHandlers } from './handlers/control'
import { networkConditions } from './handlers/network'
import { realtimeHandler } from './realtime'

/**
 * Ordem importa: `networkConditions` roda primeiro (latência/offline/falhas) e cai para o handler do recurso.
 * O mesmo conjunto é usado em desenvolvimento, no build de demonstração e nos testes.
 */
export const handlers = [
  networkConditions,
  ...controlHandlers,
  ...authHandlers,
  ...favoriteHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...orderHandlers,
  ...profileHandlers,
  ...walletHandlers,
  ...newsletterHandlers,
  realtimeHandler,
]
