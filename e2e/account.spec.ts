import { expect, test, type Page } from '@playwright/test'
import { isMobile, loginViaUi } from './support/auth'
import { mockApi, openWithScenario } from './support/mock-api'

/** PNG 1×1 válido (avatar). */
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function pick(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

test.describe('perfil e carteiras (etapa 7)', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('perfil: validação, conflito da API e persistência', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/perfil')
    const name = page.getByLabel('Nome de exibição')
    const username = page.getByLabel('Nome de usuário')
    await expect(name).toHaveValue('Ana Colecionadora')

    await name.fill('A')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Use pelo menos 2 caracteres')).toBeVisible()

    await name.fill('Ana Kurio')
    await username.fill('bruno.mendes')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este nome de usuário já está em uso')).toBeVisible()
    await expect(username).toHaveAttribute('aria-invalid', 'true')

    await username.fill('ana.kurio')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Dados salvos.' })).toBeVisible()
    if (!isMobile(page)) await expect(page.getByRole('button', { name: 'Conta de Ana Kurio' })).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Kurio')
  })

  test('avatar: arquivo inválido, envio e remoção', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/perfil')
    const input = page.locator('#avatar-input')
    await input.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
    await expect(page.getByRole('alert').filter({ hasText: 'Envie uma imagem PNG, JPEG ou WebP.' })).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()

    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByRole('img', { name: 'Sem avatar' })).toBeVisible()
  })

  test('alteração de senha: senha atual incorreta, confirmação e sucesso', async ({ page }) => {
    await loginViaUi(page, 'bruno@kurio.dev', '/perfil')
    const current = page.getByLabel('Senha atual', { exact: true })
    const next = page.getByLabel('Nova senha', { exact: true })
    const confirm = page.getByLabel('Confirmar nova senha', { exact: true })
    const submit = page.getByRole('button', { name: 'Alterar senha' })

    await current.fill('Kurio2026!')
    await next.fill('NovaSenha123')
    await confirm.fill('OutraSenha123')
    await submit.click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()

    await current.fill('SenhaErrada1')
    await confirm.fill('NovaSenha123')
    await submit.click()
    await expect(page.getByText('Senha atual incorreta')).toBeVisible()
    await expect(current).toHaveAttribute('aria-invalid', 'true')

    await current.fill('Kurio2026!')
    await submit.click()
    await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()

    // A nova senha passa a valer; a antiga não.
    expect((await mockApi(page, 'POST', '/auth/login', { body: { email: 'bruno@kurio.dev', password: 'Kurio2026!' } })).status).toBe(401)
    expect((await mockApi(page, 'POST', '/auth/login', { body: { email: 'bruno@kurio.dev', password: 'NovaSenha123' } })).status).toBe(200)
  })

  test('carteiras: cadastro da principal e da secundária com validação e conflito', async ({ page }) => {
    await loginViaUi(page, 'bruno@kurio.dev', '/carteiras')
    await expect(page.getByText('Você ainda não adicionou uma carteira principal.')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar' }).first().click()

    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    const network = primary.getByRole('combobox', { name: 'Rede' })
    await expect(network).toHaveAttribute('aria-invalid', 'true')
    await expect(network).toHaveAccessibleDescription('Selecione uma rede')
    await expect(primary.getByText('Informe um endereço 0x com 40 caracteres hexadecimais')).toBeVisible()

    await primary.getByLabel('Nome de exibição').fill('Bruno Mendes')
    await pick(page, 'Rede', 'Polygon')
    await pick(page, 'Tipo de carteira', 'Coinbase Wallet')
    await primary.getByLabel('Endereço da carteira').fill('0xabc')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Informe um endereço 0x com 40 caracteres hexadecimais')).toBeVisible()

    const address = '0x1111111111111111111111111111111111111111'
    await primary.getByLabel('Endereço da carteira').fill(address)
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.')).toBeVisible()

    // Secundária "igual à principal" (copia os dados, exceto o endereço)
    await page.getByLabel('Igual à carteira principal').check()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(secondary.getByLabel('Nome de exibição')).toHaveValue('Bruno Mendes')
    await expect(secondary.getByLabel('Endereço da carteira')).toHaveValue('')

    await secondary.getByLabel('Endereço da carteira').fill(address)
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está cadastrado na outra carteira')).toBeVisible()

    await secondary.getByLabel('Endereço da carteira').fill('0x2222222222222222222222222222222222222222')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Endereço da carteira')).toHaveValue(address)
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByLabel('Endereço da carteira')).toHaveValue(
      '0x2222222222222222222222222222222222222222',
    )
  })
})
