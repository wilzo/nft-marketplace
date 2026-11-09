import { Link } from '@tanstack/react-router'
import ArrowLeft from '@/assets/icons/curved-arrow-left-2.svg?react'
import ArrowRight from '@/assets/icons/curved-arrow-right.svg?react'
import { cn } from '@/lib/utils'

const box = 'grid size-[35px] place-items-center rounded-sm border border-line text-lg text-cream transition-colors hover:border-brand'

/** Janela de até 4 páginas ao redor da atual (Figma: 1 2 3 4 >). */
function pageWindow(page: number, total: number) {
  const size = Math.min(4, total)
  const start = Math.max(1, Math.min(page - 1, total - size + 1))
  return Array.from({ length: size }, (_, i) => start + i)
}

/** Paginação por links: cada página é um estado de URL (funciona com voltar/avançar e refresh). */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const to = (p: number) => ({ to: '/' as const, hash: 'catalogo', search: (prev: Record<string, unknown>) => ({ ...prev, page: p > 1 ? p : undefined }) })
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex gap-2">
        {page > 1 && (
          <li>
            <Link {...to(page - 1)} aria-label="Página anterior" className={box}>
              <ArrowLeft aria-hidden className="size-[18px]" />
            </Link>
          </li>
        )}
        {pageWindow(page, totalPages).map((p) => (
          <li key={p}>
            <Link
              {...to(p)}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={cn(box, p === page && 'border-brand bg-brand font-bold text-ink')}
            >
              {p}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link {...to(page + 1)} aria-label="Próxima página" className={cn(box, 'text-cream')}>
              <ArrowRight aria-hidden className="size-[18px] text-cream" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
