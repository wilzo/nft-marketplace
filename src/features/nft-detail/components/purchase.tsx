import { Minus, Plus } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import type { Edition } from '@/api/contracts'
import { cn } from '@/lib/utils'


/** Seletor de edição (Figma: chips 28px de altura com borda; selecionado em laranja). */
export function EditionPicker({ editions, value, onChange }: { editions: Edition[]; value: string; onChange: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[15px] leading-4 font-bold">Edição:</legend>
      {/* ToggleGroup single: role radio + foco itinerante (setas) do Radix */}
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v)}
        aria-label="Edição"
        className="flex flex-wrap gap-1.5"
      >
        {editions.map((e) => {
          const soldOut = e.available === 0
          return (
            <ToggleGroup.Item
              key={e.id}
              value={e.id}
              aria-label={`Edição ${e.label}${soldOut ? ' (esgotada)' : ''}`}
              className={cn(
                'h-7 rounded-full border border-line px-2 text-sm text-sand transition-colors hover:border-brand',
                'data-[state=on]:border-brand data-[state=on]:font-medium data-[state=on]:text-brand-accent',
                soldOut && 'text-khaki line-through decoration-1',
              )}
            >
              {e.label}
            </ToggleGroup.Item>
          )
        })}
      </ToggleGroup.Root>
    </fieldset>
  )
}

/** Quantidade (Figma "01": botões laranja − / + com o número no meio). */
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
  size = 'lg',
  id,
}: {
  value: number
  max: number
  onChange: (n: number) => void
  disabled?: boolean
  size?: 'lg' | 'sm'
  id: string
}) {
  const btn = cn(
    'grid place-items-center rounded-full bg-brand text-ink transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-40',
    size === 'lg' ? 'h-[50px] w-[31px]' : 'h-7 w-5',
  )
  return (
    <div className="flex items-center gap-3" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        Quantidade
      </span>
      <button type="button" className={btn} aria-label="Diminuir quantidade" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden className={size === 'lg' ? 'size-5' : 'size-3'} strokeWidth={3} />
      </button>
      <output aria-live="polite" className={cn('min-w-6 text-center', size === 'lg' ? 'text-lg' : 'text-base font-bold')}>
        {value}
      </output>
      <button type="button" className={btn} aria-label="Aumentar quantidade" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden className={size === 'lg' ? 'size-5' : 'size-3'} strokeWidth={3} />
      </button>
    </div>
  )
}
