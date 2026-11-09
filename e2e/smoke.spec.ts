import { expect, test } from '@playwright/test'

test('a aplicação carrega o catálogo pela API simulada (MSW)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042, 1.19 ETH' })).toBeVisible()
})

test('rota inexistente exibe a página 404', async ({ page }) => {
  await page.goto('/rota-que-nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
