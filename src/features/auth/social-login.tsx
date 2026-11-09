import { useRef, useState } from 'react'
import { AccountExistsDetails, type OAuthAuthorization, type OAuthProvider } from '@/api/contracts'
import FacebookIcon from '@/assets/icons/social-facebook.svg?react'
import GoogleIcon from '@/assets/icons/social-google.svg?react'
import { FormAlert } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useOAuthAuthorize, useOAuthComplete } from '@/features/session/mutations'
import { cn } from '@/lib/utils'

type Variant = 'dialog' | 'page'

interface Problem {
  message: string
  /** Conflito: e-mail do provedor já tem conta com senha → oferece entrar com a senha. */
  email?: string
}

const PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Continuar com Google', icon: <GoogleIcon aria-hidden className="size-5" /> },
  { id: 'facebook', label: 'Continuar com Facebook', icon: <FacebookIcon aria-hidden className="h-5 w-auto" /> },
]

/**
 * "Ou continue com" + Google/Facebook. O login social é SIMULADO pela API de demonstração (MSW):
 * o "provedor" devolve um pedido de consentimento com contas fictícias, exibido num diálogo; a decisão
 * do usuário volta à API, que cria/vincula a conta e abre a sessão. Nada é enviado ao Google ou ao Facebook.
 */
export function SocialLogin({
  variant,
  onSuccess,
  onUsePassword,
}: {
  variant: Variant
  onSuccess: () => void
  onUsePassword: (email: string) => void
}) {
  const authorize = useOAuthAuthorize()
  const complete = useOAuthComplete()
  const [consent, setConsent] = useState<OAuthAuthorization | null>(null)
  const [subject, setSubject] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const triggers = useRef<Partial<Record<OAuthProvider, HTMLButtonElement | null>>>({})
  const busy = authorize.isPending || complete.isPending

  const start = (provider: OAuthProvider) => {
    setProblem(null)
    authorize.mutate(provider, {
      onSuccess: (request) => {
        setSubject(request.accounts[0]!.subject)
        setConsent(request)
      },
      onError: (error) => setProblem({ message: error.message }),
    })
  }

  const decide = (decision: 'allow' | 'deny') => {
    if (!consent || complete.isPending) return
    const input = decision === 'allow' ? { requestId: consent.requestId, decision, subject } : { requestId: consent.requestId, decision }
    complete.mutate(
      { provider: consent.provider, input },
      {
        onSuccess: () => {
          setConsent(null)
          onSuccess()
        },
        onError: (error) => {
          setConsent(null)
          const details = error.code === 'ACCOUNT_EXISTS' ? AccountExistsDetails.safeParse(error.details) : null
          setProblem({ message: error.message, email: details?.success ? details.data.email : undefined })
        },
      },
    )
  }

  const button = 'flex h-10 w-full items-center justify-center gap-3 rounded-[5px] border border-line text-sm text-sand hover:border-brand disabled:opacity-60'

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('flex items-center gap-3 text-[13px]', variant === 'dialog' && '-mx-20')}>
        <span aria-hidden className="h-px flex-1 bg-line" />
        Ou continue com
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      {problem && (
        <FormAlert>
          {problem.message}
          {problem.email && (
            <>
              {' '}
              <button type="button" onClick={() => onUsePassword(problem.email!)} className="font-bold text-brand-accent underline underline-offset-2">
                Entrar com senha
              </button>
            </>
          )}
        </FormAlert>
      )}
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          ref={(el) => {
            triggers.current[p.id] = el
          }}
          type="button"
          className={button}
          disabled={busy}
          aria-busy={authorize.isPending && authorize.variables === p.id}
          onClick={() => start(p.id)}
        >
          {p.icon}
          {p.label}
        </button>
      ))}

      <Dialog open={!!consent} onOpenChange={(open) => !open && decide('deny')}>
        {consent && (
          <DialogContent
            showCloseButton={false}
            onCloseAutoFocus={(e) => {
              // Foco volta ao botão do provedor que abriu o consentimento.
              e.preventDefault()
              triggers.current[consent.provider]?.focus()
            }}
            className="border-line bg-surface-card sm:max-w-[440px]"
          >
            <DialogHeader>
              <DialogTitle>Entrar com {consent.providerName}</DialogTitle>
              <DialogDescription className="text-sand">
                Simulação do {consent.providerName}: nenhum dado é enviado a serviços externos. Escolha a conta e autorize o
                compartilhamento com a Kurio.
              </DialogDescription>
            </DialogHeader>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-bold">Escolha uma conta</legend>
              {consent.accounts.map((account) => (
                <label
                  key={account.subject}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-3 has-checked:border-brand has-checked:bg-surface-raised has-focus-visible:ring-2 has-focus-visible:ring-brand"
                >
                  <input
                    type="radio"
                    name="oauth-account"
                    value={account.subject}
                    checked={subject === account.subject}
                    onChange={() => setSubject(account.subject)}
                    className="size-4 accent-brand"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-bold">{account.name}</span>
                    <span className="text-xs text-sand">{account.email}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="text-sm">
              <p className="font-bold">A Kurio terá acesso a:</p>
              <ul className="mt-1 list-disc pl-5 text-sand">
                {consent.scopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={complete.isPending} onClick={() => decide('deny')}>
                Cancelar
              </Button>
              <Button type="button" disabled={complete.isPending} onClick={() => decide('allow')}>
                {complete.isPending ? 'Conectando…' : 'Continuar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
