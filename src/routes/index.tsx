import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CatalogMobileBar, CatalogSection } from '@/features/catalog/components/catalog-section'
import { FeaturedBanner, Hero, Journal, Promos } from '@/features/catalog/components/home-sections'
import { catalogQuery, highlightsQuery, useCatalog, useHighlights } from '@/features/catalog/queries'
import { catalogSearchSchema, toCatalogQuery, withFilters, type CatalogSearch } from '@/features/catalog/search'

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

  const clear = () => void navigate({ search: {}, resetScroll: false })
  const update = (patch: Partial<CatalogSearch>, opts?: { replace?: boolean }) =>
    void navigate({ search: (prev) => withFilters(prev, patch), replace: opts?.replace, resetScroll: false })

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-(--container-content) flex-col gap-8 pt-0 lg:gap-24 lg:pt-8">
      <CatalogMobileBar search={search} data={catalog.data} onChange={update} onClear={clear} />
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
      <Promos />
      <Journal />
    </main>
  )
}
