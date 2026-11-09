import { Link } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, MoreVertical } from 'lucide-react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { NETWORK_LABELS, NETWORKS, WALLET_TYPE_LABELS, type Quote, type Wallet, type WalletType } from '@/api/contracts'
import WalletIcon from '@/assets/icons/curved-wallet.svg?react'
import { EnsField, FieldLabel, FormField, inputClass } from '@/components/form/form-field'
import { SelectField } from '@/components/form/select-field'
import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { shortAddress } from '@/features/wallets/queries'
import { formatDiscount, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import type { CheckoutFormInput, CheckoutFormValues } from '../checkout-form'
import { PROVIDERS, radioClass } from '../ui'

type Form = UseFormReturn<CheckoutFormInput, unknown, CheckoutFormValues>

/**
 * "Perfil do colecionador" (Figma "Desktop / Pagamento", coluna esquerda) — mesma disposição e obrigatórios do frame.
 * Endereço, carteira secundária e tipo vêm da carteira cadastrada (somente leitura, com o visual do layout).
 */
export function CollectorFields({ form, wallet, hasSecondary, layout }: { form: Form; wallet: Wallet | null; hasSecondary: boolean; layout: 'desktop' | 'mobile' }) {
  const { errors } = form.formState
  const usingSecondary = useWatch({ control: form.control, name: 'walletSlot' }) === 'secondary'
  return (
    <div className="flex flex-col gap-6">
      <div className={cn('grid gap-x-6 gap-y-5', layout === 'desktop' ? 'grid-cols-2' : 'grid-cols-1')}>
        <FormField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...form.register('displayName')} />
        <FormField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...form.register('username')} />
        <SelectField
          control={form.control}
          name="network"
          id={`checkout-network-${layout}`}
          label="Rede"
          placeholder="Selecione uma rede"
          options={NETWORKS}
          labels={NETWORK_LABELS}
          error={errors.network && 'Selecione uma rede'}
        />
        <FormField label="Nome do perfil" required error={errors.profileName?.message} {...form.register('profileName')} />
        <FormField label="Endereço da carteira" required readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" hint="Da carteira cadastrada." />
        <FormField
          label="ENS ou carteira secundária (opcional)"
          hideLabel
          readOnly
          value={wallet?.secondaryAddress ?? ''}
          placeholder="ENS ou carteira secundária (opcional)"
          className={layout === 'desktop' ? 'justify-end' : undefined}
        />
        <FormField label="Tipo de carteira" required readOnly value={wallet ? WALLET_TYPE_LABELS[wallet.walletType] : ''} placeholder="Selecione uma carteira" />
        <FormField label="Código de indicação" required error={errors.referralCode?.message} {...form.register('referralCode')} />
        <FormField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        <EnsField error={errors.ensName?.message} {...form.register('ensName')} />
      </div>

      {layout === 'desktop' && (
        <label className={cn('flex w-fit items-center gap-2 text-[15px]', !hasSecondary && 'cursor-not-allowed opacity-60')}>
          <input
            type="checkbox"
            className={radioClass}
            disabled={!hasSecondary}
            checked={usingSecondary}
            onChange={(e) => form.setValue('walletSlot', e.target.checked ? 'secondary' : 'primary', { shouldDirty: true })}
          />
          Usar outra carteira?
          {!hasSecondary && <span className="sr-only">(cadastre uma carteira secundária em Carteiras)</span>}
        </label>
      )}

      <div className="flex flex-col gap-2.5 lg:max-w-[350px]">
        <FieldLabel htmlFor={`checkout-note-${layout}`}>Observação do colecionador (opcional)</FieldLabel>
        <textarea
          id={`checkout-note-${layout}`}
          rows={6}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `checkout-note-${layout}-error` : undefined}
          className={cn(inputClass, 'h-[150px] resize-none py-2')}
          {...form.register('note')}
        />
        {errors.note && (
          <p id={`checkout-note-${layout}-error`} className="text-xs text-destructive">
            {errors.note.message}
          </p>
        )}
      </div>
    </div>
  )
}

/** "Seus NFTs": cabeçalho NFTs/Subtotal + linhas da cotação (Figma). */
export function QuoteLines({ quote, compact = false }: { quote: Quote; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex justify-between border-b border-brand/30 pb-3 text-base font-bold">
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul className="flex flex-col gap-3">
        {quote.lines.map((l) => (
          <li key={l.itemId} className="flex h-[70px] items-center gap-2 bg-surface-card pr-4 pl-1">
            <NftImage image={l.image} alt="" sizes="70px" className={cn('shrink-0 rounded-sm', compact ? 'size-14' : 'size-[62px]')} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{l.name}</p>
              <p className="truncate text-sm text-khaki">ID do token: {l.tokenId}</p>
            </div>
            <span className="text-sm text-sand">
              <span className="sr-only">Quantidade: </span>(x {l.quantity})
            </span>
            <span className="text-right text-lg font-bold whitespace-nowrap text-brand-accent">{formatEth(l.lineTotal)} ETH</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Totais do Figma: Subtotal, Desconto do lançamento, Taxa de rede, "Taxa estimada", Total. */
export function QuoteTotals({ quote }: { quote: Quote }) {
  return (
    <dl className="flex flex-col gap-3 text-[15px]">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg">{formatEth(quote.subtotal)} ETH</dd>
      </div>
      <div className="flex justify-between">
        <dt>Desconto do lançamento</dt>
        <dd>{formatDiscount(quote.discount)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Taxa de rede</dt>
        <dd className="text-lg">{formatEth(quote.networkFee)} ETH</dd>
      </div>
      <p className="text-center text-xs text-brand-accent">Taxa estimada</p>
      <div className="flex justify-between border-t border-brand/30 px-[42px] pt-3 font-bold">
        <dt className="text-base">Total</dt>
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

function ProviderIcon({ type }: { type: WalletType }) {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-raised text-sm font-bold text-brand">
      {type === 'coinbase' ? <WalletIcon className="size-5" /> : type === 'walletconnect' ? 'W' : 'M'}
    </span>
  )
}

/**
 * "Carteira e rede": escolha do provedor de conexão (Figma). Escolher uma opção conecta a carteira cadastrada (simulação);
 * a recusa e a desconexão aparecem logo abaixo.
 */
export function ProviderOptions({
  layout,
  value,
  connected,
  connecting,
  error,
  onSelect,
  onDisconnect,
}: {
  layout: 'desktop' | 'mobile'
  value: WalletType | null
  connected: boolean
  connecting: boolean
  error: string | null
  onSelect: (type: WalletType) => void
  onDisconnect: () => void
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className={cn('mb-4 font-bold', layout === 'desktop' ? 'w-full text-center text-[17px]' : 'text-base')}>Carteira e rede</legend>
      {PROVIDERS.map((type) => {
        const checked = value === type
        return (
          <label
            key={type}
            className={cn(
              'flex cursor-pointer items-center gap-3',
              layout === 'desktop'
                ? cn('h-[45px] rounded-[3px] border px-3', checked ? 'border-brand' : 'border-line')
                : 'h-[65px] flex-row-reverse justify-between rounded-[15px] bg-surface-card px-3.5 shadow-soft',
            )}
          >
            <input
              type="radio"
              name={`provider-${layout}`}
              value={type}
              checked={checked}
              disabled={connecting}
              onChange={() => onSelect(type)}
              aria-label={WALLET_TYPE_LABELS[type]}
              className={cn(radioClass, layout === 'mobile' && 'border-line-soft')}
            />
            {layout === 'desktop' ? (
              type === 'walletconnect' ? (
                <span aria-hidden className="rounded-xs border border-brand/40 bg-surface-dark px-2 py-1 text-[9px] font-bold tracking-[0.01em] text-brand">
                  METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
                </span>
              ) : (
                <span aria-hidden className="text-[15px]">
                  {WALLET_TYPE_LABELS[type]}
                </span>
              )
            ) : (
              <span aria-hidden className="flex flex-1 items-center gap-3">
                <ProviderIcon type={type} />
                <span className="text-sm">{WALLET_TYPE_LABELS[type]}</span>
              </span>
            )}
          </label>
        )
      })}
      <div role="status" className="min-h-5 text-sm">
        {connecting ? (
          <span className="text-sand">Conectando à carteira…</span>
        ) : connected && value ? (
          <span className="flex flex-wrap items-center gap-2 text-success">
            <CheckCircle2 aria-hidden className="size-4" /> Carteira conectada via {WALLET_TYPE_LABELS[value]}.
            <button type="button" onClick={onDisconnect} className="text-cream underline underline-offset-2 hover:text-brand-accent">
              Desconectar
            </button>
          </span>
        ) : null}
      </div>
      {error && (
        <p role="alert" className="-mt-2 flex items-center gap-1.5 text-sm text-coral">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Mobile: "Carteira conectada" — carteiras cadastradas (Figma "Wallet Card"). */
export function WalletCards({ wallets, value, onChange }: { wallets: Wallet[]; value: 'primary' | 'secondary'; onChange: (slot: 'primary' | 'secondary') => void }) {
  // Ordem do Figma: Reserva (secundária) primeiro, depois Principal
  const ordered = [...wallets].sort((a, b) => (a.slot === b.slot ? 0 : a.slot === 'secondary' ? -1 : 1))
  return (
    <section aria-labelledby="connected-wallet" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="connected-wallet" className="text-base font-bold">
          Carteira conectada
        </h2>
        <Link to="/carteiras" className="text-sm font-bold text-brand-accent">
          Trocar carteira
        </Link>
      </div>
      {wallets.length === 0 ? (
        <p className="rounded-[14px] bg-surface-card p-4 text-sm text-sand">
          Você ainda não cadastrou uma carteira.{' '}
          <Link to="/carteiras" className="font-bold text-brand-accent underline">
            Cadastrar carteira
          </Link>
        </p>
      ) : (
        <div role="radiogroup" aria-labelledby="connected-wallet" className="flex flex-col gap-5">
          {ordered.map((w) => (
            <div key={w.id} className="relative flex h-[93px] items-center gap-4 rounded-[14px] bg-surface-card px-5 shadow-soft">
              <input
                id={`wallet-${w.slot}`}
                type="radio"
                name="wallet-slot"
                className={radioClass}
                checked={value === w.slot}
                onChange={() => onChange(w.slot)}
              />
              <label htmlFor={`wallet-${w.slot}`} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1">
                <span className="text-base font-bold">{w.nickname}</span>
                <span className="text-sm leading-[22px] text-sand">
                  {w.slot === 'secondary' ? `${w.ensName}.eth` : shortAddress(w.address)}
                  <br />
                  {w.slot === 'primary' ? `Rede principal ${NETWORK_LABELS[w.network]}` : `Rede ${NETWORK_LABELS[w.network]}`}
                </span>
              </label>
              <Link to="/carteiras" aria-label={`Editar carteira ${w.nickname}`} className="grid size-8 place-items-center text-khaki">
                <MoreVertical aria-hidden className="size-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
