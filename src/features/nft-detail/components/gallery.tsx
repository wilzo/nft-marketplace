import { useState } from 'react'
import type { NftImage as NftImageKey } from '@/api/contracts'
import SearchIcon from '@/assets/icons/header-search.svg?react'
import { NftImage } from '@/components/nft-image'
import { nftImageSrc } from '@/lib/nft-image-src'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Galeria do detalhe (Figma "Product Images"): 4 miniaturas 100×100 r8 + imagem principal 444×444 (arte 404 r24)
 * com botão de zoom que abre um diálogo (foco controlado pelo Radix).
 */
export function Gallery({ images, name }: { images: NftImageKey[]; name: string }) {
  const [index, setIndex] = useState(0)
  const current = images[index] ?? images[0]

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row lg:gap-7">
      <ul aria-label="Imagens do NFT" className="flex gap-3 lg:flex-col lg:gap-4">
        {images.map((img, i) => (
          <li key={`${img}-${i}`}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              aria-label={`Imagem ${i + 1} de ${images.length}`}
              className={cn('block size-16 overflow-hidden rounded-lg border border-transparent bg-surface-card sm:size-20 lg:size-[100px]', i === index && 'border-brand')}
            >
              <NftImage image={img} alt="" sizes="100px" className="size-full" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative w-full rounded-md bg-surface-card p-4 lg:size-[444px] lg:shrink-0">
        <NftImage image={current} alt={`Arte do NFT ${name}`} sizes="(min-width: 1024px) 404px, 90vw" priority className="w-full rounded-3xl" />
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
  )
}
