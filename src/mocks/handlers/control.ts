import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { EthAmount } from '@/api/contracts'
import { getDb, nowIso, resetDb, transact } from '../db/store'
import { bumpNft, clearSettlementTimers, settle } from '../domain/commerce'
import { api, apiError, parseBody } from '../lib/http'
import { disconnectAll, publishNftUpdated, realtimeStats, replayLastEvent, replayStaleEvent } from '../realtime'
import { buildScenario, DEFAULT_SCENARIO, getScenario, SCENARIO_PRESETS, setScenario } from '../scenarios'

/**
 * API de controle do mock (`/api/__mock/*`), usada pelo painel de cenários, pela demonstração e pelo Playwright.
 * As mudanças passam pelo banco simulado e são refletidas tanto nas respostas REST quanto nos eventos Socket.IO.
 * Não sofre latência nem falhas injetadas.
 */

const ScenarioInput = z.object({
  name: z.string().refine((n) => n in SCENARIO_PRESETS, 'Cenário desconhecido'),
  overrides: z.record(z.string(), z.unknown()).optional(),
})

const NftPatch = z.object({
  /** Edição alvo (padrão: edição aberta, cujo preço é o exibido no card). */
  editionId: z.string().optional(),
  price: EthAmount.optional(),
  available: z.number().int().min(0).optional(),
})

const ReplayInput = z.object({ mode: z.enum(['duplicate', 'stale']), resourceId: z.string().optional() })

const presets = () => Object.entries(SCENARIO_PRESETS).map(([name, p]) => ({ name, description: p.description }))

export const controlHandlers = [
  http.get(api('/__mock/scenario'), () => HttpResponse.json({ active: getScenario(), presets: presets() })),

  http.put(api('/__mock/scenario'), async ({ request }) => {
    const input = await parseBody(request, ScenarioInput)
    setScenario(buildScenario(input.name, input.overrides as never))
    return HttpResponse.json({ active: getScenario() })
  }),

  /** Restaura integralmente o cenário conhecido: banco (seed) + cenário + conexões. */
  http.post(api('/__mock/reset'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { scenario?: string }
    const name = body.scenario && body.scenario in SCENARIO_PRESETS ? body.scenario : DEFAULT_SCENARIO
    clearSettlementTimers()
    await resetDb()
    setScenario(buildScenario(name))
    disconnectAll()
    return HttpResponse.json({ active: getScenario() })
  }),

  /** Altera preço/disponibilidade de um NFT e publica `nft.updated`. */
  http.patch(api('/__mock/nfts/:id'), async ({ request, params }) => {
    const input = await parseBody(request, NftPatch)
    const event = transact((db) => {
      const nft = db.nfts.find((n) => n.id === params.id)
      if (!nft) throw apiError(404, 'NOT_FOUND', 'NFT não encontrado')
      const edition = input.editionId ? nft.editions.find((e) => e.id === input.editionId) : nft.editions.find((e) => e.kind === 'aberta')
      if (!edition) throw apiError(404, 'NOT_FOUND', 'Edição não encontrada')
      if (input.price !== undefined) edition.price = input.price
      if (input.available !== undefined) edition.available = input.available
      bumpNft(nft)
      return publishNftUpdated(nft)
    })
    return HttpResponse.json({ event })
  }),

  /** Reenvia o último evento (duplicado) ou um evento antigo do recurso (fora de ordem). */
  http.post(api('/__mock/realtime/replay'), async ({ request }) => {
    const input = await parseBody(request, ReplayInput)
    const event = input.mode === 'duplicate' ? replayLastEvent() : replayStaleEvent(input.resourceId ?? '')
    if (!event) return apiError(404, 'NOT_FOUND', 'Nenhum evento elegível para reenvio')
    return HttpResponse.json({ event })
  }),

  http.post(api('/__mock/realtime/disconnect'), () => HttpResponse.json({ closed: disconnectAll() })),

  http.get(api('/__mock/realtime'), () => HttpResponse.json(realtimeStats())),

  /** Expira imediatamente as sessões (todas ou de um usuário). */
  http.post(api('/__mock/sessions/expire'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { userId?: string }
    const expired = transact((db) => {
      const targets = db.sessions.filter((s) => !body.userId || s.userId === body.userId)
      targets.forEach((s) => (s.expiresAt = nowIso(-1000)))
      return targets.length
    })
    return HttpResponse.json({ expired })
  }),

  /** Liquida um pedido pendente agora (sem esperar o atraso do cenário). */
  http.post(api('/__mock/orders/:id/settle'), async ({ params }) => {
    if (!getDb().orders.some((o) => o.id === params.id)) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado')
    await settle(String(params.id))
    return HttpResponse.json({ order: getDb().orders.find((o) => o.id === params.id) })
  }),
]
