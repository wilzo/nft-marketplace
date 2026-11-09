import type { Socket } from 'socket.io-client'
import { REALTIME_EVENTS, RealtimeEvent } from '@/api/contracts'
import { env } from '@/config/env'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'
type EventOf<T extends RealtimeEvent['type']> = Extract<RealtimeEvent, { type: T }>
type Handler<T extends RealtimeEvent['type']> = (event: EventOf<T>) => void

const MAX_SEEN = 500

/**
 * Cliente de tempo real (socket.io-client). Garantias:
 *  - deduplicação por `eventId` (reentregas não reaplicam efeitos);
 *  - ordenação por versão do recurso (eventos antigos não regridem o estado);
 *  - isolamento por usuário: `order.updated` de outro usuário é descartado;
 *  - troca de sessão recria o socket com o novo token e zera o estado da sessão anterior;
 *  - `onReconnect` avisa reconexões para reconciliar os recursos ativos com a API REST.
 */
export class RealtimeClient {
  private socket: Socket | null = null
  private pending = false
  private attempt = 0
  private token: string | null = null
  private userId: string | null = null
  private everConnected = false
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private handlers = new Map<string, Set<(e: RealtimeEvent) => void>>()
  private reconnectHandlers = new Set<() => void>()
  private statusHandlers = new Set<(s: RealtimeStatus) => void>()
  status: RealtimeStatus = 'idle'

  /**
   * Conecta (ou reconecta) para a sessão informada. Visitantes recebem só eventos públicos.
   *
   * O socket.io-client é importado sob demanda: o engine.io-client captura `globalThis.WebSocket`
   * ao carregar o módulo, então ele precisa ser avaliado depois que o MSW instala a interceptação.
   * (Também tira o pacote do bundle inicial.)
   */
  async connect(session: { token: string; userId: string } | null) {
    const token = session?.token ?? null
    if ((this.socket || this.pending) && token === this.token) return
    this.teardown()
    this.token = token
    this.userId = session?.userId ?? null
    const attempt = ++this.attempt
    this.pending = true
    this.setStatus('connecting')

    const { io } = await import('socket.io-client')
    this.pending = false
    if (attempt !== this.attempt) return // sessão mudou durante o import

    const socket = io(env.socketUrl, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
      timeout: 5_000,
    })
    this.socket = socket

    socket.on('connect', () => {
      this.setStatus('connected')
      if (this.everConnected) this.reconnectHandlers.forEach((h) => h())
      this.everConnected = true
    })
    socket.on('disconnect', () => this.setStatus('disconnected'))
    socket.on('connect_error', () => this.setStatus('disconnected'))
    for (const type of REALTIME_EVENTS) socket.on(type, (payload: unknown) => this.receive(payload))
  }

  /** Encerra o socket e descarta estado/assinaturas da sessão (logout, troca de usuário). */
  teardown() {
    this.attempt++
    this.pending = false
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.token = null
    this.userId = null
    this.everConnected = false
    this.seen.clear()
    this.versions.clear()
    this.setStatus('idle')
  }

  on<T extends RealtimeEvent['type']>(type: T, handler: Handler<T>) {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler as (e: RealtimeEvent) => void)
    this.handlers.set(type, set)
    return () => void set.delete(handler as (e: RealtimeEvent) => void)
  }

  onReconnect(handler: () => void) {
    this.reconnectHandlers.add(handler)
    return () => void this.reconnectHandlers.delete(handler)
  }

  onStatus(handler: (s: RealtimeStatus) => void) {
    this.statusHandlers.add(handler)
    return () => void this.statusHandlers.delete(handler)
  }

  /** Registra a versão conhecida via REST, para que eventos mais antigos sejam ignorados. */
  noteVersion(resourceType: 'nft' | 'order', id: string, version: number) {
    const key = `${resourceType}:${id}`
    if (version > (this.versions.get(key) ?? 0)) this.versions.set(key, version)
  }

  /** Exposto para testes de unidade da política de eventos. */
  receive(payload: unknown) {
    const parsed = RealtimeEvent.safeParse(payload)
    if (!parsed.success) return
    const event = parsed.data
    if (this.seen.has(event.eventId)) return
    if (event.type === 'order.updated' && event.userId !== this.userId) return
    const key = `${event.resource.type}:${event.resource.id}`
    if (event.version <= (this.versions.get(key) ?? 0)) return

    this.seen.add(event.eventId)
    if (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value!)
    this.versions.set(key, event.version)
    this.handlers.get(event.type)?.forEach((h) => h(event))
  }

  private setStatus(status: RealtimeStatus) {
    this.status = status
    this.statusHandlers.forEach((h) => h(status))
  }
}

export const realtime = new RealtimeClient()
