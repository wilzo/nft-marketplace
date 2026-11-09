import { Link } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { NETWORK_LABELS, NETWORKS, WALLET_TYPE_LABELS, type Quote, type Wallet, type WalletConnection } from '@/api/contracts'
import { FormField, inputClass } from '@/components/form/form-field'
import { NftImage } from '@/components/nft-image'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { shortAddress } from '@/features/wallets/queries'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import type { CheckoutFormInput, CheckoutFormValues } from '../checkout-form'

type Form = UseFormReturn<CheckoutFormInput, unknown, CheckoutFormValues>

/** Avatar do tipo de carteira (Figma mobile: círculo com inicial). */
export function WalletBadge({ type }: { type: Wallet['walletType'] }) {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-raised text-sm font-bold text-brand">
      {WALLET_TYPE_LABELS[type][0]}
    </span>
  )
}

/** "Perfil do colecionador" (Figma "Desktop / Pagamento", coluna esquerda). */
export function CollectorFields({ form, wallet, hasSecondary }: { form: Form; wallet: Wallet | null; hasSecondary: boolean }) {
  const { errors } = form.formState
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-5 text-lg font-bold">Perfil do colecionador</legend>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <FormField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...form.register('displayName')} />
        <FormField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...form.register('username')} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkout-network" className="text-sm font-medium">
            Rede<span aria-hidden className="ml-0.5 text-coral">*</span>
          </label>
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="checkout-network" aria-required className={cn(inputClass, 'w-full justify-between')}>
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent className="border-line bg-surface-card">
                  {NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NETWORK_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <FormField label="Nome do perfil" required error={errors.profileName?.message} {...form.register('profileName')} />

        {/* Dados da carteira cadastrada selecionada (somente leitura: editados em "Carteiras") */}
        <FormField label="Endereço da carteira" required readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" hint="Da carteira cadastrada." />
        <FormField label="ENS ou carteira secundária (opcional)" readOnly value={wallet?.ensName ? `${wallet.ensName}.eth` : ''} placeholder="ENS ou carteira secundária (opcional)" />
        <FormField label="Tipo de carteira" required readOnly value={wallet ? WALLET_TYPE_LABELS[wallet.walletType] : ''} placeholder="Selecione uma carteira" />
        <FormField label="Código de indicação (opcional)" error={errors.referralCode?.message} {...form.register('referralCode')} />
        <FormField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        <FormField label="Nome ENS (opcional)" suffix=".eth" error={errors.ensName?.message} {...form.register('ensName')} />
      </div>

      <label className={cn('flex w-fit items-center gap-2 text-[15px]', !hasSecondary && 'opacity-60')}>
        <input type="checkbox" className="size-4 accent-brand" disabled={!hasSecondary} {...form.register('useSecondary')} />
        Usar outra carteira?
        {!hasSecondary && (
          <span className="text-xs text-sand">
            (cadastre uma{' '}
            <Link to="/carteiras" className="underline">
              carteira secundária
            </Link>
            )
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1.5 sm:max-w-[350px]">
        <label htmlFor="checkout-note" className="text-sm font-medium">
          Observação do colecionador (opcional)
        </label>
        <textarea
          id="checkout-note"
          rows={6}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? 'checkout-note-error' : undefined}
          className={cn(inputClass, 'h-auto py-2')}
          {...form.register('note')}
        />
        {errors.note && (
          <p id="checkout-note-error" className="text-xs text-destructive">
            {errors.note.message}
          </p>
        )}
      </div>
    </fieldset>
  )
}

/** Linhas da cotação ("Seus NFTs") + totais — sempre da API. */
export function QuoteLines({ quote, compact = false }: { quote: Quote; compact?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {quote.lines.map((l) => (
        <li key={l.itemId} className="flex items-center gap-3 bg-surface-card pr-3">
          <NftImage image={l.image} alt="" sizes="70px" className={compact ? 'size-14' : 'size-[70px]'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{l.name}</p>
            <p className="text-sm text-khaki">
              ID do token: {l.tokenId} · {l.editionLabel}
            </p>
          </div>
          <span className="text-sm text-sand">(x {l.quantity})</span>
          <span className="w-24 text-right text-base font-bold text-brand-accent">{formatEth(l.lineTotal)} ETH</span>
        </li>
      ))}
    </ul>
  )
}

export function QuoteTotals({ quote }: { quote: Quote }) {
  return (
    <dl className="flex flex-col gap-3">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd>{formatEth(quote.subtotal)} ETH</dd>
      </div>
      <div className="flex justify-between">
        <dt>{quote.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto do lançamento'}</dt>
        <dd>(-) {formatEth(quote.discount)} ETH</dd>
      </div>
      <div className="flex justify-between">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          {formatEth(quote.networkFee)} ETH
          <span className="block text-xs text-brand-accent">Taxa estimada</span>
        </dd>
      </div>
      <div className="mt-2 flex justify-between border-t border-brand/30 pt-3 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-brand-accent" data-testid="checkout-total">
          {formatEth(quote.total)} ETH
        </dd>
      </div>
    </dl>
  )
}

export function QuoteSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3" data-testid="checkout-skeleton">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[70px] w-full" />
      ))}
      <Skeleton className="mt-2 h-28 w-full" />
    </div>
  )
}

/** "Carteira e rede": carteira cadastrada selecionada + conexão simulada (conectar, recusa, desconectar). */
export function WalletConnectionPanel({
  wallet,
  network,
  connection,
  connecting,
  error,
  onConnect,
  onDisconnect,
}: {
  wallet: Wallet | null
  network: CheckoutFormValues['network']
  connection: WalletConnection | null
  connecting: boolean
  error: string | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  return (
    <section aria-labelledby="wallet-title" className="flex flex-col gap-3">
      <h2 id="wallet-title" className="text-center text-lg font-bold lg:text-base">
        Carteira e rede
      </h2>
      {!wallet ? (
        <p className="rounded-md border border-line p-4 text-sm text-sand">
          Você ainda não cadastrou uma carteira.{' '}
          <Link to="/carteiras" className="font-bold text-brand-accent underline">
            Cadastrar carteira
          </Link>
        </p>
      ) : (
        <div className={cn('flex items-center gap-3 rounded-md border p-4', connection ? 'border-success/70' : 'border-line')}>
          <WalletBadge type={wallet.walletType} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {wallet.nickname ?? (wallet.slot === 'primary' ? 'Principal' : 'Secundária')} · {WALLET_TYPE_LABELS[wallet.walletType]}
            </p>
            <p className="text-sm break-words text-sand">
              {wallet.ensName ? `${wallet.ensName}.eth` : shortAddress(wallet.address)} · Rede {NETWORK_LABELS[network]}
            </p>
            <p className={cn('mt-1 flex items-center gap-1 text-xs', connection ? 'text-success' : 'text-khaki')} role="status">
              {connection ? (
                <>
                  <CheckCircle2 aria-hidden className="size-3.5" /> Conectada
                </>
              ) : (
                'Não conectada'
              )}
            </p>
          </div>
          {connection ? (
            <Button variant="outline" size="sm" onClick={onDisconnect}>
              Desconectar
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect} disabled={connecting}>
              {connecting ? 'Conectando…' : 'Conectar'}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-coral">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </section>
  )
}
