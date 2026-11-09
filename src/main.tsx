import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { env } from '@/config/env'
import { createQueryClient } from '@/lib/query-client'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = createQueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // O loader delega o cache ao TanStack Query
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/** A camada de mocks é ativada por configuração (VITE_ENABLE_MOCKS) e também roda no build de demonstração. */
async function enableMocking() {
  if (!env.mocksEnabled) return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
