import { queryOptions, useQuery } from '@tanstack/react-query'
import { cartApi } from '@/api/endpoints'
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
