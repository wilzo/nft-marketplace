import { useId, useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import HideIcon from '@/assets/icons/curved-hide.svg?react'
import { cn } from '@/lib/utils'

/** Campo do Figma: 40px, borda Color/Border, raio 3px, texto 14px; placeholder Color/Secondary. */
export const inputClass =
  'h-10 w-full rounded-[3px] border border-line bg-transparent px-3 text-sm text-cream placeholder:text-khaki transition-colors ' +
  'hover:border-line-soft focus-visible:border-brand focus-visible:outline-none aria-invalid:border-error disabled:opacity-50'

interface FormFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string
  /** Rótulo só para leitores de tela (layout do Figma usa placeholder no lugar do rótulo visível). */
  hideLabel?: boolean
  error?: string
  /** Dica extra (só para leitores de tela, para não alterar o layout do Figma). */
  hint?: string
  /** Conteúdo à direita do campo (ex.: sufixo). */
  suffix?: React.ReactNode
  /** Controle interativo dentro do campo, à direita (ex.: mostrar senha). */
  trailing?: React.ReactNode
  required?: boolean
}

/** Rótulo do Figma: 15px regular + asterisco Text/Coral 22px. */
export function FieldLabel({ htmlFor, children, required, hidden }: { htmlFor?: string; children: React.ReactNode; required?: boolean; hidden?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn('flex items-start gap-1 text-[15px] leading-[29px] text-cream', hidden && 'sr-only')}>
      <span className="pt-[7px] leading-[15px]">{children}</span>
      {required && (
        <span aria-hidden className="text-[22px] leading-[29px] text-coral">
          *
        </span>
      )}
    </label>
  )
}

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle aria-hidden className="size-3.5 shrink-0" />
      {children}
    </p>
  )
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
    <div className={cn('flex flex-col gap-2.5', hideLabel && 'gap-1.5', className)}>
      <FieldLabel htmlFor={id} required={required} hidden={hideLabel}>
        {label}
      </FieldLabel>
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
      {hint && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
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

/**
 * "Nome ENS" do Figma: seletor de sufixo ".eth ˅" (78px) + campo do nome.
 * Só o sufixo .eth é suportado; o seletor existe para reproduzir o layout.
 */
export function EnsField({ error, required = true, ...props }: Omit<React.ComponentProps<'input'>, 'id'> & { error?: string; required?: boolean }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2.5">
      <FieldLabel htmlFor={id} required={required}>
        Nome ENS
      </FieldLabel>
      <div className="flex gap-2.5">
        <div className="relative w-[78px] shrink-0">
          <select aria-label="Sufixo do nome ENS" className={cn(inputClass, 'appearance-none pr-7 text-[15px]')} defaultValue=".eth">
            <option value=".eth">.eth</option>
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-[18px] -translate-y-1/2 text-cream" />
        </div>
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-required={required || undefined}
          className={inputClass}
          {...props}
        />
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
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
