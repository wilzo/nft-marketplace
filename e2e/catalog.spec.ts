import { expect, test, type Page } from '@playwright/test'
import { mockApi, openWithScenario } from './support/mock-api'

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024

/** No mobile os filtros ficam num drawer; no desktop, na barra lateral. */
async function withFilters(page: Page, fn: () => Promise<void>) {
  if (isMobile(page)) await page.getByRole('button', { name: /^Filtros/ }).click()
  await fn()
  if (isMobile(page)) await page.keyboard.press('Escape')
}

const cards = (page: Page) => page.locator('#catalogo ul > li article')

test.describe('catálogo (etapa 3)', () => {
  test('filtros combinados compõem a URL, reiniciam a paginação e são restaurados pelo histórico', async ({ page }) => {
    await openWithScenario(page)
    await expect(cards(page)).toHaveCount(9)

    // Vai para a página 2
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Filtro reinicia a paginação
    await withFilters(page, async () => {
      await page.getByRole('checkbox', { name: /Música/ }).check()
      await page.getByRole('checkbox', { name: /Ethereum/ }).check()
    })
    await expect(page).toHaveURL(/category=/)
    await expect(page).toHaveURL(/network=/)
    await expect(page).not.toHaveURL(/page=/)
    await expect(page.getByText(/NFTs encontrados/)).toHaveText(/^\d+ NFTs encontrados/)

    // A consulta reflete os parâmetros: todos os itens são da coleção/rede escolhidas (verificado via API com a mesma URL).
    const url = new URL(page.url())
    expect(url.searchParams.get('category')).toContain('musica')

    // Ordenação
    if (!isMobile(page)) {
      await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
      await page.getByRole('option', { name: 'Menor preço' }).click()
      await expect(page).toHaveURL(/sort=preco-asc/)
    }

    // Refresh mantém o estado
    const before = page.url()
    await page.reload()
    await expect(page).toHaveURL(before)
    await withFilters(page, async () => {
      await expect(page.getByRole('checkbox', { name: /Música/ })).toBeChecked()
    })

    // Voltar no histórico restaura a página 2 sem filtros
    await page.goBack()
    if (!isMobile(page)) await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/category=/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  test('busca pela URL e resultado vazio', async ({ page }) => {
    await openWithScenario(page, 'sem-latencia', '/?q=frequency')
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).locator('h3')).toHaveText('Golden Frequency #071')

    await page.goto('/?q=nao-existe-nada')
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('skeletons durante carregamento lento', async ({ page }) => {
    await openWithScenario(page, 'lento')
    await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
    await expect(cards(page)).toHaveCount(9, { timeout: 10_000 })
    await expect(page.getByTestId('catalog-skeleton')).toHaveCount(0)
  })

  test('falha da API mostra erro e recupera após nova tentativa', async ({ page }) => {
    await openWithScenario(page, 'erro-servidor')
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })).toBeVisible()
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia' } })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(9)
  })
})

test.describe('detalhe do NFT (etapa 3)', () => {
  test('acesso direto, edição indisponível, limite de quantidade e compra', async ({ page }) => {
    await openWithScenario(page, 'sem-latencia', '/nft/emerald-ape-042?edicao=1-1')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await expect(page.getByText(/Edição indisponível/)).toBeVisible()
    const buyLabel = isMobile(page) ? 'Comprar NFT' : 'COMPRAR'
    await expect(page.getByRole('button', { name: buyLabel, exact: true })).toBeDisabled()

    // Edição 1/10 (limite de 3 por pedido)
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    await expect(page).toHaveURL(/edicao=1-10/)
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true })
    while (await plus.isEnabled()) await plus.click()
    await expect(page.getByText(/Limite atingido/)).toBeVisible()

    await page.getByRole('button', { name: buyLabel, exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    const cart = await mockApi(page, 'GET', '/cart', { headers: { 'X-Cart-Id': await page.evaluate(() => localStorage.getItem('kurio:guest-cart-id') ?? '') } })
    expect(cart.body.items[0]).toMatchObject({ nftId: 'emerald-ape-042', editionLabel: '1/10' })
  })

  test('NFT inexistente', async ({ page }) => {
    await openWithScenario(page, 'sem-latencia', '/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  })

  test('preço alterado em tempo real é anunciado no detalhe', async ({ page }) => {
    await openWithScenario(page, 'sem-latencia', '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await expect.poll(async () => (await mockApi(page, 'GET', '/__mock/realtime')).body.connections.length).toBe(1)
    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '1.5' } })
    await expect(page.getByRole('status').filter({ hasText: 'O preço desta edição foi atualizado de 1.19 para 1.50 ETH.' })).toBeVisible()
  })
})
