import { expect, test, type Page } from '@playwright/test'
import { isMobile, loginViaUi } from './support/auth'
import { openWithScenario, waitForApp } from './support/mock-api'

/**
 * Seções do Figma fora desta entrega: os links continuam visíveis e levam a uma página que informa que a seção
 * não faz parte desta versão (sem 404, sem página em branco, sem aparentar sucesso), com volta ao catálogo.
 */

async function expectUnavailablePage(page: Page, name: string) {
  await expect(page).toHaveURL(/\/secao-indisponivel\?secao=/)
  await expect(page.getByRole('heading', { level: 1, name: `${name} não faz parte desta versão` })).toBeVisible()
  await expect(page.getByText('Nenhuma ação foi realizada.', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toHaveCount(0)
}

test.describe('links fora do escopo', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('Criadores e Aprenda (header) levam à página informativa e voltam ao catálogo', async ({ page }) => {
    test.skip(isMobile(page), 'o header com Criadores/Aprenda é do desktop')
    const nav = page.getByRole('navigation', { name: 'Principal' })
    for (const name of ['Criadores', 'Aprenda']) {
      const link = nav.getByRole('link', { name })
      await expect(link).toHaveAttribute('href', /\/secao-indisponivel\?secao=/)
      // Teclado: foco + Enter
      await link.focus()
      await page.keyboard.press('Enter')
      await expectUnavailablePage(page, name)
      await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
      await expect(page).toHaveURL(/\/#catalogo$/)
      await waitForApp(page)
    }
  })

  test('itens do rodapé, do login e do Diário da Cunhagem', async ({ page }) => {
    const footer = page.getByRole('contentinfo')
    for (const name of ['Central de ajuda', 'Como comprar NFTs', 'Política do mercado', 'Denunciar item', 'Minha coleção', 'Atividade', 'Estúdio do criador']) {
      await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', /\/secao-indisponivel\?secao=/)
    }
    await footer.getByRole('link', { name: 'Central de ajuda' }).click()
    await expectUnavailablePage(page, 'Central de ajuda')

    // "Lista de interesse" existe: leva aos favoritos (rota privada → login).
    await page.getByRole('contentinfo').getByRole('link', { name: 'Lista de interesse' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Ffavoritos/)

    await page.getByRole('link', { name: 'Esqueceu a senha?' }).click()
    await expectUnavailablePage(page, 'Recuperação de senha')

    await page.goto('/')
    await waitForApp(page)
    await page.getByRole('link', { name: /^Ler mais: / }).first().click()
    await expectUnavailablePage(page, 'Diário da Cunhagem')
  })

  test('menu da conta (Atividade, Ofertas, Arquivos baixados, Suporte)', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/perfil')
    const menu = page.getByRole('navigation', { name: 'Meu perfil' }).first() // o rodapé tem outra coluna "Meu perfil"
    for (const name of ['Atividade', 'Ofertas', 'Arquivos baixados', 'Suporte']) {
      await expect(menu.getByRole('link', { name })).toHaveAttribute('href', /\/secao-indisponivel\?secao=/)
    }
    await menu.getByRole('link', { name: 'Suporte' }).click()
    await expectUnavailablePage(page, 'Suporte')
    // A sessão não é afetada.
    await page.goBack()
    await expect(page).toHaveURL(/\/perfil$/)
  })

  test('seção desconhecida mostra o aviso genérico (não uma 404)', async ({ page }) => {
    await page.goto('/secao-indisponivel?secao=qualquer-coisa')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Seção não disponível nesta versão' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao catálogo' })).toBeVisible()
    if (!isMobile(page)) {
      await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()
    }
  })
})
