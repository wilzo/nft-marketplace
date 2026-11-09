import { expect, test, type Page } from '@playwright/test'
import { isMobile, loginViaUi } from './support/auth'
import { mockApi, openWithScenario, waitForRealtime } from './support/mock-api'

const summary = (page: Page, label: string | RegExp) =>
  page.locator('dl > div').filter({ has: page.locator('dt', { hasText: label }) }).locator('dd')

const row = (page: Page, name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) })

async function buyFromDetail(page: Page, path: string) {
  await page.goto(path)
  await page.getByRole('button', { name: isMobile(page) ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
}

test.describe('carrinho e cotação (etapa 5)', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('quantidades, cupom, resumo coerente com a API, persistência e remoção (visitante)', async ({ page }) => {
    await buyFromDetail(page, '/nft/golden-beat-207')
    const item = row(page, 'Golden Beat #207')
    await expect(item.locator('output')).toHaveText('1')
    await expect(summary(page, /^Subtotal$/)).toHaveText('0.99 ETH')
    await expect(summary(page, /^Taxa de rede$/)).toContainText('0.016 ETH')
    await expect(summary(page, /^Total$/)).toHaveText('1.006 ETH')

    await item.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(item.locator('output')).toHaveText('2')
    await expect(summary(page, /^Total$/)).toHaveText('1.996 ETH')

    // Persistência após refresh (carrinho de visitante identificado pelo id salvo)
    await page.reload()
    await expect(row(page, 'Golden Beat #207').locator('output')).toHaveText('2')

    // Cupom: inválido, expirado, válido e remoção
    const coupon = page.getByLabel('Código promocional')
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Código promocional inválido' })).toBeVisible()
    await expect(coupon).toHaveAttribute('aria-invalid', 'true')
    // Cupom recusado não altera o resumo.
    await expect(summary(page, /^Total$/)).toHaveText('1.996 ETH')

    await coupon.fill('EXPIRADO')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Este código promocional expirou' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Código promocional inválido' })).toHaveCount(0)
    await expect(summary(page, /^Total$/)).toHaveText('1.996 ETH')

    await coupon.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByText('Cupom KURIO10 aplicado')).toBeVisible()
    await expect(summary(page, /^Desconto/)).toHaveText('(-) 0.198 ETH')
    await expect(summary(page, /^Total$/)).toHaveText('1.798 ETH')

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(summary(page, /^Total$/)).toHaveText('1.996 ETH')

    await row(page, 'Golden Beat #207').getByRole('button', { name: 'Remover Golden Beat #207 do carrinho' }).click()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('respeita o limite de quantidade da edição', async ({ page }) => {
    await buyFromDetail(page, '/nft/emerald-ape-042?edicao=1-10')
    const item = row(page, 'Emerald Ape #042')
    const plus = item.getByRole('button', { name: 'Aumentar quantidade' })
    while (await plus.isEnabled()) {
      const before = Number(await item.locator('output').textContent())
      await plus.click()
      await expect(item.locator('output')).toHaveText(String(before + 1))
    }
    // Limite = menor entre o disponível e o máximo por pedido da edição (consultado na API)
    const nft = await mockApi(page, 'GET', '/nfts/emerald-ape-042')
    const edition = nft.body.editions.find((e: { kind: string }) => e.kind === '1-10')
    await expect(item.locator('output')).toHaveText(String(Math.min(edition.available, edition.maxPerOrder)))
  })

  test('visitante é levado ao login e retorna ao pagamento', async ({ page }) => {
    await buyFromDetail(page, '/nft/golden-beat-207')
    await expect(summary(page, /^Total$/)).toHaveText('1.006 ETH')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
  })

  test('alteração de preço e de disponibilidade via Socket.IO atualiza o resumo e bloqueia a finalização', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/carrinho')
    await expect(summary(page, /^Total$/)).toHaveText('26.846 ETH')
    await waitForRealtime(page)
    const finish = page.getByRole('button', { name: 'Conectar e finalizar' })
    await expect(finish).toBeEnabled()

    // 1) Preço muda enquanto o carrinho está aberto
    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '1.5' } })
    await expect(page.getByRole('status').filter({ hasText: 'O preço de Emerald Ape #042 mudou enquanto você navegava.' })).toBeVisible()
    await expect(row(page, 'Emerald Ape #042').getByText('Preço alterado de 1.19 para 1.50 ETH.')).toBeVisible()
    await expect(summary(page, /^Subtotal$/)).toHaveText('27.45 ETH')
    await expect(summary(page, /^Total$/)).toHaveText('27.466 ETH')
    await expect(finish).toBeDisabled()
    await expect(page.getByText('Aceite os novos preços para continuar.')).toBeVisible()

    await page.getByRole('button', { name: 'Aceitar novos preços' }).click()
    await expect(page.getByText('Aceite os novos preços para continuar.')).toBeHidden()
    await expect(finish).toBeEnabled()

    // 2) Edição esgota
    await mockApi(page, 'PATCH', '/__mock/nfts/violet-nomad-314', { body: { available: 0 } })
    await expect(row(page, 'Violet Nomad #314').getByText('Esgotado: remova este item para continuar.')).toBeVisible()
    await expect(finish).toBeDisabled()
    await row(page, 'Violet Nomad #314').getByRole('button', { name: 'Remover Violet Nomad #314 do carrinho' }).click()
    await expect(finish).toBeEnabled()
    await expect(summary(page, /^Subtotal$/)).toHaveText('19.11 ETH')
  })

  test('skeleton do resumo durante carregamento lento', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev')
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'lento' } })
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-skeleton')).toBeVisible()
    await expect(summary(page, /^Total$/)).toHaveText('26.846 ETH', { timeout: 15_000 })
  })
})
