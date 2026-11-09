import { Link } from '@tanstack/react-router'
import type { OutOfScopeSection } from '@/lib/out-of-scope'

/** Link de uma seção do Figma fora desta entrega: mantém o visual e leva à página informativa. */
export function OutOfScopeLink({
  section,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  section: OutOfScopeSection
  className?: string
  children: React.ReactNode
  'aria-label'?: string
}) {
  return (
    <Link to="/secao-indisponivel" search={{ secao: section }} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}
