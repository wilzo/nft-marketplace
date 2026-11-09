import { http } from '@/lib/http'

/**
 * Cliente da API de controle do mock (`/api/__mock`). Só é usado pelo painel de cenários
 * (ferramenta de demonstração) — nunca pelos fluxos de negócio.
 */
export interface ScenarioPreset {
  name: string
  description: string
}

export interface ScenarioState {
  active: { name: string; description: string }
  presets: ScenarioPreset[]
}

export const mockControl = {
  scenario: async () => (await http.get<ScenarioState>('/__mock/scenario')).data,
  setScenario: async (name: string) => (await http.put('/__mock/scenario', { name })).data,
  reset: async (scenario?: string) => (await http.post('/__mock/reset', { scenario })).data,
}
