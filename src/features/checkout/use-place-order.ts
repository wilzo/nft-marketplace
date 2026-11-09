import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Quote, type CreateOrderInput } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import type { ApiError } from '@/lib/api-error'
import { qk } from '@/lib/query-keys'
import { useCurrentUser, useViewerScope } from '../session/use-viewer'
import { orderAttempt } from './storage'

/** Nova cotação devolvida pelo servidor num 409 (QUOTE_STALE / AVAILABILITY_CONFLICT). */
export function staleQuoteFrom(error: ApiError): Quote | null {
  const parsed = Quote.safeParse((error.details as { quote?: unknown } | undefined)?.quote)
  return parsed.success ? parsed.data : null
}

/**
 * Criação idempotente do pedido.
 *  - A chave da tentativa é reaproveitada para o mesmo conteúdo (clique repetido, reenvio após timeout):
 *    o servidor devolve o MESMO pedido. Conteúdo diferente (ex.: nova cotação) gera nova chave.
 *  - `retry: false`: nenhuma repetição automática; o reenvio é decisão do usuário, com a mesma chave.
 */
export function usePlaceOrder() {
  const client = useQueryClient()
  const scope = useViewerScope()
  const user = useCurrentUser()
  return useMutation({
    mutationKey: ['place-order'],
    mutationFn: (body: CreateOrderInput) => ordersApi.create(body, orderAttempt.keyFor(user!.id, body)),
    onSuccess: (order) => {
      client.setQueryData(qk.private.order(scope, order.id), order)
      void client.invalidateQueries({ queryKey: qk.private.orders(scope) })
    },
  })
}
