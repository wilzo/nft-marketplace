import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemInput, Cart } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { guestCartId } from '@/lib/client-storage'
import { mulEth } from '@/lib/eth'
import { qk } from '@/lib/query-keys'
import { useViewerScope } from '../session/use-viewer'

/**
 * Mutations do carrinho. Todas compartilham o mesmo `scope` do TanStack Query, então rodam em série:
 * cliques rápidos no +/− não geram respostas fora de ordem sobrescrevendo um estado mais novo.
 * A resposta (carrinho completo) substitui o cache — sem refetch extra.
 */
export const CART_MUTATION_KEY = ['cart'] as const

function useCartMutationBase() {
  const client = useQueryClient()
  const scope = useViewerScope()
  const key = qk.private.cart(scope)
  const save = (cart: Cart) => {
    if (cart.owner === 'guest') guestCartId.set(cart.id)
    client.setQueryData(key, cart)
  }
  return { client, key, save, mutationScope: { id: `cart:${scope}` } }
}

export function useAddToCart() {
  const { save, mutationScope } = useCartMutationBase()
  return useMutation({
    scope: mutationScope,
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: AddCartItemInput) => cartApi.addItem(input),
    onSuccess: save,
  })
}

/** Alteração de quantidade com atualização otimista e rollback. */
export function useUpdateCartItem() {
  const { client, key, save, mutationScope } = useCartMutationBase()
  return useMutation({
    scope: mutationScope,
    mutationKey: CART_MUTATION_KEY,
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number; name: string }) => cartApi.updateItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<Cart>(key)
      client.setQueryData<Cart>(key, (cart) =>
        cart && {
          ...cart,
          items: cart.items.map((i) => (i.id === itemId ? { ...i, quantity, lineTotal: mulEth(i.unitPrice, quantity) } : i)),
          itemCount: cart.items.reduce((n, i) => n + (i.id === itemId ? quantity : i.quantity), 0),
        },
      )
      return { previous }
    },
    onError: (error, { name }, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
      else void client.invalidateQueries({ queryKey: key })
      toast.error(`Não foi possível alterar a quantidade de ${name}. ${error.message}`)
    },
    onSuccess: save,
  })
}

/** Remoção com atualização otimista e rollback. */
export function useRemoveCartItem() {
  const { client, key, save, mutationScope } = useCartMutationBase()
  return useMutation({
    scope: mutationScope,
    mutationKey: CART_MUTATION_KEY,
    mutationFn: ({ itemId }: { itemId: string; name: string }) => cartApi.removeItem(itemId),
    onMutate: async ({ itemId }) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<Cart>(key)
      client.setQueryData<Cart>(key, (cart) => {
        if (!cart) return cart
        const items = cart.items.filter((i) => i.id !== itemId)
        return { ...cart, items, itemCount: items.reduce((n, i) => n + i.quantity, 0) }
      })
      return { previous }
    },
    onError: (error, { name }, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
      else void client.invalidateQueries({ queryKey: key })
      toast.error(`Não foi possível remover ${name}. ${error.message}`)
    },
    onSuccess: (cart, { name }) => {
      save(cart)
      toast.success(`${name} removido do carrinho.`, { id: 'cart-remove' })
    },
  })
}

export function useApplyCoupon() {
  const { save, mutationScope } = useCartMutationBase()
  return useMutation({ scope: mutationScope, mutationKey: CART_MUTATION_KEY, mutationFn: (code: string) => cartApi.applyCoupon(code), onSuccess: save })
}

export function useRemoveCoupon() {
  const { save, mutationScope } = useCartMutationBase()
  return useMutation({ scope: mutationScope, mutationKey: CART_MUTATION_KEY, mutationFn: () => cartApi.removeCoupon(), onSuccess: save })
}

/** O usuário aceita os preços atuais após uma alteração (exige nova confirmação antes de finalizar). */
export function useAcknowledgePrices() {
  const { save, mutationScope } = useCartMutationBase()
  return useMutation({ scope: mutationScope, mutationKey: CART_MUTATION_KEY, mutationFn: () => cartApi.acknowledgePrices(), onSuccess: save })
}
