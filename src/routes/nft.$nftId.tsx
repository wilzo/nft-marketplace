import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Star } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { EditionKind, NETWORK_LABELS, type NftDetail } from '@/api/contracts'
import LinkedinIcon from '@/assets/icons/footer-linkedin.svg?react'
import TwitterIcon from '@/assets/icons/footer-twitter.svg?react'
import ShopIcon from '@/assets/icons/shop.svg?react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAddToCart } from '@/features/cart/mutations'
import { nftDetailQuery, useNftDetail } from '@/features/catalog/queries'
import { Gallery } from '@/features/nft-detail/components/gallery'
import { EditionPicker, QuantityStepper } from '@/features/nft-detail/components/purchase'
import { editionLimit } from '@/features/nft-detail/edition'
import { RelatedNfts } from '@/features/nft-detail/components/related'
import { compareEth, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/nft/$nftId')({
  // Edição selecionada na URL: permite link direto para uma edição (inclusive indisponível).
  validateSearch: z.object({ edicao: EditionKind.optional().catch(undefined) }),
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId)),
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const detail = useNftDetail(nftId)

  if (detail.isPending) return <DetailSkeleton />
  if (detail.isError) {
    if (detail.error.code === 'NOT_FOUND') return <NftNotFound />
    return (
      <main id="conteudo" className="mx-auto w-full max-w-(--container-content) py-16">
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <h1 className="text-xl font-bold">Não foi possível carregar este NFT.</h1>
          <p className="text-sm text-sand">{detail.error.message}</p>
          <Button size="cta" onClick={() => void detail.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </main>
    )
  }
  return <DetailView nft={detail.data} />
}

function DetailView({ nft }: { nft: NftDetail }) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const router = useRouter()
  const addToCart = useAddToCart()

  // Edição: a da URL ou a mais barata disponível (mesmo preço exibido no catálogo).
  const fallback =
    [...nft.editions].filter((e) => e.available > 0).sort((a, b) => compareEth(a.price, b.price))[0] ?? nft.editions[0]
  const edition = nft.editions.find((e) => e.kind === search.edicao) ?? fallback
  const limit = editionLimit(edition)
  const unavailable = edition.available === 0
  const [requested, setQuantity] = useState(1)
  // Quantidade sempre dentro do limite da edição atual (derivada, sem efeito).
  const quantity = Math.max(1, Math.min(requested, Math.max(1, limit)))

  // Aviso de preço alterado em tempo real (evento nft.updated aplicado ao cache).
  const [priceNotice, setPriceNotice] = useState<string | null>(null)
  const lastPrice = useRef(edition.price)
  const lastEdition = useRef(edition.id)
  useEffect(() => {
    if (lastEdition.current === edition.id && compareEth(lastPrice.current, edition.price) !== 0) {
      setPriceNotice(`O preço desta edição foi atualizado de ${formatEth(lastPrice.current)} para ${formatEth(edition.price)} ETH.`)
    }
    lastPrice.current = edition.price
    lastEdition.current = edition.id
  }, [edition.id, edition.price])

  const buy = (goToCart: boolean) =>
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          if (goToCart) void navigate({ to: '/carrinho' })
          else toast.success(`${nft.name} (${edition.label}) adicionado ao carrinho.`)
        },
        onError: (error) => toast.error(error.message),
      },
    )

  const selectEdition = (id: string) => {
    const kind = nft.editions.find((e) => e.id === id)?.kind
    void navigate({ search: { edicao: kind }, replace: true, resetScroll: false })
    setPriceNotice(null)
  }

  const url = typeof window === 'undefined' ? '' : window.location.href
  const shortContract = `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}`
  const limitText = unavailable
    ? 'Edição indisponível: todas as unidades foram vendidas. Escolha outra edição.'
    : quantity >= limit
      ? `Limite atingido: máximo de ${limit} ${limit === 1 ? 'unidade' : 'unidades'} desta edição por pedido.`
      : null

  const buyButtons = (
    <div className="flex gap-2">
      <Button size="cta" className="w-[130px] text-sm" disabled={unavailable || addToCart.isPending} onClick={() => buy(true)}>
        {addToCart.isPending ? 'Adicionando…' : 'COMPRAR'}
      </Button>
      <Button asChild variant="outline" size="cta" className="w-[130px] px-3 text-sm font-medium">
        <Link to="/entrar">
          <Heart aria-hidden className="size-5" />
          Favoritar
        </Link>
      </Button>
    </div>
  )

  return (
    <main id="conteudo" className="mx-auto w-full max-w-(--container-content) pb-36 lg:pb-0">
      {/* Mobile: voltar + favoritar (Figma "Mobile / Detalhes do NFT") */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: '/' }))}
          aria-label="Voltar"
          className="grid size-9 place-items-center rounded-full border border-line bg-surface-card"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <Link to="/entrar" aria-label="Favoritar" className="grid size-9 place-items-center rounded-full border border-line bg-surface-card text-brand">
          <Heart aria-hidden className="size-4" />
        </Link>
      </div>

      <nav aria-label="Trilha de navegação" className="mb-3 hidden pt-8 lg:block">
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
        </ol>
      </nav>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="lg:w-[573px] lg:shrink-0">
          <Gallery images={nft.gallery} name={nft.name} />
        </div>

        <section aria-labelledby="nft-title" className="flex min-w-0 flex-1 flex-col gap-5 rounded-t-[28px] bg-surface-card p-6 lg:rounded-none lg:bg-transparent lg:p-0">
          <div className="flex flex-col gap-3 border-b border-brand/30 pb-3">
            <div className="flex items-start justify-between gap-3">
              <h1 id="nft-title" className="text-xl leading-tight font-bold lg:text-[28px] lg:leading-[37px]">
                {nft.name}
              </h1>
              <p className="flex shrink-0 items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-sm font-bold lg:hidden">
                <Star aria-hidden className="size-4 fill-brand text-brand" />
                {nft.rating.average.toFixed(1)}
                <span className="font-normal text-sand">({nft.rating.count})</span>
                <span className="sr-only">avaliações</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="hidden text-[22px] leading-4 font-bold text-brand-accent lg:block">
                {formatEth(edition.price)} ETH
              </p>
              <p className="hidden items-center gap-1 text-[15px] lg:flex">
                <span className="flex" aria-label={`Nota ${nft.rating.average.toFixed(1)} de 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} aria-hidden className={cn('size-[15px] text-khaki', i < Math.round(nft.rating.average) && 'fill-khaki')} />
                  ))}
                </span>
                {nft.rating.count} avaliações de colecionadores
              </p>
            </div>
          </div>

          {priceNotice && (
            <p role="status" className="rounded-md border border-amber/50 bg-surface-raised px-3 py-2 text-sm text-amber">
              {priceNotice}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="hidden text-[15px] leading-4 font-bold lg:block">Sobre este NFT:</h2>
            <p className="text-sm leading-6 text-sand">{nft.summary}</p>
          </div>

          <EditionPicker editions={nft.editions} value={edition.id} onChange={selectEdition} />

          {/* Desktop: quantidade + comprar/favoritar */}
          <div className="hidden items-center justify-between gap-4 lg:flex">
            <QuantityStepper id="qty-desktop" value={quantity} max={Math.max(1, limit)} onChange={setQuantity} disabled={unavailable} />
            {buyButtons}
          </div>
          {limitText && (
            <p role="status" className={cn('text-sm', unavailable ? 'text-coral' : 'text-amber')}>
              {limitText}
            </p>
          )}

          <dl className="flex flex-col gap-3 text-[15px] leading-5 text-khaki">
            <div className="flex gap-1">
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Coleção:</dt>
              <dd>{nft.collection}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2">
            <p className="text-[15px] leading-4 font-bold">Compartilhar este NFT:</p>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no LinkedIn (abre em nova aba)"
              className="text-cream hover:text-brand-accent"
            >
              <LinkedinIcon aria-hidden className="h-[14px] w-auto" />
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(url)}`} aria-label="Compartilhar por e-mail" className="text-cream hover:text-brand-accent">
              <svg aria-hidden viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(nft.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no Twitter (abre em nova aba)"
              className="text-cream hover:text-brand-accent"
            >
              <TwitterIcon aria-hidden className="h-3 w-auto" />
            </a>
          </div>
        </section>
      </div>

      <Tabs defaultValue="detalhes" className="mt-16 lg:mt-24">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-x-8 gap-y-2 rounded-none border-b border-brand/30 bg-transparent p-0">
          {[
            ['detalhes', 'Detalhes do NFT'],
            ['avaliacoes', `Avaliações de colecionadores (${nft.rating.count})`],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-auto flex-none rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-0 pb-2 text-base text-cream shadow-none data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-brand-accent dark:data-[state=active]:bg-transparent lg:text-lg"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="detalhes" className="mt-3 flex flex-col gap-3 text-sm leading-6 text-sand">
          <p>{nft.description}</p>
          <h3 className="mt-2 font-bold text-cream">Rede:</h3>
          <p>Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
          <h3 className="mt-2 font-bold text-cream">Contrato:</h3>
          <p>
            {shortContract} • Contrato inteligente {nft.standard} verificado.
          </p>
          <h3 className="mt-2 font-bold text-cream">Direitos autorais:</h3>
          <p>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
        </TabsContent>
        <TabsContent value="avaliacoes" className="mt-3 text-sm leading-6 text-sand">
          <p>
            Nota média <strong className="text-cream">{nft.rating.average.toFixed(1)} de 5</strong>, com base em {nft.rating.count} avaliações de
            colecionadores.
          </p>
          <p className="mt-2">Os comentários individuais das avaliações não fazem parte desta demonstração.</p>
        </TabsContent>
      </Tabs>

      <div className="mt-16 lg:mt-24">
        <RelatedNfts nftId={nft.id} />
      </div>

      {/* Mobile: barra de compra fixa (Figma: Qtd. − 1 + · preço · "Comprar NFT" · carrinho) */}
      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-surface-card px-6 pt-5 pb-6 shadow-raised lg:hidden">
        <div className="mx-auto flex max-w-[480px] flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-sand">Qtd.</span>
              <QuantityStepper id="qty-mobile" size="sm" value={quantity} max={Math.max(1, limit)} onChange={setQuantity} disabled={unavailable} />
            </div>
            <p className="text-xl font-bold text-brand-accent">{formatEth(edition.price)} ETH</p>
          </div>
          <div className="flex gap-3">
            <Button size="cta" className="h-[60px] flex-1 rounded-full text-base" disabled={unavailable || addToCart.isPending} onClick={() => buy(true)}>
              Comprar NFT
            </Button>
            <button
              type="button"
              aria-label="Adicionar ao carrinho"
              disabled={unavailable || addToCart.isPending}
              onClick={() => buy(false)}
              className="grid size-[60px] place-items-center rounded-full border border-line bg-surface-raised text-brand disabled:opacity-40"
            >
              <ShopIcon aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function NftNotFound() {
  return (
    <main id="conteudo" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">NFT não encontrado</h1>
      <p className="text-sand">Este NFT não existe ou foi removido do mercado.</p>
      <Button asChild size="cta">
        <Link to="/" hash="catalogo">
          Explorar o mercado
        </Link>
      </Button>
    </main>
  )
}

/** Skeleton com as mesmas dimensões do layout final (sem deslocamento ao carregar). */
function DetailSkeleton() {
  return (
    <main id="conteudo" aria-busy className="mx-auto w-full max-w-(--container-content) lg:pt-8" data-testid="detail-skeleton">
      <span className="sr-only" role="status">
        Carregando NFT
      </span>
      <Skeleton className="mb-3 hidden h-4 w-36 lg:block" />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="flex flex-col-reverse gap-4 lg:w-[573px] lg:flex-row lg:gap-7">
          <div className="flex gap-3 lg:flex-col lg:gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-16 rounded-lg sm:size-20 lg:size-[100px]" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full rounded-md lg:size-[444px]" />
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-[50px] w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      </div>
    </main>
  )
}
