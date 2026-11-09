import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/**
 * Card de NFT (Figma: bloco 258×300 #241612 com arte 250×250 r15; mobile: card 175 com r20 e selo "RARO").
 * O card inteiro é um link para o detalhe; preço anterior e esgotado não dependem só de cor.
 */
export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const soldOut = nft.available === 0
  return (
    <article className={cn('group relative', className)}>
      <Link
        to="/nft/$nftId"
        params={{ nftId: nft.id }}
        className="block rounded-[20px] focus-visible:outline-offset-4 lg:rounded-none"
        aria-label={`${nft.name}, ${formatEth(nft.price)} ETH${soldOut ? ', esgotado' : ''}`}
      >
        <div className="relative grid aspect-[258/300] place-items-center overflow-hidden rounded-[20px] bg-linear-to-b from-surface-raised to-surface-card lg:rounded-none lg:bg-surface-card lg:bg-none">
          <NftImage
            image={nft.image}
            alt=""
            sizes="(min-width: 1024px) 250px, 45vw"
            priority={priority}
            className="w-[97%] rounded-[15px] transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {nft.rare && (
            <span className="absolute top-3 left-0 bg-brand px-2 py-1.5 text-xs font-bold text-ink lg:top-4">RARO</span>
          )}
          {soldOut && (
            <span className="absolute right-3 bottom-3 rounded-sm bg-ink/90 px-2 py-1 text-xs font-bold text-coral">Esgotado</span>
          )}
        </div>
        <h3 className="mt-3 truncate pl-2 text-base leading-4 text-cream lg:pl-0">{nft.name}</h3>
        <p className="mt-3 flex items-baseline gap-3 pl-2 lg:pl-0">
          <span className="text-lg leading-4 font-bold text-brand-accent">{formatEth(nft.price)} ETH</span>
          {nft.previousPrice && (
            <span className="text-lg leading-4 text-khaki line-through">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.previousPrice)} ETH
            </span>
          )}
        </p>
      </Link>
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
