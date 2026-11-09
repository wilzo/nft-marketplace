import { expect, type Page } from '@playwright/test'

export interface MockResponse<T = unknown> {
  status: number
  body: T
}

/**
 * Chama a API pelo próprio navegador (fetch → service worker → handlers MSW).
 * Usado para preparar estado e acionar a API de controle (/api/__mock); as asserções de
 * comportamento devem observar a interface sempre que possível.
 */
export async function mockApi<T = any>(
  page: Page,
  method: string,
  path: string,
  options: { body?: unknown; token?: string; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<MockResponse<T>> {
  return page.evaluate(
    async ({ method, path, options }) => {
      const controller = new AbortController()
      const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null
      try {
        const res = await fetch(`/api${path}`, {
          method,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
            ...options.headers,
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        })
        const text = await res.text()
        return { status: res.status, body: text ? JSON.parse(text) : null }
      } catch (error) {
        return { status: 0, body: { error: String(error) } }
      } finally {
        if (timer) clearTimeout(timer)
      }
    },
    { method, path, options },
  )
}

export async function login(page: Page, email = 'ana@kurio.dev', password = 'Kurio2026!') {
  const res = await mockApi<{ token: string }>(page, 'POST', '/auth/login', { body: { email, password } })
  if (res.status !== 200) throw new Error(`login falhou: ${res.status}`)
  return res.body.token
}

/** Abre a aplicação já com um cenário selecionado (parâmetro ?cenario=). */
export async function openWithScenario(page: Page, scenario = 'sem-latencia', path = '/') {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}cenario=${scenario}`)
  await waitForApp(page)
}

/** Aguarda o MSW e a aplicação ficarem prontos (após goto/reload). */
export async function waitForApp(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.app === 'ready' && !!navigator.serviceWorker?.controller)
}

/** Aguarda o socket.io-client da página estar conectado ao servidor simulado. */
export async function waitForRealtime(page: Page, connections = 1) {
  await expect.poll(async () => (await mockApi(page, 'GET', '/__mock/realtime')).body.connections.length).toBeGreaterThanOrEqual(connections)
}
