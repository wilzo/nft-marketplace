import { useId, useState } from 'react'
import { CATEGORY_LABELS, NETWORK_LABELS, type CatalogPage, type Category, type Network } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { hasActiveFilters, type CatalogSearch } from '../search'

type Facets = CatalogPage['facets']

interface Props {
  search: CatalogSearch
  facets: Facets | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  onClear: () => void
  className?: string
}

const toCents = (eth: string) => Math.round(Number(eth) * 100)
const fromCents = (c: number) => (c / 100).toFixed(2)
const formatBr = (c: number) => (c / 100).toFixed(2).replace('.', ',')

function toggle<T>(list: T[] | undefined, value: T) {
  const set = new Set(list ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return [...set]
}

/** Painel "Filters" do Figma: Coleções, Faixa de preço e Rede. Filtros combináveis. */
export function CatalogFilters({ search, facets, onChange, onClear, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-10 bg-surface-card p-5', className)}>
      <FacetList
        title="Coleções"
        items={facets?.category}
        labels={CATEGORY_LABELS}
        selected={search.category}
        onToggle={(v) => onChange({ category: toggle(search.category, v as Category) })}
      />
      <PriceFilter search={search} range={facets?.priceRange} onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })} />
      <FacetList
        title="Rede"
        items={facets?.network}
        labels={NETWORK_LABELS}
        selected={search.network}
        onToggle={(v) => onChange({ network: toggle(search.network, v as Network) })}
      />
      {hasActiveFilters(search) && (
        <Button variant="outline" size="cta" onClick={onClear} className="self-start">
          Limpar filtros
        </Button>
      )}
    </div>
  )
}

function FacetList({
  title,
  items,
  labels,
  selected,
  onToggle,
}: {
  title: string
  items: { value: string; count: number }[] | undefined
  labels: Record<string, string>
  selected: string[] | undefined
  onToggle: (value: string) => void
}) {
  const id = useId()
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg leading-4 font-bold">{title}</legend>
      {!items ? (
        <div className="flex flex-col gap-3 px-3" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : (
        <ul className="px-3">
          {items.map(({ value, count }) => {
            const checked = selected?.includes(value) ?? false
            return (
              <li key={value}>
                <label
                  htmlFor={`${id}-${value}`}
                  className={cn(
                    // Figma: lista 15/40 sem caixas de seleção; selecionado em Text/Accent e negrito (não só cor)
                    '-mx-2 flex h-10 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 text-[15px] text-brand-accent transition-colors hover:bg-surface-raised/60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                    checked && 'bg-surface-raised font-bold',
                  )}
                >
                  <span>
                    <input
                      id={`${id}-${value}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(value)}
                      className="sr-only"
                    />
                    {labels[value]}
                  </span>
                  <span className="font-bold" aria-label={`${count} NFTs`}>
                    ({count})
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </fieldset>
  )
}

function PriceFilter({
  search,
  range,
  onApply,
}: {
  search: CatalogSearch
  range: { min: string; max: string } | undefined
  onApply: (min: string | undefined, max: string | undefined) => void
}) {
  const bounds: [number, number] = range ? [toCents(range.min), toCents(range.max)] : [2, 1230]
  const fromSearch = (): [number, number] => [
    search.minPrice ? toCents(search.minPrice) : bounds[0],
    search.maxPrice ? toCents(search.maxPrice) : bounds[1],
  ]
  const [value, setValue] = useState<[number, number]>(fromSearch)
  // Sincroniza com a URL (voltar/avançar, limpar filtros) e com a faixa da API, sem efeito.
  const syncKey = [search.minPrice, search.maxPrice, ...bounds].join("|")
  const [synced, setSynced] = useState(syncKey)
  if (synced !== syncKey) {
    setSynced(syncKey)
    setValue(fromSearch())
  }

  const labelId = useId()
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg leading-4 font-bold">Faixa de preço</legend>
      <div className="flex flex-col gap-3 pl-3">
        <Slider
          min={bounds[0]}
          max={bounds[1]}
          step={1}
          minStepsBetweenThumbs={1}
          value={value}
          onValueChange={(v) => setValue([v[0], v[1]])}
          aria-labelledby={labelId}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          disabled={!range}
        />
        <p id={labelId} className="text-[15px] leading-5" aria-live="polite">
          Preço: {formatBr(value[0])} - {formatBr(value[1])} ETH
        </p>
        <Button
          size="cta"
          className="w-[92px] px-3"
          disabled={!range}
          onClick={() =>
            onApply(value[0] > bounds[0] ? fromCents(value[0]) : undefined, value[1] < bounds[1] ? fromCents(value[1]) : undefined)
          }
        >
          Aplicar
        </Button>
      </div>
    </fieldset>
  )
}
