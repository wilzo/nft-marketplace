import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Highlights } from '@/api/contracts'
import { nftsApi } from '@/api/endpoints'
import LogoKurio from '@/assets/icons/logo-kurio.svg?react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { realtime } from '@/lib/realtime'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * Placeholder da etapa 2: valida Router → Query → Axios → MSW (REST) e socket.io-client → MSW (eventos).
 * Substituído pela home real na etapa 3.
 */
function HomePage() {
  const queryClient = useQueryClient()
  const highlights = useQuery({ queryKey: ['highlights'], queryFn: ({ signal }) => nftsApi.highlights({ signal }) })

  useEffect(() => {
    return realtime.on('nft.updated', (event) => {
      queryClient.setQueryData<Highlights>(['highlights'], (old) => {
        if (!old || old.hero.id !== event.resource.id) return old
        return { ...old, hero: { ...old.hero, price: event.data.price, available: event.data.available, version: event.version } }
      })
    })
  }, [queryClient])

  return (
    <main className="mx-auto max-w-(--container-content) px-4 py-24">
      <h1>
        <LogoKurio role="img" aria-label="Kurio" className="h-9 w-auto text-cream" />
      </h1>
      {highlights.isPending ? (
        <Skeleton className="mt-6 h-6 w-64" />
      ) : highlights.isError ? (
        <p role="alert" className="mt-6 text-destructive">
          {highlights.error.message}
        </p>
      ) : (
        <p data-testid="hero" className="mt-6 text-sand" aria-live="polite">
          {highlights.data.hero.name} — {formatEth(highlights.data.hero.price)} ETH
        </p>
      )}
    </main>
  )
}
