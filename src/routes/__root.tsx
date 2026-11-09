import { lazy, Suspense } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/config/env'
import { useRealtimeSync } from '@/features/realtime/use-realtime-sync'

export interface RouterContext {
  queryClient: QueryClient
}

// Painel de cenários do mock: carregado sob demanda e só quando os mocks estão ativos.
const ScenarioPanel = env.mocksEnabled ? lazy(() => import('@/features/dev/scenario-panel')) : null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  useRealtimeSync()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // O detalhe no mobile tem barra de compra própria no lugar da navegação inferior.
  const hideTabBar = pathname.startsWith('/nft/')

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 pt-6 text-foreground sm:px-6">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-brand px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
      {!hideTabBar && <MobileTabBar />}
      <Toaster position="top-center" richColors closeButton />
      {ScenarioPanel && (
        <Suspense fallback={null}>
          <ScenarioPanel />
        </Suspense>
      )}
    </div>
  )
}

function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="text-sand">O endereço acessado não existe.</p>
      <Link to="/" className="text-brand-accent underline underline-offset-4">
        Voltar ao início
      </Link>
    </main>
  )
}
