import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { NewsletterInput } from '@/api/contracts'
import { newsletterApi } from '@/api/endpoints'
import { applyApiError } from '@/lib/use-api-form'

/**
 * Newsletter do rodapé ("Antecipe-se ao próximo lançamento"): inscrição pela API simulada (POST /newsletter).
 * Validação do e-mail no cliente (mesmo contrato da API); e-mail já inscrito volta como erro do campo (409).
 * Mensagens no próprio formulário (sem toast), anunciadas a leitores de tela.
 */
export function NewsletterForm() {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const form = useForm<NewsletterInput>({ resolver: zodResolver(NewsletterInput), mode: 'onSubmit', defaultValues: { email: '' } })
  const error = form.formState.errors.email?.message
  const subscribe = useMutation({ mutationFn: (input: NewsletterInput) => newsletterApi.subscribe(input) })

  const submit = form.handleSubmit((values) => {
    setMessage(null)
    subscribe.mutate(values, {
      onSuccess: (subscription) => {
        form.reset({ email: '' })
        setMessage({ kind: 'ok', text: `Inscrição confirmada: ${subscription.email} vai receber as novidades da Kurio.` })
      },
      onError: (err) => {
        const general = applyApiError(err, form.setError, ['email'])
        if (general) setMessage({ kind: 'error', text: general })
      },
    })
  })

  return (
    <form noValidate onSubmit={submit} aria-labelledby="newsletter-title" className="flex flex-[1.35] flex-col gap-3 lg:px-4">
      <h2 id="newsletter-title" className="text-lg leading-[18px] font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para a newsletter
        </label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'newsletter-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-md bg-surface-dark px-3 text-sm text-cream placeholder:text-khaki aria-invalid:outline-2 aria-invalid:outline-coral"
          {...form.register('email', { onChange: () => setMessage(null) })}
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          aria-busy={subscribe.isPending || undefined}
          className="h-10 rounded-r-md bg-brand px-4 text-base font-bold text-ink hover:bg-brand-accent disabled:opacity-70"
        >
          Enviar
        </button>
      </div>
      {error && (
        <p id="newsletter-error" role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
      {message && (
        <p role={message.kind === 'ok' ? 'status' : 'alert'} className={message.kind === 'ok' ? 'text-sm text-cream' : 'text-sm text-coral'}>
          {message.text}
        </p>
      )}
      <p className="text-xs leading-[22px] text-sand">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </form>
  )
}
