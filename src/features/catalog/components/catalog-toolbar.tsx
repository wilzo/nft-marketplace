import { CATALOG_SORTS, SORT_LABELS, type CatalogSort, type CatalogTab } from '@/api/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const TABS: { value: CatalogTab; label: string }[] = [
  { value: 'todos', label: 'Todos os NFTs' },
  { value: 'novos', label: 'Novos lançamentos' },
  { value: 'em-alta', label: 'Em alta' },
]

/** Abas do catálogo ("Tabs" do Figma). São filtros, por isso botões com aria-pressed. */
export function CatalogTabs({ value, onChange }: { value: CatalogTab; onChange: (tab: CatalogTab) => void }) {
  return (
    <div role="group" aria-label="Seção do catálogo" className="flex gap-4 overflow-x-auto lg:gap-5">
      {TABS.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative shrink-0 pb-1.5 text-sm whitespace-nowrap text-cream hover:text-brand-accent lg:text-[15px] lg:font-medium',
              active && "font-bold text-brand-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand after:content-['']",
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function CatalogSortSelect({ value, onChange, id = 'catalog-sort' }: { value: CatalogSort; onChange: (sort: CatalogSort) => void; id?: string }) {
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="text-[15px] whitespace-nowrap text-cream">
        Ordenar por:
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as CatalogSort)}>
        <SelectTrigger id={id} className="h-auto border-0 bg-transparent px-1 py-0 text-[15px] text-cream shadow-none dark:bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line bg-surface-card">
          {CATALOG_SORTS.map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
