import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemInput } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { guestCartId } from '@/lib/client-storage'
import { qk } from '@/lib/query-keys'
import { useViewerScope } from '../session/use-viewer'

/** Adiciona ao carrinho; a resposta (carrinho completo) substitui o cache — sem refetch extra. */
export function useAddToCart() {
  const client = useQueryClient()
  const scope = useViewerScope()
  return useMutation({
    mutationFn: (input: AddCartItemInput) => cartApi.addItem(input),
    onSuccess: (cart) => {
      if (cart.owner === 'guest') guestCartId.set(cart.id)
      client.setQueryData(qk.private.cart(scope), cart)
    },
  })
}
