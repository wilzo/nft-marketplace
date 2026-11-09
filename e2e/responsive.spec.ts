import { expect, test, type Page } from '@playwright/test'
import { loginViaUi } from './support/auth'
import { openWithScenario, waitForApp } from './support/mock-api'

/**
 * Larguras exigidas pelo desafio: 390 (mobile), 768 (tablet) e 1440 (desktop).
 * 390 e 1440 já são os projetos do Playwright; aqui todas as telas são conferidas também em 768 px
 * (layout mobile do Figma, abaixo do breakpoint de 64rem): nenhuma rolagem horizontal da página.
 * Zoom (WCAG 1.4.10 e 1.4.4): 320 px de largura = zoom de 400% num monitor de 1280 px; e texto ampliado a 200%.
 */

const PUBLIC = ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar', '/cadastro', '/rota-inexistente', '/secao-indisponivel?secao=criadores']
const PRIVATE = ['/favoritos', '/pagamento', '/perfil', '/carteiras']
const WIDTHS = [768, 390, 1440, 320]

async function expectNoHorizontalOverflow(page: Page, path: string, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${path} em ${label} rola ${overflow}px na horizontal`).toBeLessThanOrEqual(0)
}

/** Abre todas as telas (públicas e, após o login, privadas) e confere que nenhuma rola na horizontal. */
async function checkAllScreens(page: Page, label: string) {
  await openWithScenario(page)
  for (const path of PUBLIC) {
    await page.goto(path)
    await waitForApp(page)
    await expect(page.locator('main').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectNoHorizontalOverflow(page, path, label)
  }
  await loginViaUi(page, 'ana@kurio.dev')
  for (const path of PRIVATE) {
    await page.goto(path)
    await waitForApp(page)
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await page.waitForLoadState('networkidle')
    await expectNoHorizontalOverflow(page, path, label)
  }
}

test.describe('layout responsivo sem rolagem horizontal', () => {
  // A largura é definida no próprio teste: basta rodar em um projeto.
  test.beforeEach(() => test.skip(test.info().project.name !== 'desktop-chromium', 'largura definida no próprio teste'))

  for (const width of WIDTHS) {
    test(`telas públicas e privadas em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await checkAllScreens(page, `${width}px`)
    })
  }

  for (const width of [1280, 390]) {
    test(`texto ampliado a 200% em ${width}px não rola na horizontal`, async ({ page }) => {
      // Fonte padrão do navegador em 200% (como a configuração "Tamanho da fonte"): afeta rem e os breakpoints em rem.
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } })
      await page.setViewportSize({ width, height: 1000 })
      await checkAllScreens(page, `${width}px com texto a 200%`)
    })
  }
})
