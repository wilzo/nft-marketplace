import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Loader2, X, XCircle } from 'lucide-react'
import { NETWORK_LABELS, WALLET_TYPE_LABELS, type Order } from '@/api/contracts'
import { NftImage } from '@/components/nft-image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrder, useOrderRealtime } from '@/features/orders/queries'
import { requireAuth } from '@/features/session/session'
import { shortAddress } from '@/features/wallets/queries'
import { formatDiscount, formatEth } from '@/lib/eth'

export const Route = createFileRoute('/pedidos/$orderId')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: OrderPage,
})

/**
 * Estado do pedido. A confirmação (frame "Confirmação de Pedido") só aparece para pedido CONFIRMADO pela simulação.
 * Pendente: aguarda `order.updated` (Socket.IO) com polling de segurança; refresh/reconexão recuperam o estado.
 * O recibo usa o snapshot do pedido — mudanças posteriores no catálogo não alteram os valores.
 */
function OrderPage() {
  const { orderId } = Route.useParams()
  const order = useOrder(orderId)
  useOrderRealtime()

  if (order.isPending) {
    return (
      <main id="conteudo" aria-busy className="mx-auto w-full max-w-[578px] py-10">
        <Skeleton className="h-[600px] w-full" />
      </main>
    )
  }
  if (order.isError) {
    const notFound = order.error.code === 'NOT_FOUND' || order.error.code === 'FORBIDDEN'
    return (
      <main id="conteudo" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{notFound ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}</h1>
        <p className="text-sand">{order.error.message}</p>
        {notFound ? (
          <Button asChild size="cta">
            <Link to="/">Voltar ao início</Link>
          </Button>
        ) : (
          <Button size="cta" onClick={() => void order.refetch()}>
            Tentar novamente
          </Button>
        )}
      </main>
    )
  }

  const data = order.data
  return (
    <main id="conteudo" className="mx-auto w-full max-w-[578px] py-6 lg:py-16">
      {data.status === 'confirmed' ? <Receipt order={data} /> : data.status === 'declined' ? <Declined order={data} /> : <Pending order={data} />}
    </main>
  )
}

function Lines({ order }: { order: Order }) {
  return (
    <section aria-labelledby="tx-details" className="px-6 sm:px-11">
      <h2 id="tx-details" className="mb-2 font-bold">
        Detalhes da transação
      </h2>
      <div aria-hidden className="grid grid-cols-[1fr_80px_100px] border-b border-brand/30 pb-2 font-bold">
        <span>NFTs</span>
        <span className="text-center">Edições</span>
        <span className="text-right">Subtotal</span>
      </div>
      <ul className="flex flex-col gap-3 py-3">
        {order.lines.map((l) => (
          <li key={l.itemId} className="grid grid-cols-[1fr_80px_100px] items-center gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <NftImage image={l.image} alt="" sizes="70px" className="size-[66px] shrink-0 rounded-md" />
              <div className="min-w-0">
                <p className="truncate font-bold">{l.name}</p>
                <p className="text-sm text-khaki">ID do token: {l.tokenId}</p>
              </div>
            </div>
            <span className="text-center text-sm text-sand">
              <span className="sr-only">Quantidade: </span>(x {l.quantity})
            </span>
            <span className="text-right font-bold text-brand-accent">{formatEth(l.lineTotal)} ETH</span>
          </li>
        ))}
      </ul>
      <dl className="ml-auto flex max-w-[320px] flex-col gap-1.5 border-b border-brand/30 pb-3">
        {order.discount !== '0' && (
          <div className="flex justify-between">
            <dt>Desconto do lançamento</dt>
            <dd>{formatDiscount(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd>{formatEth(order.networkFee)} ETH</dd>
        </div>
        <div className="flex justify-between font-bold">
          <dt>Total</dt>
          <dd className="text-lg text-brand-accent">{formatEth(order.total)} ETH</dd>
        </div>
      </dl>
    </section>
  )
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
/** Formato do Figma: "29 Jul, 2026". */
const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

/** Recibo do pedido confirmado (frame "Desktop / Confirmação de Pedido"). */
function Receipt({ order }: { order: Order }) {
  const navigate = useNavigate()
  return (
    // Figma "Confirmação de Pedido": modal 578px sobre fundo sólido (Color/Ink)
    <Dialog open onOpenChange={(open) => !open && void navigate({ to: '/' })}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-ink"
        aria-describedby={undefined}
        className="max-h-[96dvh] w-[578px] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-none border-0 bg-surface-card p-0 pb-10 ring-0 sm:max-w-[578px]"
      >
      <DialogClose aria-label="Fechar e voltar ao início" className="absolute top-4 right-4 grid size-7 place-items-center text-brand hover:text-brand-accent">
        <X aria-hidden className="size-5" />
      </DialogClose>
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5">
        <svg aria-hidden viewBox="0 0 64 80" className="h-20 w-16 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="8" y="6" width="48" height="40" rx="3" />
          <text x="32" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">THANK</text>
          <text x="32" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">YOU</text>
          <path d="M2 38v38h60V38L32 58 2 38Z" />
          <path d="m2 76 22-22M62 76 40 54" />
        </svg>
        <DialogTitle id="receipt-title" className="text-center text-base font-bold text-sand">
          Seus NFTs agora estão na sua carteira
        </DialogTitle>
        <p role="status" className="sr-only">
          Pedido {order.number} confirmado.
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-brand px-6 py-3 text-sm whitespace-nowrap sm:grid-cols-[auto_auto_auto_auto] sm:justify-between sm:divide-x sm:divide-brand">
        <div className="sm:pr-4">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand" title={order.txHash ?? undefined}>
            {order.txHash ? shortAddress(order.txHash).toUpperCase().replace('0X', '0x') : '—'}
          </dd>
        </div>
        <div className="sm:px-4">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{formatDate(order.confirmedAt ?? order.createdAt)}</dd>
        </div>
        <div className="sm:px-4">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.total)} ETH</dd>
        </div>
        <div className="sm:pl-4">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand">{WALLET_TYPE_LABELS[order.wallet.walletType]}</dd>
        </div>
      </dl>
      <div className="pt-6">
        <Lines order={order} />
      </div>
      <p className="mx-auto mt-4 max-w-[460px] px-6 text-center text-sm leading-[22px] text-sand">
        Transação confirmada na {NETWORK_LABELS[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
      </p>
      <div className="mt-5 flex flex-col items-center gap-2">
        {order.explorerUrl && (
          <Button asChild size="cta">
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
              Ver no Etherscan
              <span className="sr-only"> (abre em nova aba; referência simulada)</span>
            </a>
          </Button>
        )}
        <span className="sr-only">Referência de transação e link de exploração simulados.</span>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2.5 bg-brand" />
      </DialogContent>
    </Dialog>
  )
}

function Pending({ order }: { order: Order }) {
  return (
    <article aria-labelledby="pending-title" className="rounded-lg bg-surface-card py-8">
      <header className="flex flex-col items-center gap-3 px-6 pb-6 text-center">
        <Loader2 aria-hidden className="size-10 animate-spin text-brand" />
        <h1 id="pending-title" className="text-lg font-bold">
          Aguardando confirmação do pagamento
        </h1>
        <p role="status" className="text-sm text-sand">
          Pedido {order.number} em processamento na {NETWORK_LABELS[order.network]}. Você pode sair desta página: o status será atualizado
          automaticamente e o pedido não será duplicado.
        </p>
        <p className="text-xs text-khaki">Carteira {WALLET_TYPE_LABELS[order.wallet.walletType]} · {shortAddress(order.wallet.address)}</p>
      </header>
      <Lines order={order} />
    </article>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <article aria-labelledby="declined-title" className="rounded-lg bg-surface-card py-8">
      <header className="flex flex-col items-center gap-3 px-6 pb-6 text-center">
        <XCircle aria-hidden className="size-10 text-coral" />
        <h1 id="declined-title" className="text-lg font-bold">
          Pagamento recusado
        </h1>
        <p role="alert" className="text-sm text-sand">
          {order.failureReason ?? 'O pagamento não foi concluído.'} Seus itens continuam no carrinho.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="cta">
            <Link to="/pagamento">Tentar novamente</Link>
          </Button>
          <Button asChild size="cta" variant="outline">
            <Link to="/carrinho">Voltar ao carrinho</Link>
          </Button>
        </div>
      </header>
      <Lines order={order} />
    </article>
  )
}
