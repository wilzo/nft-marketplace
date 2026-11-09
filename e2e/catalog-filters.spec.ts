import { expect, test, type Page } from '@playwright/test'
import { mockApi, openWithScenario, waitForApp } from './support/mock-api'

/**
 * Regressão dos filtros do catálogo ("todos os NFTs"): cada filtro, combinações, formatos de URL,
 * histórico/refresh, respostas fora de ordem e teclado — desktop (barra lateral) e mobile (drawer).
 * O total exibido é sempre comparado ao da API (handlers MSW) para os mesmos parâmetros.
 */

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024
const announced = (page: Page) => page.getByText(/NFTs encontrados\./)

async function openFilters(page: Page) {
  if (!isMobile(page)) return page.getByRole('complementary', { name: 'Filtros do catálogo' })
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  return drawer
}

async function closeFilters(page: Page) {
  if (!isMobile(page)) return
  // O Escape pode chegar durante a animação de abertura: repete até o drawer fechar.
  await expect(async () => {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 1_000 })
  }).toPass({ timeout: 8_000 })
}

/** Total da API para os parâmetros (arrays repetidos, como o cliente envia). */
async function apiTotal(page: Page, params: Record<string, string | string[] | undefined>) {
  const qs = new URLSearchParams({ pageSize: '9' })
  for (const [k, v] of Object.entries(params)) for (const item of [v ?? []].flat()) qs.append(k, item)
  const res = await mockApi(page, 'GET', `/nfts?${qs}`)
  expect(res.status).toBe(200)
  return res.body.total as number
}

async function expectTotal(page: Page, total: number) {
  await expect(announced(page)).toHaveText(new RegExp(`^${total} NFTs encontrados\\.`))
  await expect(page.getByText('Atualizando resultados…')).toHaveCount(0)
}

test.describe('filtros do catálogo', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('cada coleção e cada rede isoladamente', async ({ page }) => {
    const filters = await openFilters(page)
    for (const group of ['Coleções', 'Rede']) {
      const boxes = filters.getByRole('group', { name: group }).getByRole('checkbox')
      await expect(boxes.first()).toBeAttached() // facetas carregadas
      const count = await boxes.count()
      expect(count).toBeGreaterThan(2)
      for (let i = 0; i < count; i++) {
        const box = boxes.nth(i)
        await box.check({ force: true })
        await expect(box).toBeChecked()
        // Sem outros filtros, o total é a contagem exibida ao lado do item.
        const label = await box.evaluate((el) => el.closest('label')!.textContent!)
        const expected = Number(/\((\d+)\)/.exec(label)![1])
        await expectTotal(page, expected)
        await expect(page).not.toHaveURL(/page=/)
        await box.uncheck({ force: true })
        await expect(box).not.toBeChecked()
      }
    }
    await closeFilters(page)
  })

  test('combinações com faixa de preço, aba, ordenação, busca e paginação', async ({ page }) => {
    // Começa na página 2: qualquer filtro volta à página 1.
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)

    const filters = await openFilters(page)
    await filters.getByRole('checkbox', { name: /Arte digital/ }).check({ force: true })
    await expect(page).not.toHaveURL(/page=/)
    await filters.getByRole('checkbox', { name: /Fotografia/ }).check({ force: true })
    await filters.getByRole('checkbox', { name: /Ethereum/ }).check({ force: true })
    const min = filters.getByRole('slider', { name: 'Preço mínimo' })
    await min.focus()
    for (let i = 0; i < 50; i++) await page.keyboard.press('ArrowRight')
    await filters.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page).toHaveURL(/minPrice=/)
    await closeFilters(page)

    const url = new URL(page.url())
    const minPrice = JSON.parse(url.searchParams.get('minPrice')!) as string
    await expectTotal(page, await apiTotal(page, { category: ['arte-digital', 'fotografia'], network: ['ethereum'], minPrice }))

    await page.getByRole('button', { name: 'Novos lançamentos' }).click()
    await expectTotal(page, await apiTotal(page, { category: ['arte-digital', 'fotografia'], network: ['ethereum'], minPrice, tab: 'novos' }))

    if (!isMobile(page)) {
      await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
      await page.getByRole('option', { name: 'Maior preço' }).click()
      await expect(page).toHaveURL(/sort=preco-desc/)
      await expect(page.getByText('Atualizando resultados…')).toHaveCount(0)
      // Ordenação aplicada: preços da página em ordem decrescente.
      // Preço atual = primeiro elemento cujo texto é só "<valor> ETH" (o riscado é o preço anterior).
      const prices = await page.locator('#catalogo ul > li article').evaluateAll((els) =>
        els.map((el) => {
          const text = [...el.querySelectorAll('*')].map((n) => n.textContent?.trim() ?? '').find((t) => /^[\d.]+ ETH$/.test(t))
          return Number(text?.split(' ')[0])
        }),
      )
      expect(prices).toEqual([...prices].sort((a, b) => b - a))
    }

    // Combinação sem resultado → estado vazio com ação de limpar.
    await page.goto('/?q=Emerald&network=%5B%22solana%22%5D')
    await waitForApp(page)
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(page).toHaveURL(/\/$/)
    await expectTotal(page, 239)
  })

  test('URL em qualquer formato aplica os filtros; parâmetros inválidos caem no padrão', async ({ page }) => {
    const cases: { query: string; expected: Record<string, string | string[]>; checked: RegExp[] }[] = [
      // Valor único e parâmetros repetidos (formato da API) — antes eram ignorados.
      { query: '?category=arte-digital', expected: { category: 'arte-digital' }, checked: [/Arte digital/] },
      { query: '?network=polygon', expected: { network: 'polygon' }, checked: [/Polygon/] },
      { query: '?category=arte-digital&category=fotografia', expected: { category: ['arte-digital', 'fotografia'] }, checked: [/Arte digital/, /Fotografia/] },
      // Um valor inválido não descarta os válidos.
      { query: '?category=%5B%22arte-digital%22%2C%22nao-existe%22%5D', expected: { category: 'arte-digital' }, checked: [/Arte digital/] },
      // Preço numérico e faixa invertida (corrigida).
      { query: '?minPrice=5', expected: { minPrice: '5' }, checked: [] },
      { query: '?minPrice=%225%22&maxPrice=%221%22', expected: { minPrice: '1', maxPrice: '5' }, checked: [] },
      // Inválidos → padrão (catálogo completo), sem erro.
      { query: '?category=%5B%22nao-existe%22%5D&page=abc&sort=xyz&tab=abc&minPrice=abc&foo=bar', expected: {}, checked: [] },
      { query: '?page=-1&network=%5B%5D&q=', expected: {}, checked: [] },
    ]
    for (const c of cases) {
      await page.goto(`/${c.query}`)
      await waitForApp(page)
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expectTotal(page, await apiTotal(page, c.expected))
      const filters = await openFilters(page)
      for (const name of c.checked) await expect(filters.getByRole('checkbox', { name })).toBeChecked()
      await closeFilters(page)
    }
    // Página além do fim: aviso com volta à 1ª página (não é erro).
    await page.goto('/?category=%5B%22arte-digital%22%5D&page=99')
    await waitForApp(page)
    await expect(page.getByText('Esta página não existe.')).toBeVisible()
    await page.getByRole('button', { name: 'Ir para a primeira página' }).click()
    await expectTotal(page, 33)
  })

  test('voltar, avançar e refresh restauram os filtros', async ({ page }) => {
    let filters = await openFilters(page)
    await filters.getByRole('checkbox', { name: /Música/ }).check({ force: true })
    const music = await apiTotal(page, { category: 'musica' })
    await expectTotal(page, music)
    await filters.getByRole('checkbox', { name: /Solana/ }).check({ force: true })
    const both = await apiTotal(page, { category: 'musica', network: 'solana' })
    await expectTotal(page, both)
    await closeFilters(page)

    await page.goBack()
    await expectTotal(page, music)
    await page.goBack()
    await expectTotal(page, 239)
    await page.goForward()
    await page.goForward()
    await expectTotal(page, both)

    await page.reload()
    await waitForApp(page)
    await expectTotal(page, both)
    filters = await openFilters(page)
    await expect(filters.getByRole('checkbox', { name: /Música/ })).toBeChecked()
    await expect(filters.getByRole('checkbox', { name: /Solana/ })).toBeChecked()
    await closeFilters(page)
  })

  test('respostas fora de ordem não mostram dados de filtros antigos', async ({ page }) => {
    await openWithScenario(page, 'latencia-variavel')
    const filters = await openFilters(page)
    for (const name of [/Arte digital/, /Fotografia/, /Música/, /Polygon/, /Fotografia/]) {
      await filters.getByRole('checkbox', { name }).check({ force: true }).catch(() => filters.getByRole('checkbox', { name }).uncheck({ force: true }))
    }
    await closeFilters(page)
    const url = new URL(page.url())
    const params = {
      category: JSON.parse(url.searchParams.get('category') ?? '[]') as string[],
      network: JSON.parse(url.searchParams.get('network') ?? '[]') as string[],
    }
    await expectTotal(page, await apiTotal(page, params))
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('teclado: filtros operáveis por Tab/Espaço e foco do drawer no mobile', async ({ page }) => {
    if (isMobile(page)) {
      const trigger = page.getByRole('button', { name: /^Filtros/ })
      await trigger.focus()
      await page.keyboard.press('Enter')
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()
      // Foco preso no drawer
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab')
        expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      }
      const box = drawer.getByRole('checkbox', { name: /Fotografia/ })
      await box.focus()
      await page.keyboard.press('Space')
      await expect(box).toBeChecked()
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
      await expect(trigger).toBeFocused()
    } else {
      const box = page.getByRole('complementary', { name: 'Filtros do catálogo' }).getByRole('checkbox', { name: /Fotografia/ })
      await box.focus()
      await page.keyboard.press('Space')
      await expect(box).toBeChecked()
      await expect(box).toBeFocused()
      await page.keyboard.press('Space')
      await expect(box).not.toBeChecked()
    }
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
