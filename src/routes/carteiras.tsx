import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { NETWORK_LABELS, NETWORKS, WALLET_TYPE_LABELS, WALLET_TYPES, WalletInput, type Wallet, type WalletSlot } from '@/api/contracts'
import { EnsField, FormAlert, FormField } from '@/components/form/form-field'
import { SelectField } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
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
  profileName: string
  address: string
  secondaryAddress: string
  walletType: Wallet['walletType'] | ''
  referralCode: string
  email: string
  ensName: string
}

const toValues = (w: Wallet | null | undefined): WalletFormValues => ({
  displayName: w?.displayName ?? '',
  nickname: w?.nickname ?? '',
  network: w?.network ?? '',
  profileName: w?.profileName ?? '',
  address: w?.address ?? '',
  secondaryAddress: w?.secondaryAddress ?? '',
  walletType: w?.walletType ?? '',
  referralCode: w?.referralCode ?? '',
  email: w?.email ?? '',
  ensName: w?.ensName ?? '',
})

const linkButton = 'text-base font-bold text-brand-accent hover:underline disabled:opacity-50'

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
        <div aria-hidden className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 8 }, (_, i) => (
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
          <section aria-labelledby="primary-title" className="flex flex-col gap-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 id="primary-title" className="text-lg leading-[18px] font-bold">
                  Carteira principal
                </h2>
                <p className="mt-1.5 text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
              </div>
              {!primary && (
                <button type="button" className={linkButton} onClick={() => setAdding((a) => ({ ...a, primary: true }))}>
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

          <section aria-labelledby="secondary-title" className="flex flex-col gap-2">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <h2 id="secondary-title" className="text-lg font-bold">
                Carteira secundária
              </h2>
              <div className="flex items-center gap-2">
                <label className={cn('flex cursor-pointer items-center gap-2 text-sm', !primary && 'cursor-not-allowed opacity-50')}>
                  <input
                    type="checkbox"
                    disabled={!primary}
                    checked={copyPrimary}
                    onChange={(e) => {
                      setCopyPrimary(e.target.checked)
                      if (e.target.checked) setAdding((a) => ({ ...a, secondary: true }))
                    }}
                    // Rádio redondo do Figma ("◯ Igual à carteira principal")
                    className="grid size-4 appearance-none place-content-center rounded-full border border-brand before:size-2 before:scale-0 before:rounded-full before:bg-brand before:content-[''] checked:before:scale-100"
                  />
                  Igual à carteira principal
                </label>
                {!secondary && (
                  <button type="button" className={linkButton} disabled={!primary} onClick={() => setAdding((a) => ({ ...a, secondary: true }))}>
                    Adicionar
                  </button>
                )}
              </div>
            </header>
            {!primary ? (
              <p className="text-sm text-sand">Cadastre a carteira principal antes da secundária.</p>
            ) : secondary || adding.secondary ? (
              <div className="mt-4">
                <WalletForm
                  key={copyPrimary ? 'copy' : 'own'}
                  slot="secondary"
                  wallet={secondary}
                  // "Igual à carteira principal": copia os dados, exceto o endereço (precisa ser outro)
                  initial={copyPrimary ? { ...toValues(primary), address: '' } : undefined}
                />
              </div>
            ) : (
              <p className="text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </section>
        </div>
      )}
    </AccountLayout>
  )
}

const FIELDS = ['displayName', 'nickname', 'network', 'profileName', 'address', 'secondaryAddress', 'walletType', 'referralCode', 'email', 'ensName'] as const

function WalletForm({ slot, wallet, initial }: { slot: WalletSlot; wallet: Wallet | null; initial?: WalletFormValues }) {
  const save = useSaveWallet()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<WalletFormValues, unknown, WalletInput>({
    // Os selects começam vazios ('') antes da escolha; o schema do contrato rejeita e o campo mostra o erro.
    resolver: zodResolver(WalletInput) as never,
    mode: 'onSubmit',
    defaultValues: initial ?? toValues(wallet),
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((input) => {
    setAlert(null)
    save.mutate(
      { slot, input },
      {
        onSuccess: (wallets) => {
          form.reset(toValues(wallets[slot]))
          toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
        },
        onError: (e) => setAlert(applyApiError(e, form.setError, FIELDS)),
      },
    )
  })

  return (
    <form noValidate onSubmit={submit} aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} className="flex flex-col gap-8">
      {alert && <FormAlert>{alert}</FormAlert>}
      <div className="grid grid-cols-1 gap-x-7 gap-y-5 lg:grid-cols-2">
        <FormField label="Nome de exibição" required error={errors.displayName?.message} {...form.register('displayName')} />
        <FormField label="Apelido da carteira" required error={errors.nickname?.message} {...form.register('nickname')} />
        <SelectField
          control={form.control}
          name="network"
          id={`${slot}-network`}
          label="Rede"
          placeholder="Selecione uma rede"
          options={NETWORKS}
          labels={NETWORK_LABELS}
          error={errors.network && 'Selecione uma rede'}
        />
        <FormField label="Nome do perfil" required error={errors.profileName?.message} {...form.register('profileName')} />
        <FormField
          label="Endereço da carteira"
          required
          placeholder="Endereço 0x da carteira"
          autoComplete="off"
          spellCheck={false}
          error={errors.address?.message}
          {...form.register('address')}
        />
        {/* Figma: campo sem rótulo visível, alinhado ao endereço */}
        <FormField
          label="ENS ou carteira secundária (opcional)"
          hideLabel
          placeholder="ENS ou carteira secundária (opcional)"
          className="lg:justify-end"
          error={errors.secondaryAddress?.message}
          {...form.register('secondaryAddress')}
        />
        <SelectField
          control={form.control}
          name="walletType"
          id={`${slot}-wallet-type`}
          label="Tipo de carteira"
          placeholder="Selecione uma carteira"
          options={WALLET_TYPES}
          labels={WALLET_TYPE_LABELS}
          error={errors.walletType && 'Selecione o tipo de carteira'}
        />
        <FormField label="Código de indicação" required error={errors.referralCode?.message} {...form.register('referralCode')} />
        <FormField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        <EnsField error={errors.ensName?.message} {...form.register('ensName')} />
      </div>
      <Button type="submit" size="cta" className="w-[131px] px-0 text-sm" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}
