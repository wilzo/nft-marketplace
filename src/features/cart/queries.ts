import { keepPreviousData, queryOptions, useIsMutating, useQuery } from '@tanstack/react-query'
import type { Cart, Network } from '@/api/contracts'
import { cartApi, quotesApi } from '@/api/endpoints'
import { guestCartId } from '@/lib/client-storage'
import { qk, type ViewerScope } from '@/lib/query-keys'

export const cartQuery = (scope: ViewerScope) =>
  queryOptions({
    queryKey: qk.private.cart(scope),
    queryFn: async ({ signal }) => {
      const cart = await cartApi.get({ signal })
      // Visitante: guarda o id do carrinho para sobreviver a refresh e ser incorporado no login.
      if (cart.owner === 'guest') guestCartId.set(cart.id)
      return cart
    },
  })

export const useCart = (scope: ViewerScope) => useQuery(cartQuery(scope))

/**
 * Assinatura do carrinho: muda quando o carrinho ou o catálogo relevante muda
 * (versão, preços e disponibilidade por item). Faz a cotação ser refeita após `nft.updated`.
 */
export function cartSignature(cart: Cart) {
  return [cart.version, cart.couponCode ?? '', ...cart.items.map((i) => `${i.editionId}:${i.quantity}:${i.unitPrice}:${i.available}`)].join('|')
}

/**
 * Cotação do carrinho (subtotal, desconto, taxa de rede, total e pendências) — referência da API.
 * Os valores exibidos nunca são recalculados no cliente.
 */
export const quoteQuery = (scope: ViewerScope, cart: Cart | undefined, network: Network = 'ethereum', paused = false) =>
  queryOptions({
    queryKey: [...qk.private.scope(scope), 'quote', network, cart ? cartSignature(cart) : 'none'] as const,
    queryFn: () => quotesApi.create({ network }),
    // Pausada enquanto há mutation do carrinho em voo (o cache pode estar otimista, à frente do servidor).
    enabled: !!cart && cart.items.length > 0 && !paused,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

export function useQuote(scope: ViewerScope, cart: Cart | undefined, network?: Network) {
  const mutating = useIsMutating({ mutationKey: ['cart'] }) > 0
  return useQuery(quoteQuery(scope, cart, network, mutating))
}
