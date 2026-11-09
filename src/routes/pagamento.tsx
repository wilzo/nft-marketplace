import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import type { Quote, WalletConnection } from '@/api/contracts'
import { walletsApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { blockingReason, sameQuoteValues } from '@/features/cart/checkout-rules'
import { useAcknowledgePrices } from '@/features/cart/mutations'
import { useCart, useQuote } from '@/features/cart/queries'
import { CheckoutForm, type CheckoutFormInput, type CheckoutFormValues } from '@/features/checkout/checkout-form'
import { CollectorFields, QuoteLines, QuoteSkeleton, QuoteTotals, WalletConnectionPanel } from '@/features/checkout/components/checkout-panels'
import { ReviewDialog, type ReviewProblem } from '@/features/checkout/components/review-dialog'
import { checkoutDraft, orderAttempt } from '@/features/checkout/storage'
import { staleQuoteFrom, usePlaceOrder } from '@/features/checkout/use-place-order'
import { usePendingOrders } from '@/features/orders/queries'
import { requireAuth } from '@/features/session/session'
import { useCurrentUser, useViewerScope } from '@/features/session/use-viewer'
import { useWallets } from '@/features/wallets/queries'
import type { ApiError } from '@/lib/api-error'
import { qk } from '@/lib/query-keys'

export const Route = createFileRoute('/pagamento')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: CheckoutPage,
})

function CheckoutPage() {
  const user = useCurrentUser()!
  const scope = useViewerScope()
  const client = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const wallets = useWallets()
  const cart = useCart(scope)
  const pending = usePendingOrders()
  const acknowledge = useAcknowledgePrices()
  const placeOrder = usePlaceOrder()

  // Formulário: rascunho da sessão (retomada após expiração/refresh) ou dados do perfil.
  const defaults = useMemo<CheckoutFormInput>(
    () =>
      checkoutDraft.get<CheckoutFormInput>(user.id) ?? {
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        profileName: user.walletNickname ?? user.displayName,
        ensName: user.ensName ?? '',
        referralCode: '',
        note: '',
        network: 'ethereum',
        useSecondary: false,
      },
    [user],
  )
  const form = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({ resolver: zodResolver(CheckoutForm), mode: 'onTouched', defaultValues: defaults })
  // Persiste o rascunho a cada alteração (retomada após expiração da sessão ou refresh).
  useEffect(
    () => form.subscribe({ formState: { values: true }, callback: ({ values }) => checkoutDraft.set(user.id, values) }),
    [form, user.id],
  )

  const [useSecondary, network] = useWatch({ control: form.control, name: ['useSecondary', 'network'] })
  const wallet = (useSecondary ? wallets.data?.secondary : wallets.data?.primary) ?? null
  const quote = useQuote(scope, cart.data, network)

  // Conexão simulada com a carteira; trocar carteira ou rede exige reconectar.
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const connectKey = `${wallet?.id}:${network}`
  const [connectedFor, setConnectedFor] = useState(connectKey)
  if (connectedFor !== connectKey) {
    setConnectedFor(connectKey)
    setConnection(null)
  }
  const connect = useMutation({
    mutationFn: () => walletsApi.connect(wallet!.id, network),
    onMutate: () => setWalletError(null),
    onSuccess: setConnection,
    onError: (error: ApiError) => setWalletError(error.message),
  })
  const disconnect = useMutation({
    mutationFn: () => walletsApi.disconnect(connection!.id),
    onSettled: () => setConnection(null),
  })

  // Revisão: cotação congelada no momento da revisão; mudanças posteriores exigem nova confirmação.
  const [review, setReview] = useState<{ quote: Quote; values: CheckoutFormValues } | null>(null)
  const [problem, setProblem] = useState<ReviewProblem | null>(null)
  const liveChanged = !!review && !!quote.data && !quote.isPlaceholderData && !sameQuoteValues(review.quote, quote.data)
  const shownProblem: ReviewProblem | null =
    problem ?? (liveChanged ? { kind: 'changed', message: 'Os valores mudaram desde a revisão (preço, disponibilidade ou taxas). Revise antes de confirmar.' } : null)

  const reason = cart.data ? blockingReason(cart.data, quote.data) : null
  const [formAlert, setFormAlert] = useState<string | null>(null)

  const openReview = form.handleSubmit((values) => {
    setFormAlert(null)
    if (!wallet) return setFormAlert('Cadastre uma carteira para continuar.')
    if (!connection) return setFormAlert('Conecte a carteira para continuar.')
    if (reason || !quote.data) return setFormAlert(reason ?? 'Aguarde o cálculo dos valores.')
    setProblem(null)
    setReview({ quote: quote.data, values })
  })

  const submit = () => {
    if (!review || !wallet) return
    if (liveChanged) return
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
        // Carrinho confirmado com os novos preços → nova cotação → nova revisão.
        await client.invalidateQueries({ queryKey: [...qk.private.scope(scope), 'quote'] })
        void refreshReview()
      },
    })

  const items = cart.data?.items ?? []
  const pendingOrder = pending.data?.items[0]

  return (
    <main id="conteudo" className="mx-auto w-full max-w-(--container-content) pb-10 lg:pt-8">
      <div className="relative mb-6 flex items-center justify-center lg:hidden">
        <button
          type="button"
          onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: '/carrinho' }))}
          aria-label="Voltar"
          className="absolute left-0 grid size-9 place-items-center rounded-full border border-line bg-surface-card"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <h1 className="text-xl font-bold">Pagamento com carteira</h1>
      </div>
      <nav aria-label="Trilha de navegação" className="mb-8 hidden lg:block">
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
      <h1 className="sr-only max-lg:hidden">Pagamento</h1>

      {pendingOrder && (
        <p role="status" className="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-amber/50 bg-surface-raised p-4 text-sm text-amber">
          Você tem um pedido em processamento ({pendingOrder.number}).
          <Link to="/pedidos/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold underline">
            Acompanhar pedido
          </Link>
        </p>
      )}

      {cart.data && items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Seu carrinho está vazio.</p>
          <Button asChild size="cta">
            <Link to="/" hash="catalogo">
              Explorar o mercado
            </Link>
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={openReview} className="grid gap-10 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between lg:gap-x-8">
          {/* Mobile: resumo → formulário → carteira e confirmação. Desktop: formulário à esquerda, resumo e carteira à direita (Figma). */}
          <div className="max-lg:order-2 lg:row-span-2">
            <CollectorFields form={form} wallet={wallet} hasSecondary={!!wallets.data?.secondary} />
          </div>

          <aside aria-label="Resumo do pedido" className="flex flex-col gap-6 max-lg:order-1">
            <section aria-labelledby="your-nfts" className="flex flex-col gap-4">
              <h2 id="your-nfts" className="text-lg font-bold">
                Seus NFTs
              </h2>
              {quote.data ? (
                <>
                  <QuoteLines quote={quote.data} />
                  <p className="text-center text-sm">
                    Tem um código promocional?{' '}
                    <Link to="/carrinho" className="text-brand-accent underline-offset-4 hover:underline">
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
            </section>

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

          </aside>

          <div className="flex flex-col gap-6 max-lg:order-3 lg:col-start-2">
            <WalletConnectionPanel
              wallet={wallet}
              network={network}
              connection={connection}
              connecting={connect.isPending}
              error={walletError}
              onConnect={() => connect.mutate()}
              onDisconnect={() => disconnect.mutate()}
            />

            {formAlert && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-coral">
                <AlertCircle aria-hidden className="size-4 shrink-0" />
                {formAlert}
              </p>
            )}
            <Button type="submit" size="cta" className="h-[60px] rounded-full text-base lg:h-[45px] lg:rounded-md" disabled={!!reason || !quote.data}>
              Confirmar compra
            </Button>
          </div>
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

