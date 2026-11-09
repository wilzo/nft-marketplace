import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FieldError, FieldLabel, inputClass } from './form-field'

/** Select do Figma ("Selecione uma rede" / "Selecione uma carteira") ligado ao react-hook-form. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  id,
  label,
  placeholder,
  options,
  labels,
  error,
  disabled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<T, any, any>
  name: Path<T>
  id: string
  label: string
  placeholder: string
  options: readonly string[]
  labels: Record<string, string>
  error?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={(field.value as string) || undefined} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger
              id={id}
              aria-required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onBlur={field.onBlur}
              className={cn(inputClass, 'w-full justify-between data-placeholder:text-khaki disabled:cursor-default disabled:opacity-100')}
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
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}
