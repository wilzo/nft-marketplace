import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
import LogoKurio from '@/assets/icons/logo-kurio.svg?react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CatalogSection } from '@/features/catalog/components/catalog-section'
import { FeaturedBanner, Hero } from '@/features/catalog/components/home-sections'
import { useCatalog, useHighlights } from '@/features/catalog/queries'
import { toCatalogQuery } from '@/features/catalog/search'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { SESSION_EXPIRED_MESSAGE } from '@/features/session/session'
import { LoginForm, RegisterForm, SocialLogin } from './auth-forms'

type Mode = 'login' | 'register'

const COPY = {
  login: {
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    mobileTitle: 'Entrar',
  },
  register: {
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    mobileTitle: 'Criar perfil de colecionador',
  },
}

/**
 * Login/Cadastro. Desktop: modal 500px sobre a home (frames "Desktop / Login" e "Desktop / Cadastro").
 * Mobile: tela cheia (frames "Mobile / Login" e "Mobile / Cadastro").
 */
export function AuthScreen({ mode, redirect, expired = false }: { mode: Mode; redirect?: string; expired?: boolean }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const navigate = useNavigate()
  const router = useRouter()
  const done = () => void navigate({ href: redirect ?? '/', replace: true })
  const close = () => (router.history.canGoBack() ? router.history.back() : void navigate({ to: '/' }))
  const otherSearch = { redirect }

  const notice = expired && (
    <p role="status" className="mb-4 rounded-md border border-amber/50 bg-surface-raised px-3 py-2 text-sm text-amber">
      {SESSION_EXPIRED_MESSAGE}
    </p>
  )
  const form = mode === 'login' ? <LoginForm variant={isDesktop ? 'dialog' : 'page'} onSuccess={done} /> : <RegisterForm variant={isDesktop ? 'dialog' : 'page'} onSuccess={done} />

  if (isDesktop) {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-(--container-content) pt-8">
        {/* Figma: a home inteira aparece atrás do modal, sem escurecimento */}
        <HomeBackdrop />
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent
            showCloseButton={false}
            overlayClassName="bg-transparent"
            onOpenAutoFocus={(e) => {
              // Foco inicial no primeiro campo (não no botão fechar)
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).querySelector<HTMLInputElement>('form input')?.focus()
            }}
            className="w-[500px] max-w-[500px] gap-0 overflow-hidden rounded-lg border-0 bg-surface-card p-0 sm:max-w-[500px]"
          >
            <DialogClose className="absolute top-[13px] right-[13px] grid size-7 place-items-center rounded-sm text-brand hover:text-brand-accent" aria-label="Fechar">
              <X aria-hidden className="size-[18px]" />
            </DialogClose>
            <header className="flex flex-col items-center gap-10 px-12 pt-12">
              <nav aria-label="Entrar ou criar conta" className="flex items-center gap-2 text-xl leading-4 font-medium">
                <Link
                  to="/entrar"
                  search={otherSearch}
                  replace
                  aria-current={mode === 'login' ? 'page' : undefined}
                  className={cn(mode === 'login' ? 'text-brand-accent' : 'text-cream hover:text-brand-accent')}
                >
                  Entrar
                </Link>
                <span aria-hidden className="h-5 w-px bg-coral" />
                <Link
                  to="/cadastro"
                  search={otherSearch}
                  replace
                  aria-current={mode === 'register' ? 'page' : undefined}
                  className={cn(mode === 'register' ? 'text-brand-accent' : 'text-cream hover:text-brand-accent')}
                >
                  Criar conta
                </Link>
              </nav>
              <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</DialogTitle>
              <DialogDescription className="text-center text-[13px] leading-4 text-cream">{COPY[mode].description}</DialogDescription>
            </header>
            <div className="px-20 pt-6">
              {notice}
              {form}
            </div>
            <div className="px-20 pt-6 pb-10">
              <SocialLogin variant="dialog" />
            </div>
            <div aria-hidden className="h-2.5 bg-brand" />
          </DialogContent>
        </Dialog>
      </main>
    )
  }

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-[420px] flex-col px-1 pt-20 pb-10">
      <Link to="/" aria-label="Kurio — página inicial" className="self-center">
        <LogoKurio aria-hidden className="h-[30px] w-auto text-cream" />
      </Link>
      <h1 className="mt-20 mb-10 text-center text-lg font-bold">{COPY[mode].mobileTitle}</h1>
      {notice}
      {form}
      <div className="mt-10">
        <SocialLogin variant="page" />
      </div>
      <p className="mt-12 text-center text-base text-sand">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/cadastro" search={otherSearch} replace className="text-sand underline-offset-4 hover:underline">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/entrar" search={otherSearch} replace className="text-sand underline-offset-4 hover:underline">
              Entre
            </Link>
          </>
        )}
      </p>
    </main>
  )
}

/** Home (hero + catálogo) atrás do modal de login/cadastro, como nos frames do Figma. Inerte. */
function HomeBackdrop() {
  const catalog = useCatalog(toCatalogQuery({}))
  const highlights = useHighlights()
  return (
    <div aria-hidden inert className="flex flex-col gap-24">
      <Hero highlights={highlights.data} />
      <CatalogSection
        search={{}}
        data={catalog.data}
        isPending={catalog.isPending}
        isError={false}
        error={null}
        isRefreshing={false}
        onRetry={() => undefined}
        onChange={() => undefined}
        onClear={() => undefined}
        aside={<FeaturedBanner highlights={highlights.data} />}
      />
    </div>
  )
}
