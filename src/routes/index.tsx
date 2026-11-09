import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { http } from '@/lib/http'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/** Placeholder da etapa 1: valida a cadeia Router → Query → Axios → MSW. Substituído na etapa 3. */
function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) => (await http.get<{ status: string }>('/health', { signal })).data,
  })

  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <h1 className="text-3xl font-semibold">NFT Marketplace</h1>
      <p data-testid="api-status" className="mt-4 text-muted-foreground">
        API simulada: {health.isPending ? 'carregando…' : health.isError ? 'indisponível' : health.data.status}
      </p>
    </main>
  )
}
