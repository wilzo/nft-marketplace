import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ChangePasswordInput, ProfileInput, type User } from '@/api/contracts'
import ImageIcon from '@/assets/icons/curved-image-2.svg?react'
import { EnsField, FieldLabel, FormAlert, FormField, PasswordField } from '@/components/form/form-field'
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
        <div aria-hidden className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        <ProfileForms user={profile.data} />
      )}
    </AccountLayout>
  )
}

const PROFILE_FIELDS = ['displayName', 'username', 'email', 'ensName', 'walletNickname'] as const
const PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

/**
 * Frame "Perfil do colecionador": dados + avatar + "Alterar senha" com um único "Salvar".
 * O Salvar grava os dados e, se algum campo de senha foi preenchido, também altera a senha.
 */
function ProfileForms({ user }: { user: User }) {
  const update = useUpdateProfile()
  const change = useChangePassword()
  const [alert, setAlert] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(ProfileInput),
    mode: 'onSubmit',
    values: {
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? '',
      walletNickname: user.walletNickname ?? '',
    },
    resetOptions: { keepDirtyValues: true },
  })
  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordInput),
    mode: 'onSubmit',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const pe = profileForm.formState.errors
  const we = passwordForm.formState.errors
  const busy = update.isPending || change.isPending

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setAlert(null)
    setSaved(null)
    const pw = passwordForm.getValues()
    const wantsPassword = PASSWORD_FIELDS.some((k) => pw[k])
    const profileOk = await profileForm.trigger(undefined, { shouldFocus: true })
    const passwordOk = wantsPassword ? await passwordForm.trigger(undefined, { shouldFocus: profileOk }) : true
    if (!profileOk || !passwordOk) return

    try {
      await update.mutateAsync(ProfileInput.parse(profileForm.getValues()))
    } catch (err) {
      return setAlert(applyApiError(err, profileForm.setError, PROFILE_FIELDS))
    }
    if (wantsPassword) {
      try {
        await change.mutateAsync(ChangePasswordInput.parse(pw))
        passwordForm.reset()
      } catch (err) {
        return setAlert(applyApiError(err, passwordForm.setError, PASSWORD_FIELDS))
      }
    }
    const message = wantsPassword ? 'Dados salvos e senha alterada.' : 'Dados salvos.'
    setSaved(message)
    toast.success(message)
  }

  return (
    <form noValidate onSubmit={(e) => void save(e)} aria-label="Perfil do colecionador" className="flex flex-col gap-10">
      {alert && <FormAlert>{alert}</FormAlert>}
      <div className="grid grid-cols-1 gap-x-7 gap-y-6 lg:grid-cols-2">
        <FormField label="Nome de exibição" required autoComplete="name" error={pe.displayName?.message} {...profileForm.register('displayName')} />
        <FormField label="Nome de usuário" required autoComplete="username" error={pe.username?.message} {...profileForm.register('username')} />
        <FormField label="E-mail" required type="email" autoComplete="email" error={pe.email?.message} {...profileForm.register('email')} />
        <EnsField error={pe.ensName?.message} {...profileForm.register('ensName')} />
        <FormField label="Apelido da carteira" required error={pe.walletNickname?.message} {...profileForm.register('walletNickname')} />
        <AvatarField user={user} />
      </div>

      <fieldset className="flex flex-col gap-5 lg:max-w-[417px]">
        <legend className="mb-5 text-base font-bold">Alterar senha</legend>
        <PasswordField label="Senha atual" autoComplete="current-password" error={we.currentPassword?.message} {...passwordForm.register('currentPassword')} />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={we.newPassword?.message}
          {...passwordForm.register('newPassword')}
        />
        <PasswordField label="Confirmar nova senha" autoComplete="new-password" error={we.confirmPassword?.message} {...passwordForm.register('confirmPassword')} />
      </fieldset>

      <div className="flex items-center gap-4">
        <Button type="submit" size="cta" className="w-[131px] text-sm" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
        {saved && (
          <p role="status" className="text-sm text-success">
            {saved}
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
    <div className="flex flex-col gap-2.5">
      <FieldLabel htmlFor="avatar-input">Avatar</FieldLabel>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
        <span id="avatar-hint" className="sr-only">
          PNG, JPEG ou WebP, até 2 MB.
        </span>
      )}
    </div>
  )
}
