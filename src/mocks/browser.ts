import { setupWorker } from 'msw/browser'
import { initDb } from './db/store'
import { resumePendingOrders } from './domain/commerce'
import { handlers } from './handlers'
import { buildScenario, loadScenario, SCENARIO_PRESETS, setScenario } from './scenarios'

export const SCENARIO_QUERY_PARAM = 'cenario'

/**
 * Inicializa a camada de mocks: banco persistido, cenário (da URL ou do localStorage),
 * retomada de pedidos pendentes e o service worker do MSW.
 */
export async function startMocks() {
  await initDb()
  loadScenario()

  const url = new URL(window.location.href)
  const requested = url.searchParams.get(SCENARIO_QUERY_PARAM)
  if (requested && requested in SCENARIO_PRESETS) {
    setScenario(buildScenario(requested))
    url.searchParams.delete(SCENARIO_QUERY_PARAM)
    window.history.replaceState(window.history.state, '', url)
  }

  resumePendingOrders()

  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  return worker
}
