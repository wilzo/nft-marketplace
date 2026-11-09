import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { env } from '@/config/env'
import { setNetworkReady } from '@/lib/boot'
import { createQueryClient } from '@/lib/query-client'
import { consumeBootParams } from './mocks/boot-params'
import { routeTree } from './routeTree.gen'
import './index.css'

// Antes de criar o Router: remove ?cenario= / ?painel= da URL (aplicados quando o MSW sobe).
if (env.mocksEnabled) consumeBootParams()

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
  interface StaticDataRouteOption {
    /** Rota privada: exige sessão; ao expirar, o usuário é levado ao login com retorno a esta URL. */
    private?: boolean
  }
}

/**
 * Inicialização progressiva: a interface renderiza já; a camada de mocks (ativada por VITE_ENABLE_MOCKS,
 * inclusive no build de demonstração) sobe em paralelo e toda requisição a aguarda (lib/boot.ts).
 */
if (env.mocksEnabled) {
  const mocks = import('./mocks/browser').then((m) => m.startMocks())
  setNetworkReady(mocks)
  void mocks.then(() => (document.documentElement.dataset.app = 'ready'))
} else {
  document.documentElement.dataset.app = 'ready'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
