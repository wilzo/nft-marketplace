import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { LoginInput, RegisterInput } from '@/api/contracts'
import { FormAlert, FormField, PasswordField } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { useLogin, useRegister } from '@/features/session/mutations'
import { notAvailable } from '@/lib/out-of-scope'
import { applyApiError, useFormAlert } from '@/lib/use-api-form'
import { cn } from '@/lib/utils'

type Variant = 'dialog' | 'page'

const fieldClass = (v: Variant) => (v === 'page' ? '[&_input]:h-[50px] [&_input]:rounded-[10px] [&_input]:px-4' : '[&_input]:rounded-[5px] [&_input]:px-4')
const submitClass = (v: Variant) => cn('w-full rounded-[5px] text-base', v === 'page' ? 'h-[60px] rounded-[10px]' : 'h-[45px]')

/** `defaultEmail`: vindo do login social com conflito ("Entrar com senha") — o foco vai direto para a senha. */
export function LoginForm({ variant, onSuccess, defaultEmail }: { variant: Variant; onSuccess: () => void; defaultEmail?: string }) {
  const login = useLogin()
  const [alert, setAlert] = useFormAlert()
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginInput), mode: 'onSubmit', defaultValues: { email: defaultEmail ?? '', password: '' } })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setAlert(null)
    login.mutate(values, {
      onSuccess,
      onError: (error) => setAlert(applyApiError(error, form.setError, ['email', 'password'])),
    })
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3" aria-label="Entrar">
      {alert && <FormAlert>{alert}</FormAlert>}
      <FormField
        label="E-mail"
        hideLabel
        type="email"
        autoComplete="email"
        placeholder="contato@email.com"
        autoFocus={!defaultEmail}
        className={fieldClass(variant)}
        error={errors.email?.message}
        {...form.register('email')}
      />
      <PasswordField
        label="Senha"
        autoFocus={!!defaultEmail}
        hideLabel
        autoComplete="current-password"
        placeholder="Senha"
        className={fieldClass(variant)}
        error={errors.password?.message}
        {...form.register('password')}
      />
      <button type="button" onClick={() => notAvailable('A recuperação de senha')} className="self-end text-sm text-brand-accent hover:underline">
        Esqueceu a senha?
      </button>
      <Button type="submit" className={cn(submitClass(variant), 'mt-3')} disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

export function RegisterForm({ variant, onSuccess }: { variant: Variant; onSuccess: () => void }) {
  const register = useRegister()
  const [alert, setAlert] = useFormAlert()
  const form = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInput),
    mode: 'onSubmit',
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setAlert(null)
    register.mutate(values, {
      onSuccess,
      onError: (error) => setAlert(applyApiError(error, form.setError, ['username', 'email', 'password', 'confirmPassword'])),
    })
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3" aria-label="Criar conta">
      {alert && <FormAlert>{alert}</FormAlert>}
      <FormField
        label="Nome de usuário"
        hideLabel
        autoComplete="username"
        placeholder="Nome de usuário"
        autoFocus
        className={fieldClass(variant)}
        error={errors.username?.message}
        {...form.register('username')}
      />
      <FormField
        label="E-mail"
        hideLabel
        type="email"
        autoComplete="email"
        placeholder="Digite seu e-mail"
        className={fieldClass(variant)}
        error={errors.email?.message}
        {...form.register('email')}
      />
      <PasswordField
        label="Senha"
        hideLabel
        autoComplete="new-password"
        placeholder="Senha"
        hint="Mínimo de 8 caracteres, com letras e números."
        className={fieldClass(variant)}
        error={errors.password?.message}
        {...form.register('password')}
      />
      <PasswordField
        label="Confirmar senha"
        hideLabel
        autoComplete="new-password"
        placeholder="Confirmar senha"
        className={fieldClass(variant)}
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <Button type="submit" className={cn(submitClass(variant), 'mt-6')} disabled={register.isPending}>
        {register.isPending ? 'Criando…' : variant === 'page' ? 'Criar perfil' : 'Criar conta'}
      </Button>
    </form>
  )
}
