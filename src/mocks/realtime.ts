import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { env } from '@/config/env'
import { getDb, nextId, nowIso } from './db/store'
import { getScenario } from './scenarios'
import { toNftSummary } from './domain/mappers'
import type { NftRecord, OrderRecord } from './db/types'

/**
 * Servidor Socket.IO simulado sobre o handler `ws` do MSW + @mswjs/socket.io-binding.
 *
 * Limitações do binding (documentadas em ARCHITECTURE.md):
 *  - apenas transporte WebSocket (o cliente usa `transports: ['websocket']`);
 *  - sem namespaces/rooms: o roteamento por usuário é feito aqui;
 *  - o binding confirma a conexão antes de ler o `auth`, então o token é lido do pacote CONNECT bruto;
 *  - não há heartbeat: enviamos pings do Engine.IO para o cliente não encerrar por ping timeout.
 */

// O MSW remove o prefixo "/socket.io/" da URL do cliente antes de casar o handler.
export const realtimeLink = ws.link(`${env.socketUrl}/*`)

type Io = ReturnType<typeof toSocketIo>
interface Connection {
  id: number
  io: Io
  client: { close: (code?: number, reason?: string) => void; send: (data: string) => void }
  userId: string | null
  ping: ReturnType<typeof setInterval>
}

const connections = new Map<number, Connection>()
let connectionSeq = 0
/** Últimos eventos emitidos (para reenvio duplicado/antigo via API de controle). */
const history: RealtimeEvent[] = []

function userIdFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const session = getDb().sessions.find((s) => s.token === token && s.expiresAt > nowIso())
  return session?.userId ?? null
}

export const realtimeHandler = realtimeLink.addEventListener('connection', (connection) => {
  const { client } = connection
  if (getScenario().realtime.down) {
    client.close(1011, 'Servidor de eventos indisponível')
    return
  }
  const io = toSocketIo(connection)
  const id = ++connectionSeq
  // Heartbeat Engine.IO ("2" = ping). O cliente responde "3" (pong).
  const ping = setInterval(() => client.send('2'), 20_000)
  const conn: Connection = { id, io, client, userId: null, ping }
  connections.set(id, conn)

  client.addEventListener('message', (event) => {
    // Pacote CONNECT do Socket.IO: "40" + JSON do `auth` enviado pelo cliente.
    if (typeof event.data === 'string' && event.data.startsWith('40')) {
      try {
        const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string }
        conn.userId = userIdFromToken(auth.token)
      } catch {
        conn.userId = null
      }
    }
  })
  client.addEventListener('close', () => {
    clearInterval(ping)
    connections.delete(id)
  })
})

function deliver(event: RealtimeEvent) {
  for (const conn of connections.values()) {
    // order.updated só vai para conexões autenticadas do dono do pedido.
    if (event.type === 'order.updated' && conn.userId !== event.userId) continue
    conn.io.client.emit(event.type, event)
  }
}

function publish(event: RealtimeEvent) {
  history.push(event)
  if (history.length > 50) history.shift()
  deliver(event)
}

export function publishNftUpdated(nft: NftRecord) {
  const summary = toNftSummary(nft)
  const event: NftUpdatedEvent = {
    eventId: nextId('evt'),
    type: 'nft.updated',
    occurredAt: nowIso(),
    version: nft.version,
    resource: { type: 'nft', id: nft.id },
    data: {
      price: summary.price,
      previousPrice: summary.previousPrice,
      available: summary.available,
      defaultEditionId: summary.defaultEditionId,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  }
  publish(event)
  return event
}

export function publishOrderUpdated(order: OrderRecord) {
  const event: OrderUpdatedEvent = {
    eventId: nextId('evt'),
    type: 'order.updated',
    occurredAt: nowIso(),
    version: order.version,
    resource: { type: 'order', id: order.id },
    userId: order.userId,
    data: { status: order.status, txHash: order.txHash, failureReason: order.failureReason },
  }
  publish(event)
  return event
}

/** Reentrega o último evento (mesmo eventId) — testa deduplicação. */
export function replayLastEvent(): RealtimeEvent | null {
  const last = history.at(-1)
  if (last) deliver(last)
  return last ?? null
}

/** Reentrega um evento antigo do recurso com versão menor que a atual — testa ordenação. */
export function replayStaleEvent(resourceId: string): RealtimeEvent | null {
  const stale = history.find((e) => e.resource.id === resourceId)
  const latest = history.findLast((e) => e.resource.id === resourceId)
  if (!stale || !latest || stale.version >= latest.version) return null
  deliver(stale)
  return stale
}

/** Derruba todas as conexões; o socket.io-client reconecta sozinho (se o cenário permitir). */
export function disconnectAll() {
  const count = connections.size
  for (const conn of connections.values()) {
    clearInterval(conn.ping)
    conn.client.close(4000, 'Desconectado pelo controle do mock')
  }
  connections.clear()
  return count
}

export function realtimeStats() {
  return {
    connections: [...connections.values()].map((c) => ({ id: c.id, userId: c.userId })),
    history: history.length,
  }
}
