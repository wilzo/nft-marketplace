import { useId, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import HideIcon from '@/assets/icons/curved-hide.svg?react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-10 w-full rounded-[5px] border border-line bg-transparent px-4 text-sm text-cream placeholder:text-khaki transition-colors ' +
  'hover:border-line-soft focus-visible:border-brand focus-visible:outline-none aria-invalid:border-error disabled:opacity-50'

interface FormFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string
  /** Rótulo só para leitores de tela (layout do Figma usa placeholder no lugar do rótulo visível). */
  hideLabel?: boolean
  error?: string
  hint?: string
  /** Conteúdo à direita do campo (ex.: sufixo ".eth"). */
  suffix?: React.ReactNode
  /** Controle interativo dentro do campo, à direita (ex.: mostrar senha). */
  trailing?: React.ReactNode
  required?: boolean
}

/**
 * Campo de formulário acessível: <label> associado, erro em `aria-describedby` + `aria-invalid`,
 * e o erro é indicado por ícone e texto (não só pela cor da borda).
 */
export function FormField({ label, hideLabel, error, hint, suffix, trailing, required, className, ...props }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-cream', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-coral">
            *
          </span>
        )}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(inputClass, (suffix || trailing) && 'pr-14')}
          {...props}
        />
        {suffix && <span className="pointer-events-none absolute right-4 text-sm text-khaki">{suffix}</span>}
        {trailing && <div className="absolute right-2 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-sand">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

/** Campo de senha com botão mostrar/ocultar (ícone "Hide" do Figma). */
export function PasswordField(props: Omit<FormFieldProps, 'type' | 'suffix' | 'trailing'>) {
  const [visible, setVisible] = useState(false)
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="grid size-8 place-items-center rounded-sm text-khaki hover:text-brand-accent"
        >
          <HideIcon aria-hidden className="size-5" />
        </button>
      }
    />
  )
}

/** Mensagem de erro do formulário inteiro (ex.: credenciais inválidas, falha de rede). */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-error/60 bg-error/10 px-3 py-2 text-sm text-cream">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-coral" />
      <span>{children}</span>
    </p>
  )
}
