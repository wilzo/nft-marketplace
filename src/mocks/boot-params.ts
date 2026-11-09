/**
 * Parâmetros de demonstração lidos ANTES de o Router ser criado (síncrono, sem importar o MSW):
 *  - `?cenario=<nome>`: cenário da simulação, aplicado quando o MSW sobe;
 *  - `?painel=1|0`: exibe/oculta o painel de cenários (não faz parte do layout do Figma).
 * Os parâmetros são removidos da URL para não interferir no estado da página (busca, filtros...).
 */
export const PENDING_SCENARIO_KEY = 'kurio:pending-scenario'
export const PANEL_STORAGE_KEY = 'kurio:scenario-panel'

export function consumeBootParams() {
  const url = new URL(window.location.href)
  const scenario = url.searchParams.get('cenario')
  const panel = url.searchParams.get('painel')
  if (!scenario && !panel) return
  try {
    if (scenario) sessionStorage.setItem(PENDING_SCENARIO_KEY, scenario)
    if (panel === '1') localStorage.setItem(PANEL_STORAGE_KEY, '1')
    if (panel === '0') localStorage.removeItem(PANEL_STORAGE_KEY)
  } catch {
    // armazenamento indisponível
  }
  url.searchParams.delete('cenario')
  url.searchParams.delete('painel')
  window.history.replaceState(window.history.state, '', url)
}

export function takePendingScenario() {
  try {
    const name = sessionStorage.getItem(PENDING_SCENARIO_KEY)
    sessionStorage.removeItem(PENDING_SCENARIO_KEY)
    return name
  } catch {
    return null
  }
}
