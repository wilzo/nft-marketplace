import { useState } from 'react'
import type { NftImage as NftImageKey } from '@/api/contracts'
import SearchIcon from '@/assets/icons/header-search.svg?react'
import { NftImage } from '@/components/nft-image'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { nftImageSrc } from '@/lib/nft-image-src'
import { cn } from '@/lib/utils'

/**
 * Galeria do detalhe.
 * Desktop (Figma "Product Images"): 4 miniaturas 100×100 r8 (a 2ª selecionada, como no frame) + imagem 444×444 com zoom.
 * Mobile (Figma "Mobile / Detalhes"): uma imagem grande; as demais por deslize (scroll-snap), sem miniaturas.
 */
export function Gallery({ images, name }: { images: NftImageKey[]; name: string }) {
  const [index, setIndex] = useState(Math.min(1, images.length - 1))
  const current = images[index] ?? images[0]

  return (
    <>
      {/* Mobile */}
      <ul aria-label="Imagens do NFT" className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 [scrollbar-width:none] lg:hidden">
        {images.map((img, i) => (
          <li key={`${img}-${i}`} className="w-full shrink-0 snap-center">
            <NftImage
              image={img}
              alt={i === 0 ? `Arte do NFT ${name}` : `Arte do NFT ${name}, imagem ${i + 1} de ${images.length}`}
              sizes="92vw"
              priority={i === 0}
              className="w-full rounded-3xl"
            />
          </li>
        ))}
      </ul>

      {/* Desktop */}
      <div className="hidden gap-7 lg:flex">
        <ul aria-label="Miniaturas do NFT" className="flex flex-col gap-4">
          {images.map((img, i) => (
            <li key={`${img}-${i}`}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === index}
                aria-label={`Imagem ${i + 1} de ${images.length}`}
                className={cn('block size-[100px] overflow-hidden rounded-lg border border-transparent bg-surface-card', i === index && 'border-brand')}
              >
                <NftImage image={img} alt="" sizes="100px" className="size-full" />
              </button>
            </li>
          ))}
        </ul>

        <div className="relative size-[444px] shrink-0 rounded-md bg-surface-card p-4">
          <NftImage image={current} alt={`Arte do NFT ${name}`} sizes="404px" priority className="w-full rounded-3xl" />
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Ampliar imagem"
                className="absolute top-[15px] right-[15px] grid size-[30px] place-items-center rounded-full border border-line bg-surface-raised text-cream hover:text-brand-accent"
              >
                <SearchIcon aria-hidden className="size-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(92vw,720px)] border-line bg-surface-card p-3 sm:max-w-[min(92vw,720px)]">
              <DialogTitle className="sr-only">{name}</DialogTitle>
              <DialogDescription className="sr-only">Imagem ampliada do NFT</DialogDescription>
              <img src={nftImageSrc(current, 960)} alt={`Arte do NFT ${name} ampliada`} width={960} height={960} className="h-auto w-full rounded-2xl" />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  )
}
