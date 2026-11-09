import { lazy, Suspense } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/config/env'
import { PANEL_STORAGE_KEY } from '@/mocks/boot-params'
import { useRealtimeSync } from '@/features/realtime/use-realtime-sync'
import { useSessionSync } from '@/features/session/use-session-sync'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

export interface RouterContext {
  queryClient: QueryClient
}

/**
 * Painel de cenários do mock: não faz parte do layout do Figma, então fica oculto por padrão.
 * Ativado por `?painel=1` (preferência salva em localStorage), carregado sob demanda e só com mocks ativos.
 */
function panelEnabled() {
  try {
    return localStorage.getItem(PANEL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
/** Header desktop (menu, busca, Floating UI) carregado só no desktop — no mobile ele não é exibido. */
const SiteHeader = lazy(() => import('@/components/layout/site-header').then((m) => ({ default: m.SiteHeader })))

const ScenarioPanel = env.mocksEnabled ? lazy(() => import('@/features/dev/scenario-panel')) : null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  useSessionSync()
  useRealtimeSync()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Login/cadastro no mobile são telas cheias (sem navegação e rodapé, como no Figma).
  const isAuth = pathname === '/entrar' || pathname === '/cadastro'
  // O detalhe no mobile tem barra de compra própria no lugar da navegação inferior.
  const hideTabBar = isAuth || pathname.startsWith('/nft/') || pathname === '/carrinho' || pathname === '/pagamento'

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 pt-6 text-foreground sm:px-6">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-brand px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      {isDesktop && (
        // Espaço reservado com a altura do header: sem deslocamento de layout ao carregar
        <Suspense fallback={<div aria-hidden className="mx-auto h-[45px] w-full max-w-(--container-content) border-b border-brand/30" />}>
          <SiteHeader />
        </Suspense>
      )}
      {/* Altura mínima de uma tela: o rodapé não aparece durante o carregamento para depois ser empurrado (CLS) */}
      <div className="min-h-dvh flex-1">
        <Outlet />
      </div>
      {/* Login, cadastro, carrinho e pagamento são telas cheias no mobile (Figma): sem rodapé. */}
      <div className={cn((isAuth || pathname === '/carrinho' || pathname === '/pagamento') && 'max-lg:hidden')}>
        <SiteFooter />
      </div>
      {!hideTabBar && !isDesktop && <MobileTabBar />}
      {/* No mobile, abaixo da barra superior (voltar/favoritar) para não encobrir controles. */}
      <Toaster position="top-center" richColors closeButton mobileOffset={{ top: 76 }} />
      {ScenarioPanel && panelEnabled() && (
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
