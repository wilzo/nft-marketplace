import { delay, http, HttpResponse } from 'msw'
import type { ApiErrorCode } from '@/api/contracts'
import { env } from '@/config/env'
import { api, apiError } from '../lib/http'
import { getScenario, latencyFor, matchFailure } from '../scenarios'

/**
 * Primeiro handler da cadeia: aplica as condições de rede do cenário ativo
 * (latência, queda de conexão, falhas HTTP injetadas) e, se nada se aplicar,
 * não retorna nada — o MSW segue para o handler do recurso.
 * A API de controle (/__mock) nunca sofre essas condições.
 */
export const networkConditions = http.all(api('/*'), async ({ request }) => {
  const url = new URL(request.url)
  const path = url.pathname.slice(env.apiBaseUrl.length)
  if (path.startsWith('/__mock')) return

  const ms = latencyFor(`${request.method} ${url.pathname}${url.search}`)
  if (ms > 0) await delay(ms)

  if (getScenario().offline) return HttpResponse.error()

  const rule = matchFailure(request.method, path)
  if (rule) {
    return apiError(rule.status, rule.code as ApiErrorCode, rule.message ?? 'Serviço temporariamente indisponível. Tente novamente.')
  }
})
