import type { CatalogQuery } from '@/api/contracts'

/**
 * Fábrica de chaves do TanStack Query.
 *  - Dados públicos (catálogo) ficam sob `nfts`/`highlights` e são isolados pelos parâmetros da consulta.
 *  - Dados privados ficam sob `['private', scope, ...]`, onde `scope` é o id do usuário (ou 'guest'):
 *    logout/troca de usuário removem `['private']` inteiro, sem vazar cache entre sessões.
 */
export type ViewerScope = string // userId | 'guest'

export const qk = {
  highlights: ['highlights'] as const,
  nfts: {
    all: ['nfts'] as const,
    lists: ['nfts', 'list'] as const,
    list: (params: CatalogQuery) => ['nfts', 'list', params] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  private: {
    all: ['private'] as const,
    scope: (scope: ViewerScope) => ['private', scope] as const,
    session: ['private', 'session'] as const,
    cart: (scope: ViewerScope) => ['private', scope, 'cart'] as const,
    favorites: (scope: ViewerScope) => ['private', scope, 'favorites'] as const,
    profile: (scope: ViewerScope) => ['private', scope, 'profile'] as const,
    wallets: (scope: ViewerScope) => ['private', scope, 'wallets'] as const,
    orders: (scope: ViewerScope) => ['private', scope, 'orders'] as const,
    order: (scope: ViewerScope, id: string) => ['private', scope, 'orders', id] as const,
  },
}
