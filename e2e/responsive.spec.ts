import { expect, test, type Page } from '@playwright/test'
import { loginViaUi } from './support/auth'
import { openWithScenario, waitForApp } from './support/mock-api'

/**
 * Larguras exigidas pelo desafio: 390 (mobile), 768 (tablet) e 1440 (desktop).
 * 390 e 1440 já são os projetos do Playwright; aqui todas as telas são conferidas também em 768 px
 * (layout mobile do Figma, abaixo do breakpoint de 1024 px): nenhuma rolagem horizontal da página.
 */

const PUBLIC = ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar', '/cadastro', '/rota-inexistente']
const PRIVATE = ['/favoritos', '/pagamento', '/perfil', '/carteiras']
const WIDTHS = [768, 390, 1440]

async function expectNoHorizontalOverflow(page: Page, path: string, width: number) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${path} em ${width}px rola ${overflow}px na horizontal`).toBeLessThanOrEqual(0)
}

test.describe('layout responsivo sem rolagem horizontal', () => {
  // A largura é definida no próprio teste: basta rodar em um projeto.
  test.beforeEach(() => test.skip(test.info().project.name !== 'desktop-chromium', 'largura definida no próprio teste'))

  for (const width of WIDTHS) {
    test(`telas públicas e privadas em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await openWithScenario(page)
      for (const path of PUBLIC) {
        await page.goto(path)
        await waitForApp(page)
        await expect(page.locator('main').first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expectNoHorizontalOverflow(page, path, width)
      }
      await loginViaUi(page, 'ana@kurio.dev')
      for (const path of PRIVATE) {
        await page.goto(path)
        await waitForApp(page)
        await expect(page).toHaveURL(new RegExp(`${path}$`))
        await page.waitForLoadState('networkidle')
        await expectNoHorizontalOverflow(page, path, width)
      }
    })
  }
})
