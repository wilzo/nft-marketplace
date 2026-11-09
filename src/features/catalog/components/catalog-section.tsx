import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CatalogPage } from '@/api/contracts'
import FilterIcon from '@/assets/icons/curved-filter.svg?react'
import SearchIcon from '@/assets/icons/header-search.svg?react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { ApiError } from '@/lib/api-error'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { CATALOG_PAGE_SIZE, hasActiveFilters, type CatalogSearch } from '../search'
import { CatalogFilters } from './catalog-filters'
import { CatalogPagination } from './catalog-pagination'
import { CatalogSortSelect, CatalogTabs } from './catalog-toolbar'
import { NftCard, NftCardSkeleton } from './nft-card'

interface Props {
  search: CatalogSearch
  data: CatalogPage | undefined
  isPending: boolean
  isError: boolean
  error: ApiError | null
  /** Exibindo dados da consulta anterior enquanto a nova carrega. */
  isRefreshing: boolean
  onRetry: () => void
  onChange: (patch: Partial<CatalogSearch>, opts?: { replace?: boolean }) => void
  onClear: () => void
  aside?: React.ReactNode
}

/** Busca do mobile (Figma "Search Bar"): grava na URL após uma pausa na digitação. */
function SearchInput({ value, onCommit }: { value: string | undefined; onCommit: (q: string | undefined) => void }) {
  const [text, setText] = useState(value ?? '')
  // URL mudou por fora (voltar/avançar, limpar): ajusta o texto durante a renderização.
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    setSynced(value)
    setText(value ?? '')
  }
  useEffect(() => {
    const next = text.trim() || undefined
    if (next === value) return
    const t = setTimeout(() => onCommit(next), 350)
    return () => clearTimeout(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form role="search" onSubmit={(e) => (e.preventDefault(), onCommit(text.trim() || undefined))} className="relative flex-1">
      <label htmlFor="catalog-search" className="sr-only">
        Explorar coleções
      </label>
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-[22px] -translate-y-1/2 text-khaki" />
      <input
        id="catalog-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Explorar coleções"
        className="h-[45px] w-full rounded-[10px] bg-surface-card pr-3 pl-11 text-sm font-bold text-cream placeholder:text-khaki"
      />
    </form>
  )
}

export function CatalogSection({ search, data, isPending, isError, error, isRefreshing, onRetry, onChange, onClear, aside }: Props) {
  const page = search.page ?? 1
  const tab = search.tab ?? 'todos'
  const sort = search.sort ?? 'recentes'
  // Barra lateral (filtros com slider + destaque) e ordenação só existem no desktop: no mobile ficam no drawer.
  // Não montar a versão escondida evita o custo de render e os reflows forçados do slider (medição de tamanho).
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const filters = (
    <CatalogFilters
      search={search}
      facets={data?.facets}
      onChange={(p) => onChange(p)}
      onClear={onClear}
    />
  )

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-6">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>

      <div className="flex gap-12">
        {isDesktop && (
          <aside aria-label="Filtros do catálogo" className="flex w-[310px] shrink-0 flex-col gap-6">
            {filters}
            {aside}
          </aside>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CatalogTabs value={tab} onChange={(t) => onChange({ tab: t === 'todos' ? undefined : t })} />
            {isDesktop && <CatalogSortSelect value={sort} onChange={(s) => onChange({ sort: s === 'recentes' ? undefined : s })} />}
          </div>

          {search.q && (
            <p className="mt-4 flex items-center gap-2 text-sm text-sand">
              Resultados para <strong className="text-cream">“{search.q}”</strong>
              <button type="button" onClick={() => onChange({ q: undefined })} className="grid size-6 place-items-center rounded-full hover:bg-surface-raised" aria-label="Limpar busca">
                <X aria-hidden className="size-4" />
              </button>
            </p>
          )}

          <p className="sr-only" aria-live="polite" aria-atomic>
            {isPending ? 'Carregando NFTs' : data ? `${data.total} NFTs encontrados. Página ${page} de ${Math.max(1, data.totalPages)}.` : ''}
          </p>
          {isRefreshing && (
            <p role="status" className="mt-3 text-xs text-sand">
              Atualizando resultados…
            </p>
          )}

          <div className="mt-8 lg:mt-8">
            {isPending ? (
              <ul aria-busy className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:gap-x-8 lg:gap-y-[72px]" data-testid="catalog-skeleton">
                {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : isError && !data ? (
              <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
                <p className="font-bold">Não foi possível carregar o catálogo.</p>
                <p className="text-sm text-sand">{error?.message}</p>
                <Button size="cta" onClick={onRetry}>
                  Tentar novamente
                </Button>
              </div>
            ) : data && data.items.length === 0 && data.total > 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
                <p className="font-bold">Esta página não existe.</p>
                <p className="text-sm text-sand">
                  Há {data.total} NFTs para esta busca, em {data.totalPages} {data.totalPages === 1 ? 'página' : 'páginas'}.
                </p>
                <Button size="cta" variant="outline" onClick={() => onChange({})}>
                  Ir para a primeira página
                </Button>
              </div>
            ) : data && data.items.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
                <p className="font-bold">Nenhum NFT encontrado.</p>
                <p className="text-sm text-sand">
                  {hasActiveFilters(search) ? 'Tente ajustar a busca ou remover alguns filtros.' : 'Não há NFTs listados no momento.'}
                </p>
                {hasActiveFilters(search) && (
                  <Button size="cta" variant="outline" onClick={onClear}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              data && (
                <ul
                  aria-busy={isRefreshing}
                  className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-6 transition-opacity sm:grid-cols-3 lg:gap-x-8 lg:gap-y-[72px]',
                    // Mobile: coluna da direita deslocada 32px (composição do Figma)
                    'max-sm:pb-8 max-sm:[&>li:nth-child(even)]:translate-y-8',
                    isRefreshing && 'opacity-70',
                  )}
                >
                  {data.items.map((nft, i) => (
                    <li key={nft.id}>
                      <NftCard nft={nft} priority={i < 3} />
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          {isError && data && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Não foi possível atualizar os resultados. <button type="button" className="underline" onClick={onRetry}>Tentar novamente</button>
            </p>
          )}

          <div className="mt-12 lg:mt-[88px]">{data && <CatalogPagination page={page} totalPages={data.totalPages} />}</div>
        </div>
      </div>
    </section>
  )
}

/** Barra do mobile/tablet (Figma "Search Bar"): busca + botão que abre os filtros em drawer. Fica acima do hero. */
export function CatalogMobileBar({
  search,
  data,
  onChange,
  onClear,
}: Pick<Props, 'search' | 'data' | 'onChange' | 'onClear'>) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sort = search.sort ?? 'recentes'
  const activeCount = (search.category?.length ?? 0) + (search.network?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)
  const filters = <CatalogFilters search={search} facets={data?.facets} onChange={(p) => onChange(p)} onClear={onClear} />
  return (
    <div className="flex gap-2 lg:hidden">
      <SearchInput value={search.q} onCommit={(q) => onChange({ q })} />
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={`Filtros${activeCount ? ` (${activeCount} ativos)` : ''}`}
            className="relative grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-linear-to-b from-brand-accent to-brand text-ink"
          >
            <FilterIcon aria-hidden className="size-[22px]" />
            {activeCount > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-cream text-[11px] font-bold text-ink">
                {activeCount}
              </span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(92vw,360px)] overflow-y-auto border-line bg-surface-card">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription className="text-sand">{data ? `${data.total} NFTs encontrados` : 'Carregando…'}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <CatalogSortSelect value={sort} onChange={(s) => onChange({ sort: s === 'recentes' ? undefined : s })} id="catalog-sort-mobile" />
          </div>
          {filters}
        </SheetContent>
      </Sheet>
    </div>
  )
}
