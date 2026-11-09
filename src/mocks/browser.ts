import { setupWorker } from 'msw/browser'
import { takePendingScenario } from './boot-params'
import { initDb } from './db/store'
import { resumePendingOrders } from './domain/commerce'
import { handlers } from './handlers'
import { buildScenario, loadScenario, SCENARIO_PRESETS, setScenario } from './scenarios'

/**
 * Inicializa a camada de mocks: banco persistido, cenário (pendente da URL ou salvo), retomada de pedidos
 * pendentes e o service worker do MSW. As requisições da aplicação aguardam esta promessa (ver lib/boot.ts).
 */
export async function startMocks() {
  await initDb()
  loadScenario()
  const requested = takePendingScenario()
  if (requested && requested in SCENARIO_PRESETS) setScenario(buildScenario(requested))

  resumePendingOrders()

  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  return worker
}
