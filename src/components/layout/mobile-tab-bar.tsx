import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, ScanLine } from 'lucide-react'
import HomeIcon from '@/assets/icons/bold-home.svg?react'
import ShopIcon from '@/assets/icons/shop.svg?react'
import UserIcon from '@/assets/icons/user.svg?react'
import { useCart } from '@/features/cart/queries'
import { useViewerScope } from '@/features/session/use-viewer'
import { cn } from '@/lib/utils'

const item = 'grid size-11 place-items-center rounded-full text-sand transition-colors hover:text-brand-accent aria-[current=page]:text-brand-accent'

/** Barra de navegação inferior do mobile ("Tab Bar" do Figma). Visível abaixo de lg. */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const count = useCart(useViewerScope()).data?.itemCount ?? 0
  const current = (path: string) => (pathname === path ? 'page' : undefined)

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="relative mx-auto h-[78px] max-w-[480px] rounded-t-[28px] bg-surface-card shadow-raised">
        <ul className="grid h-full grid-cols-5 items-center px-4">
          <li className="grid place-items-center">
            <Link to="/" aria-label="Início" aria-current={current('/')} className={item}>
              <HomeIcon aria-hidden className="size-5" />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/favoritos" aria-label="Favoritos" aria-current={current('/favoritos')} className={item}>
              <Heart aria-hidden className="size-5 fill-current" />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link
              to="/"
              hash="catalogo"
              aria-label="Explorar catálogo"
              className="-mt-12 grid size-[65px] place-items-center rounded-full bg-linear-to-b from-brand-accent to-brand text-cream shadow-raised"
            >
              <ScanLine aria-hidden className="size-7" />
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} aria-current={current('/carrinho')} className={cn(item, 'relative')}>
              <ShopIcon aria-hidden className="size-5" />
              {count > 0 && (
                <span aria-hidden className="absolute top-1 right-0.5 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-medium text-ink">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </li>
          <li className="grid place-items-center">
            <Link to="/perfil" aria-label="Minha conta" aria-current={current('/perfil')} className={item}>
              <UserIcon aria-hidden className="size-5" />
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}
