import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ChangePasswordInput, ProfileInput, type User } from '@/api/contracts'
import ImageIcon from '@/assets/icons/curved-image-2.svg?react'
import { FormAlert, FormField, PasswordField } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountLayout } from '@/features/account/account-layout'
import { prepareAvatar, useChangePassword, useProfile, useRemoveAvatar, useSetAvatar, useUpdateProfile } from '@/features/account/profile'
import { requireAuth } from '@/features/session/session'
import { applyApiError } from '@/lib/use-api-form'

export const Route = createFileRoute('/perfil')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: ProfilePage,
})

function ProfilePage() {
  const profile = useProfile()
  return (
    <AccountLayout>
      <h1 className="mb-6 text-base font-bold">Perfil do colecionador</h1>
      {profile.isPending ? (
        <div aria-hidden className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : profile.isError ? (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface-card p-6">
          <p className="font-bold">Não foi possível carregar seu perfil.</p>
          <Button size="cta" onClick={() => void profile.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          <ProfileForm user={profile.data} />
          <PasswordForm />
        </div>
      )}
    </AccountLayout>
  )
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [alert, setAlert] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const form = useForm<ProfileInput>({
    resolver: zodResolver(ProfileInput),
    mode: 'onTouched',
    values: {
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? '',
      walletNickname: user.walletNickname ?? '',
    },
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setAlert(null)
    setSaved(false)
    update.mutate(values, {
      onSuccess: () => {
        setSaved(true)
        toast.success('Dados do perfil salvos.')
      },
      onError: (e) => setAlert(applyApiError(e, form.setError, ['displayName', 'username', 'email', 'ensName', 'walletNickname'])),
    })
  })

  return (
    <form noValidate onSubmit={submit} aria-labelledby="profile-data" className="flex flex-col gap-5">
      <h2 id="profile-data" className="sr-only">
        Dados do perfil
      </h2>
      {alert && <FormAlert>{alert}</FormAlert>}
      <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
        <FormField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...form.register('displayName')} />
        <FormField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...form.register('username')} />
        <FormField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        <FormField label="Nome ENS (opcional)" suffix=".eth" error={errors.ensName?.message} {...form.register('ensName')} />
        <FormField label="Apelido da carteira (opcional)" error={errors.walletNickname?.message} {...form.register('walletNickname')} />
        <AvatarField user={user} />
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" size="cta" className="w-[131px] text-sm" disabled={update.isPending}>
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
        {saved && !form.formState.isDirty && (
          <p role="status" className="text-sm text-success">
            Dados salvos.
          </p>
        )}
      </div>
    </form>
  )
}

function AvatarField({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null)
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()
  const [error, setError] = useState<string | null>(null)
  const busy = setAvatar.isPending || removeAvatar.isPending

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const prepared = await prepareAvatar(file)
    if (!prepared.ok) return setError(prepared.error)
    setAvatar.mutate(prepared.dataUrl, {
      onSuccess: () => toast.success('Avatar atualizado.'),
      onError: (e) => setError(e.fieldError('dataUrl') ?? e.message),
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id="avatar-label" className="text-sm font-medium">
        Avatar
      </span>
      <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="Seu avatar" className="size-[50px] rounded-full border border-line object-cover" />
        ) : (
          <span className="grid size-[50px] place-items-center rounded-full border border-line bg-surface-raised text-cream" aria-label="Sem avatar" role="img">
            <ImageIcon aria-hidden className="size-6" />
          </span>
        )}
        <input
          ref={input}
          id="avatar-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button type="button" size="cta" className="w-[98px] px-0 text-sm" disabled={busy} onClick={() => input.current?.click()}>
          {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <button
          type="button"
          className="text-sm text-cream hover:text-coral disabled:opacity-40"
          disabled={!user.avatarUrl || busy}
          onClick={() => removeAvatar.mutate(undefined, { onSuccess: () => toast.success('Avatar removido.') })}
        >
          Remover
        </button>
      </div>
      {error ? (
        <p id="avatar-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id="avatar-hint" className="text-xs text-sand">
          PNG, JPEG ou WebP, até 2 MB.
        </p>
      )}
    </div>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const [alert, setAlert] = useState<string | null>(null)
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordInput),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setAlert(null)
    change.mutate(values, {
      onSuccess: () => {
        form.reset()
        toast.success('Senha alterada com sucesso.')
      },
      onError: (e) => setAlert(applyApiError(e, form.setError, ['currentPassword', 'newPassword', 'confirmPassword'])),
    })
  })

  return (
    <form noValidate onSubmit={submit} aria-labelledby="password-title" className="flex flex-col gap-5 lg:max-w-[417px]">
      <h2 id="password-title" className="text-base font-bold">
        Alterar senha
      </h2>
      {alert && <FormAlert>{alert}</FormAlert>}
      <PasswordField label="Senha atual" autoComplete="current-password" error={errors.currentPassword?.message} {...form.register('currentPassword')} />
      <PasswordField label="Nova senha" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.newPassword?.message} {...form.register('newPassword')} />
      <PasswordField label="Confirmar nova senha" autoComplete="new-password" error={errors.confirmPassword?.message} {...form.register('confirmPassword')} />
      <Button type="submit" size="cta" className="w-[160px] text-sm" disabled={change.isPending}>
        {change.isPending ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}
