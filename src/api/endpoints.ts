import {
  type AddCartItemInput,
  Cart,
  CatalogPage,
  type CatalogQuery,
  type ChangePasswordInput,
  type CreateOrderInput,
  Favorites,
  Highlights,
  IDEMPOTENCY_HEADER,
  type LoginInput,
  NftDetail,
  Order,
  OrderList,
  type OrderStatus,
  type ProfileInput,
  Quote,
  type QuoteInput,
  type RegisterInput,
  RelatedNfts,
  Session,
  User,
  WalletConnection,
  type WalletInput,
  Wallets,
  type WalletSlot,
} from './contracts'
import { call, callVoid } from './client'

/**
 * Funções REST tipadas (uma por operação). Toda chamada passa pelo Axios (`http`)
 * e tem a resposta validada pelo contrato. `signal` permite cancelar respostas obsoletas.
 */

type Opts = { signal?: AbortSignal }

export const nftsApi = {
  list: (params: CatalogQuery, { signal }: Opts = {}) => call(CatalogPage, { method: 'GET', url: '/nfts', params, signal }),
  detail: (id: string, { signal }: Opts = {}) => call(NftDetail, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal }),
  related: (id: string, { signal }: Opts = {}) => call(RelatedNfts, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}/related`, signal }),
  highlights: ({ signal }: Opts = {}) => call(Highlights, { method: 'GET', url: '/highlights', signal }),
}

export const authApi = {
  register: (data: RegisterInput) => call(Session, { method: 'POST', url: '/auth/register', data }),
  login: (data: LoginInput) => call(Session, { method: 'POST', url: '/auth/login', data }),
  session: ({ signal }: Opts = {}) => call(Session, { method: 'GET', url: '/auth/session', signal }),
  logout: () => callVoid({ method: 'POST', url: '/auth/logout' }),
}

export const favoritesApi = {
  list: ({ signal }: Opts = {}) => call(Favorites, { method: 'GET', url: '/favorites', signal }),
  add: (nftId: string) => call(Favorites, { method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) => call(Favorites, { method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }),
}

export const cartApi = {
  get: ({ signal }: Opts = {}) => call(Cart, { method: 'GET', url: '/cart', signal }),
  addItem: (data: AddCartItemInput) => call(Cart, { method: 'POST', url: '/cart/items', data }),
  updateItem: (itemId: string, quantity: number) => call(Cart, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
  removeItem: (itemId: string) => call(Cart, { method: 'DELETE', url: `/cart/items/${itemId}` }),
  acknowledgePrices: () => call(Cart, { method: 'POST', url: '/cart/acknowledge' }),
  applyCoupon: (code: string) => call(Cart, { method: 'PUT', url: '/cart/coupon', data: { code } }),
  removeCoupon: () => call(Cart, { method: 'DELETE', url: '/cart/coupon' }),
  merge: (guestCartId: string) => call(Cart, { method: 'POST', url: '/cart/merge', data: { guestCartId } }),
}

export const quotesApi = {
  create: (data: QuoteInput = {}) => call(Quote, { method: 'POST', url: '/quotes', data }),
}

export const ordersApi = {
  /** A mesma `idempotencyKey` deve ser reutilizada em reenvios da mesma tentativa. */
  create: (data: CreateOrderInput, idempotencyKey: string) =>
    call(Order, { method: 'POST', url: '/orders', data, headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } }),
  get: (id: string, { signal }: Opts = {}) => call(Order, { method: 'GET', url: `/orders/${encodeURIComponent(id)}`, signal }),
  list: (status?: OrderStatus, { signal }: Opts = {}) => call(OrderList, { method: 'GET', url: '/orders', params: { status }, signal }),
}

export const profileApi = {
  get: ({ signal }: Opts = {}) => call(User, { method: 'GET', url: '/profile', signal }),
  update: (data: ProfileInput) => call(User, { method: 'PATCH', url: '/profile', data }),
  setAvatar: (dataUrl: string) => call(User, { method: 'PUT', url: '/profile/avatar', data: { dataUrl } }),
  removeAvatar: () => call(User, { method: 'DELETE', url: '/profile/avatar' }),
  changePassword: (data: ChangePasswordInput) => callVoid({ method: 'POST', url: '/profile/password', data }),
}

export const walletsApi = {
  list: ({ signal }: Opts = {}) => call(Wallets, { method: 'GET', url: '/wallets', signal }),
  save: (slot: WalletSlot, data: WalletInput) => call(Wallets, { method: 'PUT', url: `/wallets/${slot}`, data }),
  connect: (walletId: string, network: string) => call(WalletConnection, { method: 'POST', url: '/wallet-connections', data: { walletId, network } }),
  disconnect: (connectionId: string) => callVoid({ method: 'DELETE', url: `/wallet-connections/${connectionId}` }),
}
