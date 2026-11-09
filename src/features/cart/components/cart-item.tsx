import { Link } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import type { CartItem } from '@/api/contracts'
import DeleteIcon from '@/assets/icons/curved-delete.svg?react'
import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { QuantityStepper } from '@/features/nft-detail/components/purchase'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useRemoveCartItem, useUpdateCartItem } from '../mutations'

/** Grade das colunas do Figma: NFTs · Preço · Edições · Total · remover. */
export const CART_GRID = 'lg:grid lg:grid-cols-[311px_138px_137px_1fr_36px] lg:items-center'

function statusMessage(item: CartItem) {
  switch (item.status) {
    case 'sold_out':
      return { tone: 'error', text: 'Esgotado: remova este item para continuar.' }
    case 'quantity_exceeds':
      return { tone: 'error', text: `Disponível: ${Math.min(item.available, item.maxPerOrder)}. Reduza a quantidade para continuar.` }
    case 'price_changed':
      return { tone: 'warn', text: `Preço alterado de ${formatEth(item.seenUnitPrice)} para ${formatEth(item.unitPrice)} ETH.` }
    default:
      return null
  }
}

/** Item do carrinho: linha da tabela no desktop (Figma "Carrinho de NFTs") e card no mobile. */
export function CartItemRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const limit = Math.min(item.available, item.maxPerOrder)
  const status = statusMessage(item)

  const stepper = (
    <QuantityStepper
      id={`qty-${item.id}`}
      size="sm"
      value={item.quantity}
      max={Math.max(item.quantity > limit ? item.quantity : limit, 1)}
      onChange={(quantity) => {
        if (quantity > limit) return
        update.mutate({ itemId: item.id, quantity, name: item.name })
      }}
      disabled={item.status === 'sold_out'}
    />
  )
  const removeButton = (
    <button
      type="button"
      onClick={() => remove.mutate({ itemId: item.id, name: item.name })}
      aria-label={`Remover ${item.name} do carrinho`}
      className="grid size-9 place-items-center rounded-md text-khaki transition-colors hover:text-coral"
    >
      <DeleteIcon aria-hidden className="size-6" />
    </button>
  )

  return (
    <li className="flex flex-col gap-2">
      <div
        className={cn(
          'flex gap-3 overflow-hidden rounded-xl bg-surface-card lg:gap-0 lg:rounded-none lg:pr-2',
          CART_GRID,
          status?.tone === 'error' && 'ring-1 ring-error/60',
        )}
      >
        {/* NFT */}
        <div className="flex min-w-0 items-center gap-4 lg:pr-4">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} tabIndex={-1} aria-hidden className="shrink-0">
            <NftImage image={item.image} alt="" sizes="100px" className="size-[100px] lg:size-[70px]" />
          </Link>
          <div className="min-w-0 py-2 lg:py-0">
            <h3 className="truncate text-[15px] leading-5 font-bold">
              <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="hover:text-brand-accent">
                {item.name}
              </Link>
            </h3>
            <p className="text-sm leading-6 text-khaki">
              <span className="hidden lg:inline">ID do token: {item.tokenId}</span>
              <span className="lg:hidden">Edição: {item.editionLabel}</span>
            </p>
            {/* Mobile: total da linha + quantidade (Figma) */}
            <p className="mt-1 text-lg font-bold text-brand-accent lg:hidden">{formatEth(item.lineTotal)} ETH</p>
          </div>
        </div>
        {/* Desktop: colunas */}
        <p className="hidden text-base font-medium text-brand-accent lg:block">
          <span className="sr-only">Preço unitário: </span>
          {formatEth(item.unitPrice)} ETH
        </p>
        <div className="ml-auto flex flex-col items-end justify-center gap-1 pr-2 lg:ml-0 lg:block lg:pr-0">
          <div className="lg:hidden">{removeButton}</div>
          {stepper}
        </div>
        <p className="hidden text-base font-bold text-brand-accent lg:block">
          <span className="sr-only">Total do item: </span>
          {formatEth(item.lineTotal)} ETH
        </p>
        <div className="hidden lg:block">{removeButton}</div>
      </div>
      {status && (
        <p className={cn('flex items-center gap-1.5 text-sm', status.tone === 'error' ? 'text-coral' : 'text-amber')}>
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="sr-only">{item.name}: </span>
            {status.text}
          </span>
        </p>
      )}
    </li>
  )
}

export function CartItemSkeleton() {
  return (
    <li aria-hidden className={cn('flex items-center gap-4 rounded-xl bg-surface-card lg:rounded-none', CART_GRID)}>
      <div className="flex items-center gap-4">
        <Skeleton className="size-[100px] rounded-none lg:size-[70px]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <Skeleton className="hidden h-4 w-20 lg:block" />
      <Skeleton className="hidden h-7 w-24 lg:block" />
      <Skeleton className="hidden h-4 w-20 lg:block" />
    </li>
  )
}
