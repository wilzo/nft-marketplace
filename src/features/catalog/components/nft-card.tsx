import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { NftSummary } from '@/api/contracts'
import CartIcon from '@/assets/icons/cart.svg?react'
import SearchIcon from '@/assets/icons/header-search.svg?react'
import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart/mutations'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const actionClass =
  'grid size-[34px] place-items-center rounded-md border border-line bg-ink/90 text-cream transition-colors hover:border-brand hover:text-brand-accent disabled:opacity-40'

/**
 * Card de NFT (Figma: bloco 258×300 #241612 com arte 250×250 r15; mobile: card 175 com r20, selo "RARO" e coração).
 * Ações rápidas do Figma (carrinho, favoritar, ver) aparecem no hover/foco no desktop.
 * Preço anterior e esgotado não dependem só de cor.
 */
export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const soldOut = nft.available === 0
  const addToCart = useAddToCart()
  const label = `${nft.name}, ${formatEth(nft.price)} ETH${soldOut ? ', esgotado' : ''}`

  const quickAdd = () =>
    addToCart.mutate(
      { nftId: nft.id, editionId: nft.defaultEditionId, quantity: 1 },
      {
        onSuccess: () => toast.success(`${nft.name} adicionado ao carrinho.`),
        onError: (error) => toast.error(error.message),
      },
    )

  return (
    <article className={cn('group relative', className)}>
      <div className="relative grid aspect-[258/300] place-items-center overflow-hidden rounded-[20px] bg-linear-to-b from-surface-raised to-surface-card lg:rounded-none lg:bg-surface-card lg:bg-none">
        {/* Link duplicado da arte: clicável com o mouse, fora da ordem de tabulação (o link do nome é o principal). */}
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} tabIndex={-1} aria-hidden className="grid size-full place-items-center">
          <NftImage
            image={nft.image}
            alt=""
            sizes="(min-width: 1024px) 250px, 45vw"
            priority={priority}
            className="w-[97%] rounded-[15px] transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
        {nft.rare && <span className="absolute top-3 left-0 bg-brand px-2 py-1.5 text-xs font-bold text-ink lg:top-4">RARO</span>}
        {soldOut && (
          <span className="absolute right-3 bottom-3 rounded-sm bg-ink/90 px-2 py-1 text-xs font-bold text-coral lg:bottom-auto lg:top-4">Esgotado</span>
        )}

        {/* Mobile: coração no canto (Figma) */}
        <FavoriteButton nftId={nft.id} name={nft.name} variant="icon" className="absolute top-3 right-3 size-7 bg-ink/80 lg:hidden" />

        {/* Desktop: ações rápidas no hover/foco */}
        <div className="absolute bottom-5 hidden gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 lg:flex">
          <button type="button" className={actionClass} aria-label={`Adicionar ${nft.name} ao carrinho`} disabled={soldOut || addToCart.isPending} onClick={quickAdd}>
            <CartIcon aria-hidden className="h-[18px] w-4" />
          </button>
          <FavoriteButton nftId={nft.id} name={nft.name} variant="icon" className={cn(actionClass, 'rounded-md text-cream')} />
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={actionClass} aria-label={`Ver detalhes de ${nft.name}`}>
            <SearchIcon aria-hidden className="size-[18px]" />
          </Link>
        </div>
      </div>

      <h3 className="mt-3 truncate pl-2 text-base leading-4 text-cream lg:pl-0">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} aria-label={label} className="hover:text-brand-accent focus-visible:outline-offset-2">
          {nft.name}
        </Link>
      </h3>
      <p className="mt-3 flex items-baseline gap-3 pl-2 lg:pl-0">
        <span className="text-lg leading-4 font-bold text-brand-accent">{formatEth(nft.price)} ETH</span>
        {nft.previousPrice && (
          <span className="text-lg leading-4 text-khaki line-through">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.previousPrice)} ETH
          </span>
        )}
      </p>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[258/300] w-full rounded-[20px] lg:rounded-none" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/3" />
    </div>
  )
}
