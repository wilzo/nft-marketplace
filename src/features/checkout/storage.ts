import type { CreateOrderInput } from '@/api/contracts'

/**
 * Estado do checkout em sessionStorage (por aba e por usuário):
 *  - rascunho do formulário: sobrevive à expiração da sessão/refresh para retomada;
 *  - tentativa de pedido: a mesma `Idempotency-Key` é reutilizada em reenvios do MESMO conteúdo
 *    (timeout, clique repetido) — o servidor devolve o mesmo pedido em vez de criar outro.
 */

const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`
const attemptKey = (userId: string) => `kurio:checkout-attempt:${userId}`

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // armazenamento indisponível
  }
}

export const checkoutDraft = {
  get: <T>(userId: string) => read<T>(draftKey(userId)),
  set: (userId: string, value: unknown) => write(draftKey(userId), value),
  clear: (userId: string) => write(draftKey(userId), null),
}

export interface OrderAttempt {
  key: string
  body: CreateOrderInput
}

const sameBody = (a: CreateOrderInput, b: CreateOrderInput) => JSON.stringify(a) === JSON.stringify(b)

export const orderAttempt = {
  /** Chave da tentativa: reaproveitada se o conteúdo for o mesmo; nova caso contrário. */
  keyFor(userId: string, body: CreateOrderInput) {
    const current = read<OrderAttempt>(attemptKey(userId))
    if (current && sameBody(current.body, body)) return current.key
    const key = crypto.randomUUID()
    write(attemptKey(userId), { key, body } satisfies OrderAttempt)
    return key
  },
  clear: (userId: string) => write(attemptKey(userId), null),
}
