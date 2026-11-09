import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import CartIcon from '@/assets/icons/cart.svg?react'
import LogoutIcon from '@/assets/icons/curved-logout.svg?react'
import SearchIcon from '@/assets/icons/header-search.svg?react'
import LogoKurio from '@/assets/icons/logo-kurio.svg?react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/queries'
import { useCurrentUser, useViewerScope } from '@/features/session/use-viewer'
import { UserMenu } from './user-menu'
import { OutOfScopeLink } from '@/components/out-of-scope-link'
import { cn } from '@/lib/utils'

const navItem =
  'relative flex h-[45px] items-start text-base text-cream transition-colors hover:text-brand-accent focus-visible:outline-offset-4'
const activeItem =
  "font-bold text-brand-accent after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-brand after:content-['']"

/** Header desktop (≥ lg), conforme o componente "Header With Divider" do Figma. */
export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const href = useRouterState({ select: (s) => s.location.href })
  const user = useCurrentUser()
  const [searchOpen, setSearchOpen] = useState(false)
  const scope = useViewerScope()
  const cart = useCart(scope)
  const count = cart.data?.itemCount ?? 0

  const isHome = pathname === '/'
  const isMarket = pathname.startsWith('/nft/') || pathname.startsWith('/carrinho') || pathname.startsWith('/pagamento')

  return (
    <header className="hidden lg:block">
      <div className="mx-auto flex h-[45px] max-w-(--container-content) items-start justify-between border-b border-brand/30">
        <Link to="/" aria-label="Kurio — página inicial" className="flex h-[34px] w-40 items-center">
          <LogoKurio aria-hidden className="h-[18px] w-auto text-cream" />
        </Link>

        <nav aria-label="Principal">
          <ul className="flex gap-10">
            <li>
              <Link to="/" className={cn(navItem, isHome && activeItem)} aria-current={isHome ? 'page' : undefined}>
                Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="catalogo" className={cn(navItem, isMarket && activeItem)} aria-current={isMarket ? 'page' : undefined}>
                Mercado
              </Link>
            </li>
            <li>
              <OutOfScopeLink section="criadores" className={navItem}>
                Criadores
              </OutOfScopeLink>
            </li>
            <li>
              <OutOfScopeLink section="aprenda" className={navItem}>
                Aprenda
              </OutOfScopeLink>
            </li>
          </ul>
        </nav>

        <div className="flex h-[35px] items-center gap-7">
          <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
          <Link to="/carrinho" className="relative text-cream" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <CartIcon aria-hidden className="h-[26px] w-6" />
            {count > 0 && (
              <span aria-hidden className="absolute -top-1 -right-2 grid size-4 place-items-center rounded-full border-2 border-ink bg-brand text-[10px] leading-none font-medium text-ink">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button asChild className="h-[35px] w-[100px] gap-1 rounded-md text-base font-medium">
              <Link to="/entrar" search={{ redirect: href === '/' ? undefined : href }}>
                <LogoutIcon aria-hidden className="size-5" />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogTrigger: ao fechar, o Radix devolve o foco a este botão */}
      <DialogTrigger asChild>
        <button type="button" aria-label="Buscar NFTs" className="text-cream hover:text-brand-accent">
          <SearchIcon aria-hidden className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="border-line bg-surface-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar NFTs</DialogTitle>
          <DialogDescription className="text-sand">Pesquise por nome, coleção ou criador.</DialogDescription>
        </DialogHeader>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onOpenChange(false)
            void navigate({ to: '/', hash: 'catalogo', search: (prev) => ({ ...prev, q: value.trim() || undefined, page: undefined }) })
          }}
        >
          <label htmlFor="header-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="header-search" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Emerald Ape" className="h-10" />
          <Button type="submit" size="cta" className="px-5">
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
