import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { NETWORK_LABELS, NETWORKS, WALLET_TYPE_LABELS, WALLET_TYPES, WalletInput, type Wallet, type WalletSlot } from '@/api/contracts'
import { FormAlert, FormField, inputClass } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountLayout } from '@/features/account/account-layout'
import { useSaveWallet } from '@/features/account/profile'
import { requireAuth } from '@/features/session/session'
import { useWallets } from '@/features/wallets/queries'
import { applyApiError } from '@/lib/use-api-form'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/carteiras')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: WalletsPage,
})

type WalletFormValues = {
  displayName: string
  nickname: string
  network: Wallet['network'] | ''
  address: string
  walletType: Wallet['walletType'] | ''
  ensName: string
}

const toValues = (w: Wallet | null | undefined): WalletFormValues => ({
  displayName: w?.displayName ?? '',
  nickname: w?.nickname ?? '',
  network: w?.network ?? '',
  address: w?.address ?? '',
  walletType: w?.walletType ?? '',
  ensName: w?.ensName ?? '',
})

function WalletsPage() {
  const wallets = useWallets()
  const [adding, setAdding] = useState<Record<WalletSlot, boolean>>({ primary: false, secondary: false })
  const [copyPrimary, setCopyPrimary] = useState(false)

  const primary = wallets.data?.primary ?? null
  const secondary = wallets.data?.secondary ?? null

  return (
    <AccountLayout>
      <h1 className="sr-only">Carteiras</h1>
      {wallets.isPending ? (
        <div aria-hidden className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : wallets.isError ? (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Não foi possível carregar suas carteiras.</p>
          <Button size="cta" onClick={() => void wallets.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <section aria-labelledby="primary-title" className="flex flex-col gap-5">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 id="primary-title" className="text-base font-bold">
                  Carteira principal
                </h2>
                <p className="text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
              </div>
              {!primary && !adding.primary && (
                <button type="button" className="font-bold text-brand-accent hover:underline" onClick={() => setAdding((a) => ({ ...a, primary: true }))}>
                  Adicionar
                </button>
              )}
            </header>
            {primary || adding.primary ? (
              <WalletForm slot="primary" wallet={primary} />
            ) : (
              <p className="text-sm text-sand">Você ainda não adicionou uma carteira principal.</p>
            )}
          </section>

          <section aria-labelledby="secondary-title" className="flex flex-col gap-5">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <h2 id="secondary-title" className="text-base font-bold">
                Carteira secundária
              </h2>
              <div className="flex items-center gap-4">
                <label className={cn('flex items-center gap-2 text-sm', !primary && 'opacity-50')}>
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    disabled={!primary}
                    checked={copyPrimary}
                    onChange={(e) => {
                      setCopyPrimary(e.target.checked)
                      if (e.target.checked) setAdding((a) => ({ ...a, secondary: true }))
                    }}
                  />
                  Igual à carteira principal
                </label>
                {!secondary && !adding.secondary && (
                  <button
                    type="button"
                    className="font-bold text-brand-accent hover:underline disabled:opacity-50"
                    disabled={!primary}
                    onClick={() => setAdding((a) => ({ ...a, secondary: true }))}
                  >
                    Adicionar
                  </button>
                )}
              </div>
            </header>
            {!primary && <p className="text-sm text-sand">Cadastre a carteira principal antes da secundária.</p>}
            {primary && (secondary || adding.secondary) ? (
              <WalletForm
                key={copyPrimary ? 'copy' : 'own'}
                slot="secondary"
                wallet={secondary}
                // "Igual à carteira principal": copia os dados, exceto o endereço (precisa ser outro)
                initial={copyPrimary && primary ? { ...toValues(primary), address: '' } : undefined}
              />
            ) : (
              primary && <p className="text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </section>
        </div>
      )}
    </AccountLayout>
  )
}

function WalletForm({ slot, wallet, initial }: { slot: WalletSlot; wallet: Wallet | null; initial?: WalletFormValues }) {
  const save = useSaveWallet()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<WalletFormValues, unknown, WalletInput>({
    // Os selects começam vazios ('') antes da escolha; o schema do contrato rejeita e o campo mostra o erro.
    resolver: zodResolver(WalletInput) as never,
    mode: 'onTouched',
    defaultValues: initial ?? toValues(wallet),
  })
  const { errors } = form.formState
  const id = (name: string) => `${slot}-${name}`

  const submit = form.handleSubmit((input) => {
    setAlert(null)
    save.mutate(
      { slot, input },
      {
        onSuccess: (wallets) => {
          form.reset(toValues(wallets[slot]))
          toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
        },
        onError: (e) => setAlert(applyApiError(e, form.setError, ['displayName', 'nickname', 'network', 'address', 'walletType', 'ensName'])),
      },
    )
  })

  const select = (name: 'network' | 'walletType', label: string, placeholder: string, options: readonly string[], labels: Record<string, string>) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id(name)} className="text-sm font-medium">
        {label}
        <span aria-hidden className="ml-0.5 text-coral">
          *
        </span>
      </label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger
              id={id(name)}
              aria-required
              aria-invalid={errors[name] ? true : undefined}
              aria-describedby={errors[name] ? id(`${name}-error`) : undefined}
              onBlur={field.onBlur}
              className={cn(inputClass, 'w-full justify-between')}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="border-line bg-surface-card">
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {labels[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {errors[name] && (
        <p id={id(`${name}-error`)} className="text-xs text-destructive">
          {name === 'network' ? 'Selecione uma rede' : 'Selecione o tipo de carteira'}
        </p>
      )}
    </div>
  )

  return (
    <form noValidate onSubmit={submit} aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} className="flex flex-col gap-5">
      {alert && <FormAlert>{alert}</FormAlert>}
      <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
        <FormField label="Nome de exibição" required error={errors.displayName?.message} {...form.register('displayName')} />
        <FormField label="Apelido da carteira (opcional)" error={errors.nickname?.message} {...form.register('nickname')} />
        {select('network', 'Rede', 'Selecione uma rede', NETWORKS, NETWORK_LABELS)}
        {select('walletType', 'Tipo de carteira', 'Selecione uma carteira', WALLET_TYPES, WALLET_TYPE_LABELS)}
        <FormField
          label="Endereço da carteira"
          required
          placeholder="Endereço 0x da carteira"
          autoComplete="off"
          spellCheck={false}
          error={errors.address?.message}
          {...form.register('address')}
        />
        <FormField label="Nome ENS (opcional)" suffix=".eth" placeholder="ENS ou carteira secundária (opcional)" error={errors.ensName?.message} {...form.register('ensName')} />
      </div>
      <Button type="submit" size="cta" className="w-[131px] px-0 text-sm" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}
