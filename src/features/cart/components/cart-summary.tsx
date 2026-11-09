import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, X } from 'lucide-react'
import type { Cart, Quote } from '@/api/contracts'
import { blockingReason } from '../checkout-rules'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/session/use-viewer'
import type { ApiError } from '@/lib/api-error'
import { formatDiscount, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from '../mutations'

function CouponForm({ cart }: { cart: Cart }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (cart.couponCode) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm">
        <span>
          Cupom <strong className="text-brand-accent">{cart.couponCode}</strong> aplicado
        </span>
        <button
          type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="flex items-center gap-1 text-khaki hover:text-coral"
          aria-label={`Remover cupom ${cart.couponCode}`}
        >
          <X aria-hidden className="size-4" /> Remover
        </button>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!code.trim()) return setError('Informe o código promocional')
        setError(null)
        apply.mutate(code.trim(), {
          onSuccess: () => setCode(''),
          onError: (err: ApiError) => setError(err.fieldError('code') ?? err.message),
        })
      }}
    >
      <label htmlFor="coupon" className="mb-3 block text-sm font-bold">
        Código promocional
      </label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          autoCapitalize="characters"
          className="h-10 min-w-0 flex-1 rounded-l-[5px] rounded-r-none border border-line bg-transparent px-3 text-xs text-cream uppercase placeholder:text-khaki placeholder:normal-case focus-visible:border-brand focus-visible:outline-none aria-invalid:border-error max-lg:h-12 max-lg:rounded-l-full max-lg:px-5"
        />
        <Button type="submit" disabled={apply.isPending} className="h-10 w-[100px] rounded-l-none rounded-r-[5px] text-sm max-lg:h-12 max-lg:rounded-r-full">
          {apply.isPending ? '…' : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle aria-hidden className="size-3.5" />
          {error}
        </p>
      )}
    </form>
  )
}

function Row({ label, value, note, strong }: { label: string; value: React.ReactNode; note?: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', strong && 'mt-4')}>
      <dt className={cn('text-[15px]', strong && 'font-bold')}>{label}</dt>
      <dd className="text-right">
        <span className={cn('text-base', strong ? 'text-lg font-bold text-brand-accent' : 'text-cream')}>{value}</span>
        {note && <span className="block text-xs text-brand-accent">{note}</span>}
      </dd>
    </div>
  )
}

/** "Resumo da carteira": cupom + valores da cotação da API + finalizar. */
export function CartSummary({
  cart,
  quote,
  quotePending,
  quoteRefreshing,
  quoteError,
  onRetryQuote,
}: {
  cart: Cart
  quote: Quote | undefined
  quotePending: boolean
  quoteRefreshing: boolean
  quoteError: ApiError | null
  onRetryQuote: () => void
}) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const reason = blockingReason(cart, quote)
  const canCheckout = !!quote && !reason && !quoteRefreshing

  const checkout = () => {
    if (!user) void navigate({ to: '/entrar', search: { redirect: '/pagamento' } })
    else void navigate({ to: '/pagamento' })
  }

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-6 rounded-t-[28px] bg-surface-card p-6 lg:rounded-none lg:bg-transparent lg:p-0">
      <h2 id="summary-title" className="hidden border-b border-brand/30 pb-3 text-lg font-bold lg:block">
        Resumo da carteira
      </h2>
      <CouponForm cart={cart} />

      <div aria-busy={quotePending || quoteRefreshing} aria-live="polite">
        {quotePending ? (
          <div data-testid="summary-skeleton" className="flex flex-col gap-4" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
            <div className="mt-4 flex justify-between">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
        ) : quoteError && !quote ? (
          <div role="alert" className="flex flex-col items-start gap-3 text-sm">
            <p>Não foi possível calcular o resumo. {quoteError.message}</p>
            <Button size="cta" variant="outline" onClick={onRetryQuote}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          quote && (
            <dl className={cn('flex flex-col gap-3 transition-opacity', quoteRefreshing && 'opacity-60')}>
              <Row label="Subtotal" value={`${formatEth(quote.subtotal)} ETH`} />
              <Row label="Desconto do lançamento" value={formatDiscount(quote.discount)} />
              <Row label="Taxa de rede" value={`${formatEth(quote.networkFee)} ETH`} note="Taxa estimada" />
              <Row label="Total" value={`${formatEth(quote.total)} ETH`} strong />
            </dl>
          )
        )}
        {quoteRefreshing && <p className="mt-2 text-xs text-sand">Atualizando valores…</p>}
      </div>

      <div className="flex flex-col items-stretch gap-4">
        <Button
          size="cta"
          className="h-[60px] rounded-full text-base lg:h-10 lg:rounded-md lg:text-sm"
          disabled={!canCheckout}
          aria-describedby={reason ? 'checkout-blocked' : undefined}
          onClick={checkout}
        >
          Conectar e finalizar
        </Button>
        {reason && (
          <p id="checkout-blocked" className="flex items-center gap-1.5 text-sm text-amber">
            <AlertCircle aria-hidden className="size-4" />
            {reason}
          </p>
        )}
        <Link to="/" hash="catalogo" className="hidden text-center text-[15px] text-brand-accent hover:underline lg:block">
          Continuar explorando
        </Link>
      </div>
    </section>
  )
}
