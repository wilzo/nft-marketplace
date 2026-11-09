import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Order } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { qk, type ViewerScope } from '@/lib/query-keys'
import { realtime } from '@/lib/realtime'
import { useViewerScope } from '../session/use-viewer'

/** Fallback de sincronização enquanto o pedido está pendente (caso o Socket.IO esteja indisponível). */
const PENDING_POLL_MS = 5_000

export const orderQuery = (scope: ViewerScope, id: string) =>
  queryOptions({
    queryKey: qk.private.order(scope, id),
    queryFn: async ({ signal }) => {
      const order = await ordersApi.get(id, { signal })
      realtime.noteVersion('order', order.id, order.version)
      return order
    },
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
  })

export const pendingOrdersQuery = (scope: ViewerScope) =>
  queryOptions({
    queryKey: [...qk.private.orders(scope), 'pending'] as const,
    queryFn: ({ signal }) => ordersApi.list('pending', { signal }),
    enabled: scope !== 'guest',
  })

export const useOrder = (id: string) => useQuery(orderQuery(useViewerScope(), id))
export const usePendingOrders = () => useQuery(pendingOrdersQuery(useViewerScope()))

/**
 * Aplica `order.updated` (Socket.IO) ao cache do pedido. O RealtimeClient já descarta duplicatas,
 * eventos antigos e eventos de outro usuário; aqui só se atualiza o estado — estados terminais não regridem.
 * Pedido confirmado: o servidor removeu os itens comprados do carrinho → invalida o carrinho.
 */
export function useOrderRealtime() {
  const client = useQueryClient()
  const scope = useViewerScope()
  useEffect(
    () =>
      realtime.on('order.updated', (e) => {
        client.setQueryData<Order>(qk.private.order(scope, e.resource.id), (order) => {
          if (!order || order.version >= e.version || order.status !== 'pending') return order
          return { ...order, status: e.data.status, txHash: e.data.txHash, failureReason: e.data.failureReason, version: e.version }
        })
        // Busca o recibo completo (data de confirmação, link do explorador) e reconcilia listas.
        void client.invalidateQueries({ queryKey: qk.private.order(scope, e.resource.id) })
        void client.invalidateQueries({ queryKey: qk.private.orders(scope) })
        if (e.data.status === 'confirmed') void client.invalidateQueries({ queryKey: qk.private.cart(scope) })
      }),
    [client, scope],
  )
}
