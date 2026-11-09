import { QueryClient } from '@tanstack/react-query'

/** Política inicial de cache; será refinada e documentada no ARCHITECTURE.md. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
