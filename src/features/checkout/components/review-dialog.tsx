import { AlertCircle, Loader2 } from 'lucide-react'
import { NETWORK_LABELS, WALLET_TYPE_LABELS, type Network, type Quote, type Wallet } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { shortAddress } from '@/features/wallets/queries'
import { QuoteLines, QuoteTotals } from './checkout-panels'

export type ReviewProblem =
  /** Valores mudaram (evento em tempo real ou 409 do servidor): exige nova confirmação. */
  | { kind: 'changed'; message: string }
  /** Preço alterado: o usuário precisa aceitar os novos preços. */
  | { kind: 'price'; message: string }
  /** Disponibilidade: precisa revisar o carrinho. */
  | { kind: 'availability'; message: string }
  /** Sem resposta (timeout/rede): reenviar usa a mesma chave e não duplica o pedido. */
  | { kind: 'retry'; message: string }
  | { kind: 'error'; message: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote
  wallet: Wallet
  network: Network
  collectorName: string
  submitting: boolean
  problem: ReviewProblem | null
  onConfirm: () => void
  onRefresh: () => void
  onAcceptPrices: () => void
  onReviewCart: () => void
}

/** Revisão antes do envio: o pedido só é criado após a confirmação explícita desta cotação. */
export function ReviewDialog({ open, onOpenChange, quote, wallet, network, collectorName, submitting, problem, onConfirm, onRefresh, onAcceptPrices, onReviewCart }: Props) {
  const action = (() => {
    switch (problem?.kind) {
      case 'changed':
        return { label: 'Revisar novos valores', onClick: onRefresh }
      case 'price':
        return { label: 'Aceitar novos preços', onClick: onAcceptPrices }
      case 'availability':
        return { label: 'Revisar carrinho', onClick: onReviewCart }
      case 'retry':
        return { label: 'Tentar novamente', onClick: onConfirm }
      default:
        return { label: 'Confirmar e pagar', onClick: onConfirm }
    }
  })()

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-line bg-surface-card sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription className="text-sand">
            Confira os itens e os valores. O pagamento só é enviado depois da sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <QuoteLines quote={quote} compact />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-line p-3 text-sm">
          <dt className="text-sand">Colecionador</dt>
          <dd className="truncate">{collectorName}</dd>
          <dt className="text-sand">Carteira</dt>
          <dd className="truncate">
            {WALLET_TYPE_LABELS[wallet.walletType]} · {shortAddress(wallet.address)}
          </dd>
          <dt className="text-sand">Rede</dt>
          <dd>{NETWORK_LABELS[network]}</dd>
        </dl>
        <QuoteTotals quote={quote} />

        {problem && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-amber/50 bg-surface-raised px-3 py-2 text-sm text-amber">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {problem.message}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" size="cta" onClick={() => onOpenChange(false)} disabled={submitting}>
            Voltar
          </Button>
          <Button size="cta" onClick={action.onClick} disabled={submitting} aria-busy={submitting}>
            {submitting ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" /> Enviando pedido…
              </>
            ) : (
              action.label
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
