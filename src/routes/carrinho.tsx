import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CART_GRID, CartItemRow, CartItemSkeleton } from '@/features/cart/components/cart-item'
import { CartSummary } from '@/features/cart/components/cart-summary'
import { useAcknowledgePrices, useRemoveCoupon } from '@/features/cart/mutations'
import { useCart, useQuote } from '@/features/cart/queries'
import { useCatalog } from '@/features/catalog/queries'
import { NftCarousel } from '@/features/nft-detail/components/related'
import { useViewerScope } from '@/features/session/use-viewer'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/carrinho')({
  component: CartPage,
})

function CartPage() {
  const scope = useViewerScope()
  const cart = useCart(scope)
  const quote = useQuote(scope, cart.data)
  const suggestions = useCatalog({ tab: 'em-alta', sort: 'recentes', page: 1, pageSize: 5 })
  const acknowledge = useAcknowledgePrices()
  const removeCoupon = useRemoveCoupon()
  const navigate = useNavigate()
  const router = useRouter()

  const items = cart.data?.items ?? []
  const priceChanged = items.filter((i) => i.status === 'price_changed')
  const couponIssue = quote.data?.issues.find((i) => i.type === 'COUPON_EXPIRED' || i.type === 'COUPON_INVALID')

  return (
    <main id="conteudo" className="mx-auto w-full max-w-(--container-content) lg:pt-8">
      {/* Mobile: voltar + título (Figma "Mobile / Carrinho de NFTs") */}
      <div className="relative mb-4 flex items-center justify-center lg:hidden">
        <button
          type="button"
          onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: '/' }))}
          aria-label="Voltar"
          className="absolute left-0 grid size-9 place-items-center rounded-full border border-line bg-surface-card"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <h1 className="text-xl font-bold">Carrinho de NFTs</h1>
      </div>

      <nav aria-label="Trilha de navegação" className="mb-3 hidden lg:block">
        <ol className="flex gap-1.5 text-[15px] leading-4 font-bold">
          <li>
            <Link to="/" className="hover:text-brand-accent">
              Início
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="catalogo" className="hover:text-brand-accent">
              Mercado
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Carrinho</li>
        </ol>
      </nav>
      {/* Título acessível no desktop (o Figma mostra só a trilha); no mobile o título é visível acima. */}
      <h1 className="sr-only max-lg:hidden">Carrinho de NFTs</h1>

      {cart.isError && !cart.data ? (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Não foi possível carregar seu carrinho.</p>
          <p className="text-sm text-sand">{cart.error.message}</p>
          <Button size="cta" onClick={() => void cart.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : cart.data && items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Seu carrinho está vazio.</p>
          <p className="text-sm text-sand">Explore o mercado e adicione NFTs para colecionar.</p>
          <Button asChild size="cta">
            <Link to="/" hash="catalogo">
              Explorar o mercado
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-[86px]">
          <section aria-labelledby="cart-items-title" className="min-w-0 flex-1 lg:max-w-[782px]">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>
            <div aria-hidden className={cn('mb-3 hidden border-b border-line pb-2 text-base font-bold', CART_GRID)}>
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
            </div>

            {priceChanged.length > 0 && (
              <div role="status" className="mb-4 flex flex-col gap-3 rounded-md border border-amber/50 bg-surface-raised p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-amber">
                  {priceChanged.length === 1
                    ? `O preço de ${priceChanged[0].name} mudou enquanto você navegava.`
                    : `${priceChanged.length} itens mudaram de preço enquanto você navegava.`}{' '}
                  Revise o resumo antes de continuar.
                </p>
                <Button size="cta" variant="outline" className="shrink-0" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
                  Aceitar novos preços
                </Button>
              </div>
            )}
            {couponIssue && (
              <div role="status" className="mb-4 flex flex-col gap-3 rounded-md border border-error/60 bg-surface-raised p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-coral">
                  O cupom {couponIssue.code} {couponIssue.type === 'COUPON_EXPIRED' ? 'expirou' : 'não é mais válido'} e não foi aplicado.
                </p>
                <Button size="cta" variant="outline" className="shrink-0" onClick={() => removeCoupon.mutate()}>
                  Remover cupom
                </Button>
              </div>
            )}

            <ul className="flex flex-col gap-3 lg:gap-3" aria-busy={cart.isPending} data-testid={cart.isPending ? 'cart-skeleton' : undefined}>
              {cart.isPending ? Array.from({ length: 3 }, (_, i) => <CartItemSkeleton key={i} />) : items.map((item) => <CartItemRow key={item.id} item={item} />)}
            </ul>
          </section>

          <div className="lg:w-[332px] lg:shrink-0">
            {cart.data ? (
              <CartSummary
                cart={cart.data}
                quote={quote.data}
                quotePending={quote.isPending}
                quoteRefreshing={quote.isPlaceholderData || (quote.isFetching && !quote.isPending)}
                quoteError={quote.error}
                onRetryQuote={() => void quote.refetch()}
              />
            ) : (
              <div data-testid="summary-skeleton" aria-hidden className="h-[360px] rounded-lg bg-surface-card lg:bg-transparent" />
            )}
          </div>
        </div>
      )}

      <div className="mt-16 lg:mt-24">
        <NftCarousel id="suggestions-title" title="Colecionadores também viram" items={suggestions.data?.items} />
      </div>
    </main>
  )
}
