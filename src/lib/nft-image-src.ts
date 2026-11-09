import type { NftImage } from '@/api/contracts'

export const NFT_IMAGE_WIDTHS = [320, 640, 960] as const

/** Caminho da variante WebP gerada por `npm run assets:images`. */
export function nftImageSrc(image: NftImage, width: (typeof NFT_IMAGE_WIDTHS)[number] = 640) {
  return `/images/nfts/${image}-${width}.webp`
}
