import { useEffect, useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { useRelated } from '@/features/catalog/queries'
import { cn } from '@/lib/utils'

/**
 * Carrossel de NFTs com scroll-snap e indicadores de página
 * (Figma: "Mais desta coleção" no detalhe e "Colecionadores também viram" no carrinho).
 */
export function NftCarousel({ title, items, id }: { title: string; items: NftSummary[] | undefined; id: string }) {
  const scroller = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => {
      setPages(Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05)))
      setPage(Math.round(el.scrollLeft / el.clientWidth))
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [items])

  if (items && items.length === 0) return null

  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <h2 id={id} className="border-b border-brand/30 pb-3 text-lg leading-4 font-bold text-brand-accent">
        {title}
      </h2>
      <ul ref={scroller} className="-mx-1 flex snap-x snap-mandatory gap-7 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none]">
        {(items ?? Array.from({ length: 5 }, () => null)).map((nft, i) => (
          <li key={nft?.id ?? i} className="w-[min(60vw,219px)] shrink-0 snap-start">
            {nft ? <NftCard nft={nft} /> : <NftCardSkeleton />}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div role="group" aria-label={`Páginas de ${title}`} className="flex flex-wrap justify-center gap-5">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Página ${i + 1} de ${pages}`}
              aria-pressed={i === page}
              onClick={() => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth })}
              className="-m-1.5 grid size-6 place-items-center"
            >
              <span aria-hidden className={cn('size-3 rounded-full border border-brand', i === page && 'bg-brand')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/** "Mais desta coleção" do detalhe. */
export function RelatedNfts({ nftId }: { nftId: string }) {
  const related = useRelated(nftId)
  return <NftCarousel id="related-title" title="Mais desta coleção" items={related.data?.items} />
}
