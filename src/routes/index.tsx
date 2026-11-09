import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CatalogMobileBar, CatalogSection } from '@/features/catalog/components/catalog-section'
import { FeaturedBanner, Hero, Journal, Promos } from '@/features/catalog/components/home-sections'
import { catalogQuery, highlightsQuery, useCatalog, useHighlights } from '@/features/catalog/queries'
import { catalogSearchSchema, toCatalogQuery, withFilters, type CatalogSearch } from '@/features/catalog/search'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query'

export const Route = createFileRoute('/')({
  // Busca, filtros, ordenação e página vivem na URL (refresh e voltar/avançar restauram o estado).
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toCatalogQuery(search),
  // Pré-carrega sem bloquear a renderização: os skeletons aparecem enquanto os dados chegam.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogQuery(deps))
    void context.queryClient.prefetchQuery(highlightsQuery)
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const catalog = useCatalog(toCatalogQuery(search))
  const highlights = useHighlights()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const showEditorial = useAfterFirstResponse(!catalog.isPending)

  const clear = () => void navigate({ search: {}, resetScroll: false })
  const update = (patch: Partial<CatalogSearch>, opts?: { replace?: boolean }) =>
    void navigate({ search: (prev) => withFilters(prev, patch), replace: opts?.replace, resetScroll: false })

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-(--container-content) flex-col gap-8 pt-0 lg:gap-24 lg:pt-8">
      {!isDesktop && <CatalogMobileBar search={search} data={catalog.data} onChange={update} onClear={clear} />}
      <Hero highlights={highlights.data} />
      <CatalogSection
        search={search}
        data={catalog.data}
        isPending={catalog.isPending}
        isError={catalog.isError}
        error={catalog.error}
        isRefreshing={catalog.isPlaceholderData || (catalog.isFetching && !catalog.isPending)}
        onRetry={() => void catalog.refetch()}
        onChange={update}
        onClear={clear}
        aside={<FeaturedBanner highlights={highlights.data} />}
      />
      {/*
        Seções editoriais abaixo da dobra: montadas depois da 1ª resposta do catálogo (dados ou erro), numa tarefa própria,
        para que as artes delas (até 960 px) e o render não disputem banda e CPU com os dados e a imagem do LCP.
        O skeleton do catálogo segura a altura (sem deslocamento de layout).
      */}
      {showEditorial && (
        <>
          <Promos />
          <Journal />
        </>
      )}
    </main>
  )
}

/** Fica true no primeiro momento ocioso depois de `ready` (no máximo 1 s depois) — e permanece true. */
function useAfterFirstResponse(ready: boolean) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!ready || shown) return
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setShown(true), { timeout: 1_000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setShown(true), 50)
    return () => window.clearTimeout(id)
  }, [ready, shown])
  return shown
}
