import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { mockControl } from '@/api/mock-control'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { guestCartId, sessionToken } from '@/lib/client-storage'

/** Limpa o estado do cliente e recarrega, para que a interface reflita o banco/cenário restaurado. */
function reloadClean() {
  sessionToken.set(null)
  guestCartId.set(null)
  window.location.reload()
}

/**
 * Painel de cenários do mock (demonstração e testes manuais): troca o cenário ativo e restaura o estado inicial.
 * Tudo passa pela API de controle do MSW, na camada de rede.
 */
export default function ScenarioPanel() {
  const [open, setOpen] = useState(false)
  const state = useQuery({ queryKey: ['__mock', 'scenario'], queryFn: mockControl.scenario, enabled: open, staleTime: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const current = selected ?? state.data?.active.name ?? 'padrao'

  const apply = useMutation({
    mutationFn: () => mockControl.setScenario(current),
    onSuccess: () => {
      toast.success(`Cenário "${current}" ativado. Recarregando…`)
      setTimeout(() => window.location.reload(), 600)
    },
  })
  const reset = useMutation({
    mutationFn: () => mockControl.reset(),
    onSuccess: () => {
      toast.success('Dados e cenário restaurados. Recarregando…')
      setTimeout(reloadClean, 600)
    },
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Cenários da simulação"
          className="fixed top-0 left-2 z-40 flex h-6 items-center gap-1.5 rounded-b-md border border-t-0 border-brand/50 bg-surface-card/95 px-2 text-xs font-bold text-brand shadow-raised hover:bg-surface-raised lg:top-auto lg:bottom-4 lg:left-3 lg:h-auto lg:rounded-full lg:border-t lg:px-3 lg:py-2"
        >
          <FlaskConical aria-hidden className="size-4" />
          <span className="hidden lg:inline">Cenários</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(92vw,380px)] border-line bg-surface-card">
        <SheetHeader>
          <SheetTitle>Cenários da simulação</SheetTitle>
          <SheetDescription className="text-sand">
            Altera o comportamento da API simulada (MSW). Ativo: <strong className="text-cream">{state.data?.active.name ?? '…'}</strong>
          </SheetDescription>
        </SheetHeader>
        <fieldset className="flex-1 overflow-y-auto px-4">
          <legend className="sr-only">Cenário</legend>
          {state.isPending && <p className="text-sm text-sand">Carregando…</p>}
          {state.data?.presets.map((p) => (
            <label key={p.name} className="flex cursor-pointer gap-3 rounded-md p-2 hover:bg-surface-raised has-checked:bg-surface-raised">
              <input
                type="radio"
                name="scenario"
                value={p.name}
                checked={current === p.name}
                onChange={() => setSelected(p.name)}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="block text-sm font-bold">{p.name}</span>
                <span className="block text-xs text-sand">{p.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2 p-4">
          <Button className="flex-1" size="cta" onClick={() => apply.mutate()} disabled={apply.isPending || !state.data}>
            Aplicar
          </Button>
          <Button className="flex-1" size="cta" variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
            Restaurar tudo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
