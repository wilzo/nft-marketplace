import type { NftImage as NftImageKey } from '@/api/contracts'
import { NFT_IMAGE_WIDTHS as WIDTHS, nftImageSrc } from '@/lib/nft-image-src'
import { cn } from '@/lib/utils'


interface NftImageProps extends Omit<React.ComponentProps<'img'>, 'src' | 'srcSet'> {
  image: NftImageKey
  alt: string
  /** Largura renderizada (para o navegador escolher a variante). */
  sizes: string
  /** Imagem do LCP: carrega cedo e com prioridade. */
  priority?: boolean
}

/** Arte de NFT responsiva (WebP 320/640/960) com dimensões fixas para evitar layout shift. */
export function NftImage({ image, alt, sizes, priority = false, className, ...props }: NftImageProps) {
  return (
    <img
      src={nftImageSrc(image)}
      srcSet={WIDTHS.map((w) => `${nftImageSrc(image, w)} ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      width={640}
      height={640}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      className={cn('aspect-square object-cover', className)}
      {...props}
    />
  )
}
