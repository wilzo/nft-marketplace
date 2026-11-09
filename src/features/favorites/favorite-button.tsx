import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsFavorite, useToggleFavorite } from './favorites'

interface Props {
  nftId: string
  name: string
  /** 'button': botão "Favoritar" do detalhe; 'icon': ícone redondo (cards e topo do detalhe mobile). */
  variant: 'button' | 'icon'
  className?: string
}

/** Estado comunicado por aria-pressed e pelo texto/ícone preenchido (não só por cor). */
export function FavoriteButton({ nftId, name, variant, className }: Props) {
  const isFavorite = useIsFavorite(nftId)
  const { toggle } = useToggleFavorite()
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(nftId, name, isFavorite)
  }

  if (variant === 'button') {
    return (
      <Button variant="outline" size="cta" aria-pressed={isFavorite} onClick={onClick} className={cn('w-[130px] px-3 text-sm font-medium', className)}>
        <Heart aria-hidden className={cn('size-5', isFavorite && 'fill-current')} />
        {isFavorite ? 'Favoritado' : 'Favoritar'}
      </Button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      className={cn('grid place-items-center rounded-full text-brand transition-colors hover:text-brand-accent', className)}
    >
      <Heart aria-hidden className={cn('size-4', isFavorite && 'fill-current')} />
    </button>
  )
}
