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
const RELOAD_FLAG = 'kurio:sw-reload'

/**
 * Página recarregada sem o service worker no controle (recarregamento forçado Ctrl+Shift+R ignora o SW): as
 * requisições iriam para a rede real em vez do MSW. Espera o SW assumir (no 1º acesso ele assume logo após ativar);
 * se não assumir e a página veio de um recarregamento, recarrega uma vez. Se ainda assim não assumir, segue — os erros
 * passam a dizer que a API simulada não está ativa.
 */
async function ensureControlled() {
  const sw = navigator.serviceWorker
  if (!sw.controller) {
    await new Promise<void>((resolve) => {
      const done = () => {
        sw.removeEventListener('controllerchange', done)
        resolve()
      }
      sw.addEventListener('controllerchange', done)
      setTimeout(done, 1_500)
    })
  }
  try {
    if (sw.controller) return sessionStorage.removeItem(RELOAD_FLAG)
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type !== 'reload' || sessionStorage.getItem(RELOAD_FLAG)) return
    sessionStorage.setItem(RELOAD_FLAG, '1')
    window.location.reload()
  } catch {
    // sessionStorage indisponível: sem recarregamento automático
  }
}

export async function startMocks() {
  await initDb()
  loadScenario()
  const requested = takePendingScenario()
  if (requested && requested in SCENARIO_PRESETS) setScenario(buildScenario(requested))

  resumePendingOrders()

  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  await ensureControlled()
  return worker
}
