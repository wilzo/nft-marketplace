import { useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import type { Quote, User, WalletConnection, Wallets, WalletType } from '@/api/contracts'
import { walletsApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { blockingReason, sameQuoteValues } from '@/features/cart/checkout-rules'
import { useAcknowledgePrices } from '@/features/cart/mutations'
import { useCart, useQuote } from '@/features/cart/queries'
import { CheckoutForm, checkoutDefaults, fromWallet, type CheckoutFormInput, type CheckoutFormValues } from '@/features/checkout/checkout-form'
import { CollectorFields, ProviderOptions, QuoteLines, QuoteSkeleton, QuoteTotals, WalletCards } from '@/features/checkout/components/checkout-panels'
import { ReviewDialog, type ReviewProblem } from '@/features/checkout/components/review-dialog'
import { checkoutDraft, orderAttempt } from '@/features/checkout/storage'
import { staleQuoteFrom, usePlaceOrder } from '@/features/checkout/use-place-order'
import { usePendingOrders } from '@/features/orders/queries'
import { requireAuth } from '@/features/session/session'
import { useCurrentUser, useViewerScope } from '@/features/session/use-viewer'
import { useWallets } from '@/features/wallets/queries'
import type { ApiError } from '@/lib/api-error'
import { formatEth } from '@/lib/eth'
import { qk } from '@/lib/query-keys'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/use-media-query'

export const Route = createFileRoute('/pagamento')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: CheckoutPage,
})

function CheckoutPage() {
  const user = useCurrentUser()!
  const wallets = useWallets()
  if (wallets.isPending) {
    return (
      <main id="conteudo" aria-busy className="mx-auto w-full max-w-(--container-content) lg:pt-8">
        <Skeleton className="h-[600px] w-full" />
      </main>
    )
  }
  return <Checkout user={user} wallets={wallets.data ?? { primary: null, secondary: null }} />
}

function Checkout({ user, wallets }: { user: User; wallets: Wallets }) {
  const scope = useViewerScope()
  const client = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const cart = useCart(scope)
  const pending = usePendingOrders()
  const acknowledge = useAcknowledgePrices()
  const placeOrder = usePlaceOrder()

  // Formulário: rascunho da sessão (retomada após expiração/refresh) ou dados do perfil + carteira cadastrada.
  const defaults = useMemo<CheckoutFormInput>(
    () => ({ ...checkoutDefaults(user, wallets.primary), ...(checkoutDraft.get<Partial<CheckoutFormInput>>(user.id) ?? {}) }),
    [user, wallets.primary],
  )
  const form = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({ resolver: zodResolver(CheckoutForm), mode: 'onSubmit', defaultValues: defaults })
  useEffect(
    () => form.subscribe({ formState: { values: true }, callback: ({ values }) => checkoutDraft.set(user.id, values) }),
    [form, user.id],
  )

  const [walletSlot, network] = useWatch({ control: form.control, name: ['walletSlot', 'network'] })
  const wallet = (walletSlot === 'secondary' ? wallets.secondary : wallets.primary) ?? wallets.primary
  const hasWallets = !!wallets.primary
  const quote = useQuote(scope, cart.data, network)

  // Trocar de carteira cadastrada preenche os dados dela (rede, perfil, código, e-mail, ENS).
  const lastSlot = useRef(walletSlot)
  useEffect(() => {
    if (lastSlot.current === walletSlot) return
    lastSlot.current = walletSlot
    for (const [k, v] of Object.entries(fromWallet(wallet))) form.setValue(k as keyof CheckoutFormInput, v as never, { shouldValidate: true })
  }, [walletSlot, wallet, form])

  // Conexão simulada pelo provedor escolhido em "Carteira e rede"; trocar carteira ou rede exige reconectar.
  const [provider, setProvider] = useState<WalletType | null>(null)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const connectKey = `${wallet?.id}:${network}`
  const [connectedFor, setConnectedFor] = useState(connectKey)
  if (connectedFor !== connectKey) {
    setConnectedFor(connectKey)
    setConnection(null)
    setProvider(null)
  }
  const connect = useMutation({
    mutationFn: () => walletsApi.connect(wallet!.id, network),
    onMutate: () => setWalletError(null),
    onSuccess: setConnection,
    onError: (error: ApiError) => {
      setProvider(null)
      setWalletError(error.message)
    },
  })
  const disconnect = useMutation({
    mutationFn: () => walletsApi.disconnect(connection!.id),
    onSettled: () => {
      setConnection(null)
      setProvider(null)
    },
  })
  const selectProvider = (type: WalletType) => {
    if (!wallet) return setWalletError('Cadastre uma carteira para continuar.')
    setProvider(type)
    setConnection(null)
    connect.mutate()
  }

  // Revisão: cotação congelada no momento da revisão; mudanças posteriores exigem nova confirmação.
  const [review, setReview] = useState<{ quote: Quote; values: CheckoutFormValues } | null>(null)
  const [problem, setProblem] = useState<ReviewProblem | null>(null)
  const liveChanged = !!review && !!quote.data && !quote.isPlaceholderData && !sameQuoteValues(review.quote, quote.data)
  const shownProblem: ReviewProblem | null =
    problem ?? (liveChanged ? { kind: 'changed', message: 'Os valores mudaram desde a revisão (preço, disponibilidade ou taxas). Revise antes de confirmar.' } : null)
  const reason = cart.data ? blockingReason(cart.data, quote.data) : null
  const [formAlert, setFormAlert] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const onInvalid = (errors: FieldErrors<CheckoutFormInput>) => {
    // Mobile: os dados do colecionador ficam recolhidos; abre e foca o primeiro erro.
    setDetailsOpen(true)
    const first = Object.keys(errors)[0] as keyof CheckoutFormInput | undefined
    if (first) setTimeout(() => form.setFocus(first), 0)
  }
  const openReview = form.handleSubmit((values) => {
    setFormAlert(null)
    if (!wallet) return setFormAlert('Cadastre uma carteira para continuar.')
    if (!connection) return setFormAlert('Escolha uma opção em "Carteira e rede" para conectar a carteira.')
    if (reason || !quote.data) return setFormAlert(reason ?? 'Aguarde o cálculo dos valores.')
    setProblem(null)
    setReview({ quote: quote.data, values })
  }, onInvalid)

  const submit = () => {
    if (!review || !wallet || liveChanged) return
    setProblem(null)
    const { values } = review
    placeOrder.mutate(
      {
        quoteId: review.quote.id,
        walletId: wallet.id,
        network: values.network,
        collector: {
          displayName: values.displayName,
          username: values.username,
          email: values.email,
          profileName: values.profileName,
          ensName: values.ensName,
          referralCode: values.referralCode,
          note: values.note,
        },
      },
      {
        onSuccess: (order) => {
          orderAttempt.clear(user.id)
          checkoutDraft.clear(user.id)
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
        },
        onError: (error) => {
          if (error.kind === 'timeout' || error.kind === 'network' || error.code === 'SERVICE_UNAVAILABLE') {
            return setProblem({
              kind: 'retry',
              message: 'Não recebemos a confirmação do pedido. Tentar novamente reenvia a mesma solicitação e não cria um pedido duplicado.',
            })
          }
          if (error.code === 'WALLET_NOT_CONNECTED') {
            // A conexão não existe mais no servidor (ex.: desconectada em outra aba): volta a pedir a conexão.
            setReview(null)
            setConnection(null)
            setProvider(null)
            return setWalletError(error.message)
          }
          const fresh = staleQuoteFrom(error)
          if (error.code === 'AVAILABILITY_CONFLICT') {
            if (fresh) setReview((r) => r && { ...r, quote: fresh })
            return setProblem({ kind: 'availability', message: error.message })
          }
          if (error.code === 'QUOTE_STALE' && fresh) {
            setReview((r) => r && { ...r, quote: fresh })
            const priceChanged = fresh.issues.some((i) => i.type === 'PRICE_CHANGED')
            return setProblem(
              priceChanged
                ? { kind: 'price', message: 'O preço de um ou mais itens mudou. Aceite os novos preços e confirme novamente.' }
                : { kind: 'changed', message: 'Os valores do pedido mudaram. Revise e confirme novamente.' },
            )
          }
          setProblem({ kind: 'error', message: error.message })
        },
      },
    )
  }

  const refreshReview = async () => {
    setProblem(null)
    const fresh = await quote.refetch()
    if (fresh.data && review) setReview({ ...review, quote: fresh.data })
  }
  const acceptPrices = () =>
    acknowledge.mutate(undefined, {
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: [...qk.private.scope(scope), 'quote'] })
        void refreshReview()
      },
    })

  const items = cart.data?.items ?? []
  const pendingOrder = pending.data?.items[0]

  const notices = (
    <>
      {pendingOrder && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-amber/50 bg-surface-raised p-4 text-sm text-amber">
          Você tem um pedido em processamento ({pendingOrder.number}).
          <Link to="/pedidos/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold underline">
            Acompanhar pedido
          </Link>
        </p>
      )}
      {reason && (
        <div role="status" className="flex flex-col gap-3 rounded-md border border-amber/50 bg-surface-raised p-4 text-sm text-amber">
          <p>{reason}</p>
          {items.some((i) => i.status === 'price_changed') ? (
            <Button type="button" variant="outline" size="cta" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
              Aceitar novos preços
            </Button>
          ) : (
            <Button asChild variant="outline" size="cta">
              <Link to="/carrinho">Revisar carrinho</Link>
            </Button>
          )}
        </div>
      )}
    </>
  )

  const providerOptions = (
    <ProviderOptions
      layout={isDesktop ? 'desktop' : 'mobile'}
      value={provider}
      connected={!!connection}
      connecting={connect.isPending}
      error={walletError}
      onSelect={selectProvider}
      onDisconnect={() => disconnect.mutate()}
    />
  )
  const alert = formAlert && (
    <p role="alert" className="flex items-center gap-1.5 text-sm text-coral">
      <AlertCircle aria-hidden className="size-4 shrink-0" />
      {formAlert}
    </p>
  )
  const confirm = (
    <Button
      type="submit"
      size="cta"
      className={isDesktop ? 'h-[45px] w-full rounded-lg text-[15px]' : 'h-[60px] w-full rounded-[40px] bg-linear-to-r from-brand-accent to-brand text-[15px]'}
      disabled={!!reason || !quote.data}
    >
      Confirmar compra
    </Button>
  )

  return (
    // overflow-anchor: none — erros que surgem acima da área visível não deslocam o botão sob o cursor
    <main id="conteudo" className="mx-auto w-full max-w-(--container-content) pb-10 [overflow-anchor:none] lg:pt-8">
      {cart.data && items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <h1 className="font-bold">Seu carrinho está vazio.</h1>
          <Button asChild size="cta">
            <Link to="/" hash="catalogo">
              Explorar o mercado
            </Link>
          </Button>
        </div>
      ) : isDesktop ? (
        <>
          <nav aria-label="Trilha de navegação" className="mb-10">
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
              <li aria-current="page">Pagamento</li>
            </ol>
          </nav>
          <h1 className="sr-only">Pagamento</h1>
          <form noValidate onSubmit={openReview} className="flex items-start justify-between gap-8">
            <section aria-labelledby="collector-title" className="w-[763px] shrink-0">
              <h2 id="collector-title" className="mb-3 text-[17px] leading-4 font-bold">
                Perfil do colecionador
              </h2>
              <CollectorFields form={form} wallet={wallet} hasSecondary={!!wallets.secondary} layout="desktop" />
            </section>
            <aside aria-label="Resumo do pedido" className="flex w-[405px] shrink-0 flex-col gap-3">
              <h2 className="text-[17px] leading-4 font-bold">Seus NFTs</h2>
              {quote.data ? (
                <>
                  <QuoteLines quote={quote.data} />
                  <p className="text-center text-sm">
                    Tem um código promocional?{' '}
                    <Link to="/carrinho" className="hover:text-brand-accent hover:underline">
                      Aplique aqui
                    </Link>
                  </p>
                  <div aria-live="polite" aria-busy={quote.isFetching}>
                    <QuoteTotals quote={quote.data} />
                  </div>
                </>
              ) : quote.isError ? (
                <div role="alert" className="flex flex-col items-start gap-3 text-sm">
                  <p>Não foi possível calcular os valores. {quote.error.message}</p>
                  <Button type="button" variant="outline" size="cta" onClick={() => void quote.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <QuoteSkeleton />
              )}
              {notices}
              <div className="mt-2">{providerOptions}</div>
              {alert}
              {confirm}
            </aside>
          </form>
        </>
      ) : (
        <form noValidate onSubmit={openReview} className="flex min-h-[calc(100dvh-3rem)] flex-col gap-4">
          {/* Figma "Mobile / Pagamento" */}
          <div className="relative flex h-11 items-center justify-center">
            <button
              type="button"
              onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: '/carrinho' }))}
              aria-label="Voltar"
              className="absolute left-0 grid size-[35px] place-items-center rounded-full bg-surface-raised"
            >
              <ChevronLeft aria-hidden className="size-5 text-brand" />
            </button>
            <h1 className="text-xl leading-4 font-bold">Pagamento com carteira</h1>
          </div>
          <WalletCards
            wallets={[wallets.primary, wallets.secondary].filter((w) => !!w)}
            value={walletSlot}
            onChange={(slot) => form.setValue('walletSlot', slot, { shouldDirty: true })}
          />
          {hasWallets && providerOptions}
          <p className="flex justify-end gap-7 text-base font-bold" aria-live="polite">
            <span>Total:</span>
            <span className="text-xl text-brand-accent" data-testid="checkout-total">
              {quote.data ? `${formatEth(quote.data.total)} ETH` : '…'}
            </span>
          </p>
          {notices}
          {alert}
          <div className="mt-auto pt-6">{confirm}</div>
          {/* Estado não desenhado no frame mobile: dados do colecionador (pré-preenchidos), recolhidos */}
          <details open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)} className="rounded-[14px] bg-surface-card p-4">
            <summary className="cursor-pointer text-base font-bold">Dados do colecionador</summary>
            <div className="mt-4">
              <CollectorFields form={form} wallet={wallet} hasSecondary={!!wallets.secondary} layout="mobile" />
            </div>
          </details>
        </form>
      )}

      {review && wallet && (
        <ReviewDialog
          open
          onOpenChange={(open) => !open && setReview(null)}
          quote={review.quote}
          wallet={wallet}
          network={review.values.network}
          collectorName={review.values.displayName}
          submitting={placeOrder.isPending}
          problem={shownProblem}
          onConfirm={submit}
          onRefresh={() => void refreshReview()}
          onAcceptPrices={acceptPrices}
          onReviewCart={() => void navigate({ to: '/carrinho' })}
        />
      )}
    </main>
  )
}
