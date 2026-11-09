import { expect, test } from '@playwright/test'

test('a aplicação carrega com a API simulada pelo MSW', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('api-status')).toHaveText(/ok/)
})

test('rota inexistente exibe a página 404', async ({ page }) => {
  await page.goto('/rota-que-nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
