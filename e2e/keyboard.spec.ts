import { expect, test } from '@playwright/test'
import { isMobile } from './support/auth'
import { openWithScenario } from './support/mock-api'

/** Cenário 11: navegação por teclado, foco visível, foco em diálogos/drawers e validação de formulários. */
test.describe('teclado e foco', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
    await expect(page.getByRole('link', { name: 'Emerald Ape #042, 1.19 ETH' })).toBeVisible()
  })

  test('link "Pular para o conteúdo" é o primeiro foco e tem foco visível', async ({ page }) => {
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    // Foco visível: contorno definido pelo tema (não removido)
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
    expect(outline).not.toBe('none')
  })

  test('cards do catálogo são alcançáveis por Tab com foco visível', async ({ page }) => {
    const card = page.getByRole('link', { name: 'Emerald Ape #042, 1.19 ETH' })
    await card.focus()
    await expect(card).toBeFocused()
    expect(await card.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
  })

  test('diálogo de busca: foco preso dentro, Escape fecha e devolve o foco ao gatilho', async ({ page }) => {
    test.skip(isMobile(page), 'A busca do mobile é um campo na própria página.')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Termo de busca' })).toBeFocused()

    // Tab circula dentro do diálogo (focus trap)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    // Busca por teclado
    await page.keyboard.press('Enter')
    await page.keyboard.type('Frequency #071')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=Frequency/)
    await expect(page.locator('#catalogo article')).toHaveCount(1)
  })

  test('drawer de filtros (mobile): foco preso, Escape fecha e devolve o foco', async ({ page }) => {
    test.skip(!isMobile(page), 'No desktop os filtros ficam na barra lateral.')
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    // Filtro por teclado (espaço marca a coleção)
    await drawer.getByRole('checkbox', { name: /Música/ }).focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/category=/)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('edição do NFT: grupo de opções navegável com setas', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    const selected = page.getByRole('radio', { name: 'Edição 1/50' })
    await expect(selected).toHaveAttribute('aria-checked', 'true')
    await selected.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Edição ABERTA' })).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/edicao=aberta/)
    await expect(page.getByRole('radio', { name: 'Edição ABERTA' })).toHaveAttribute('aria-checked', 'true')
  })

  test('formulário de login por teclado: erros associados aos campos e foco no primeiro inválido', async ({ page }) => {
    await page.goto('/entrar')
    const email = page.getByRole('textbox', { name: 'E-mail' })
    await expect(email).toBeFocused() // foco inicial no primeiro campo
    await page.keyboard.type('nao-e-email')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter') // envia com Enter a partir da senha (vazia)
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido')
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAccessibleDescription('Informe sua senha')
    await expect(email).toBeFocused()
  })
})
