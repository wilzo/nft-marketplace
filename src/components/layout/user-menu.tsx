import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import type { User } from '@/api/contracts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/session/mutations'

export function UserAvatar({ user, className = 'size-8' }: { user: User; className?: string }) {
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className={`${className} rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${className} grid place-items-center rounded-full bg-brand text-sm font-bold text-ink`}>
      {user.displayName.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Menu do usuário autenticado no header (substitui o botão "Entrar"). */
export function UserMenu({ user }: { user: User }) {
  const logout = useLogout()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-[35px] items-center gap-2 rounded-md border border-line px-2 text-sm text-cream hover:border-brand"
        aria-label={`Conta de ${user.displayName}`}
      >
        <UserAvatar user={user} className="size-6" />
        <span className="max-w-28 truncate">{user.displayName}</span>
        <ChevronDown aria-hidden className="size-4 text-khaki" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-line bg-surface-card">
        <DropdownMenuLabel className="truncate text-xs text-sand">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">Meu perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/carteiras">Carteiras</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/favoritos">Favoritos</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
