import { Link, useRouterState } from '@tanstack/react-router'
import ActivityIcon from '@/assets/icons/curved-activity.svg?react'
import DangerIcon from '@/assets/icons/curved-danger-triangle.svg?react'
import DownloadIcon from '@/assets/icons/curved-download.svg?react'
import ImageIcon from '@/assets/icons/curved-image-2.svg?react'
import LogoutIcon from '@/assets/icons/curved-logout.svg?react'
import LocationIcon from '@/assets/icons/light-outline-location.svg?react'
import UserIcon from '@/assets/icons/user.svg?react'
import { useLogout } from '@/features/session/mutations'
import { notAvailable } from '@/lib/out-of-scope'
import { cn } from '@/lib/utils'
import { Heart } from 'lucide-react'

const item =
  'relative flex h-[45px] shrink-0 items-center gap-3 px-4 text-[15px] text-brand-accent whitespace-nowrap transition-colors hover:bg-surface-raised lg:px-4'
const active = "font-bold before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-brand before:content-[''] max-lg:before:inset-x-0 max-lg:before:top-auto max-lg:before:h-1 max-lg:before:w-auto"

/**
 * Layout das páginas da conta (frames "Perfil do Colecionador" e "Carteiras"): menu "Meu perfil" à esquerda.
 * Mobile: o menu vira uma faixa rolável no topo. Itens fora do escopo avisam que não estão disponíveis.
 */
export function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const current = (path: string) => (pathname === path ? 'page' : undefined)

  return (
    <div className="mx-auto flex w-full max-w-(--container-content) flex-col gap-7 lg:flex-row lg:pt-8">
      <nav aria-label="Meu perfil" className="shrink-0 bg-surface-card lg:w-[310px] lg:self-start">
        <h2 className="hidden px-2.5 pt-4 pb-1 text-lg font-bold lg:block">Meu perfil</h2>
        <ul className="flex overflow-x-auto [scrollbar-width:none] lg:flex-col">
          <li>
            <Link to="/perfil" aria-current={current('/perfil')} className={cn(item, pathname === '/perfil' && active)}>
              <UserIcon aria-hidden className="size-5" /> Dados do perfil
            </Link>
          </li>
          <li>
            <Link to="/carteiras" aria-current={current('/carteiras')} className={cn(item, pathname === '/carteiras' && active)}>
              <LocationIcon aria-hidden className="size-5" /> Carteiras
            </Link>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notAvailable('A página Atividade')}>
              <ActivityIcon aria-hidden className="size-5" /> Atividade
            </button>
          </li>
          <li>
            <Link to="/favoritos" className={item}>
              <Heart aria-hidden className="size-5" /> Lista de interesse
            </Link>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notAvailable('A página Ofertas')}>
              <ImageIcon aria-hidden className="size-5" /> Ofertas
            </button>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notAvailable('A página Arquivos baixados')}>
              <DownloadIcon aria-hidden className="size-5" /> Arquivos baixados
            </button>
          </li>
          <li>
            <button type="button" className={item} onClick={() => notAvailable('O Suporte')}>
              <DangerIcon aria-hidden className="size-5" /> Suporte
            </button>
          </li>
          <li className="lg:border-t lg:border-line">
            <button type="button" className={cn(item, 'font-bold')} onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogoutIcon aria-hidden className="size-5" /> Sair
            </button>
          </li>
        </ul>
      </nav>
      <main id="conteudo" className="min-w-0 flex-1 pb-10">
        {children}
      </main>
    </div>
  )
}
