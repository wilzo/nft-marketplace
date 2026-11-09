import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import LogoKurio from '@/assets/icons/logo-kurio.svg?react'
import { Skeleton } from '@/components/ui/skeleton'
import { http } from '@/lib/http'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/** Placeholder: valida a cadeia Router → Query → Axios → MSW e os tokens do tema. Substituído na etapa 3. */
function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) => (await http.get<{ status: string }>('/health', { signal })).data,
  })

  return (
    <main className="mx-auto max-w-(--container-content) px-4 py-24">
      <h1>
        <LogoKurio role="img" aria-label="Kurio" className="h-9 w-auto text-cream" />
      </h1>
      <p data-testid="api-status" className="mt-4 text-sand">
        API simulada: {health.isPending ? 'carregando…' : health.isError ? 'indisponível' : health.data.status}
      </p>
      <Skeleton className="mt-6 h-40 w-40" />
    </main>
  )
}
