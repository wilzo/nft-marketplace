import { expect, test, type Page } from '@playwright/test'
import { loginViaUi } from './support/auth'
import { openWithScenario } from './support/mock-api'

/**
 * Regressão visual (cenário do desafio): início, detalhe, carrinho e pagamento, em desktop e mobile.
 * Dados estáveis: cenário "sem-latencia" (seed determinístico), animações desligadas, toasts ocultos,
 * imagens carregadas antes da captura. Baselines versionadas em e2e/visual.spec.ts-snapshots/.
 * Atualizar: npm run test:e2e:update -- e2e/visual.spec.ts
 */

async function stabilize(page: Page) {
  // Toasts e o painel de cenários não fazem parte das telas comparadas
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important} *{caret-color:transparent!important}' })
  // Carrega as imagens lazy (rolagem) e espera as visíveis
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 50))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForFunction(() =>
    [...document.images].filter((i) => i.offsetParent && i.getBoundingClientRect().left < window.innerWidth).every((i) => i.complete && i.naturalWidth > 0),
  )
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
}

const shot = { animations: 'disabled' as const, maxDiffPixelRatio: 0.01 }

test.describe('regressão visual', () => {
  test('início', async ({ page }) => {
    await openWithScenario(page)
    await expect(page.getByRole('link', { name: 'Emerald Ape #042, 1.19 ETH' })).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', shot)
  })

  test('detalhe do NFT', async ({ page }) => {
    await openWithScenario(page, 'sem-latencia', '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', shot)
  })

  test('carrinho', async ({ page }) => {
    await openWithScenario(page)
    await loginViaUi(page, 'ana@kurio.dev', '/carrinho')
    await expect(page.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Total$/ }) })).toContainText('26.846 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', shot)
  })

  test('pagamento', async ({ page }) => {
    await openWithScenario(page)
    await loginViaUi(page, 'ana@kurio.dev', '/pagamento')
    await expect(page.getByTestId('checkout-total')).toHaveText('26.846 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', shot)
  })
})
