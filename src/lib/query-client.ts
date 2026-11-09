import { QueryClient } from '@tanstack/react-query'
import type { ApiError } from './api-error'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
  }
}

/**
 * Política de cache e retries (documentada em ARCHITECTURE.md):
 *  - staleTime 30 s: navegação entre telas reaproveita dados recentes sem piscar;
 *  - retry só para falhas transitórias (rede, timeout, 5xx marcados como `retryable`), até 2 vezes;
 *  - 4xx (validação, sessão, inexistente, conflito) nunca são repetidos;
 *  - mutations não repetem automaticamente (evita duplicar operações; pedidos usam idempotência).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => error.retryable && failureCount < 2,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
