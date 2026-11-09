import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { nftDetailQuery } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/favorites'
import { requireAuth } from '@/features/session/session'

export const Route = createFileRoute('/favoritos')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: FavoritesPage,
})

/** Favoritos do colecionador (persistidos na API por usuário). */
function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const nfts = useQueries({ queries: ids.map((id) => nftDetailQuery(id)) })

  return (
    <main id="conteudo" className="mx-auto w-full max-w-(--container-content) lg:pt-10">
      <h1 className="text-2xl font-bold lg:text-[28px]">Favoritos</h1>
      <p className="mt-2 text-sm text-sand" aria-live="polite">
        {favorites.isPending ? 'Carregando…' : `${ids.length} ${ids.length === 1 ? 'NFT salvo' : 'NFTs salvos'}`}
      </p>

      {favorites.isError ? (
        <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Não foi possível carregar seus favoritos.</p>
          <Button size="cta" onClick={() => void favorites.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !favorites.isPending && ids.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Você ainda não favoritou nenhum NFT.</p>
          <Button asChild size="cta">
            <Link to="/" hash="catalogo">
              Explorar o mercado
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
          {(favorites.isPending ? Array.from({ length: 4 }, () => null) : ids).map((id, i) => {
            const q = id ? nfts[i] : null
            return <li key={id ?? i}>{q?.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          })}
        </ul>
      )}
    </main>
  )
}
