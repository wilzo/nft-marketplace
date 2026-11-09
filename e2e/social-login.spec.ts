import { expect, test, type Page } from '@playwright/test'
import { PASSWORD, sessionToken } from './support/auth'
import { mockApi, openWithScenario, waitForApp } from './support/mock-api'

/**
 * Login social SIMULADO: o "provedor" é a API de demonstração (MSW). Os testes passam pelos handlers
 * reais (/api/auth/oauth/*) — nenhuma resposta é substituída pelo Playwright.
 */

async function openConsent(page: Page, path: '/entrar' | '/cadastro', provider: 'Google' | 'Facebook') {
  await page.goto(path)
  await waitForApp(page)
  await page.getByRole('button', { name: `Continuar com ${provider}` }).click()
  const consent = page.getByRole('dialog', { name: `Entrar com ${provider}` })
  await expect(consent).toBeVisible()
  return consent
}

test.describe('login social simulado (Google/Facebook)', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('sucesso: cria a conta no 1º acesso e entra na mesma conta depois', async ({ page }) => {
    const consent = await openConsent(page, '/cadastro', 'Google')
    // Diálogo acessível: deixa claro que é simulação, foco na 1ª conta, dados compartilhados listados.
    await expect(consent).toContainText('nenhum dado é enviado a serviços externos')
    await expect(consent.getByRole('radio', { name: /Carla Nunes/ })).toBeFocused()
    await expect(consent.getByRole('listitem')).toHaveText(['Nome', 'Endereço de e-mail'])

    await consent.getByRole('button', { name: 'Continuar' }).click()
    await expect(page).not.toHaveURL(/\/cadastro/)
    await expect(page.getByText('Conta criada. Boas-vindas à Kurio!')).toBeVisible()
    const token = await sessionToken(page)
    expect(token).toBeTruthy()

    const profile = await mockApi(page, 'GET', '/profile', { token: token! })
    expect(profile.body).toMatchObject({ email: 'carla.nunes@gmail.example', displayName: 'Carla Nunes' })

    // Sai e entra de novo pelo Google: a conta vinculada é reutilizada (sem criar outra).
    await mockApi(page, 'POST', '/auth/logout', { token: token! })
    await page.evaluate(() => localStorage.removeItem('kurio:session-token'))
    const again = await openConsent(page, '/entrar', 'Google')
    await again.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Olá, Carla Nunes!')).toBeVisible()
    const second = await mockApi(page, 'GET', '/profile', { token: (await sessionToken(page))! })
    expect(second.body.id).toBe(profile.body.id)

    // Conta criada só pelo provedor não tem senha: não entra por e-mail/senha.
    const byPassword = await mockApi(page, 'POST', '/auth/login', { body: { email: 'carla.nunes@gmail.example', password: PASSWORD } })
    expect(byPassword.status).toBe(401)
  })

  test('cancelamento pelo usuário não cria conta nem sessão', async ({ page }) => {
    const consent = await openConsent(page, '/entrar', 'Facebook')
    await consent.getByRole('button', { name: 'Cancelar' }).click()
    await expect(consent).toBeHidden()
    await expect(page.getByRole('alert')).toContainText('Você cancelou o acesso pelo Facebook. Nenhuma conta foi criada ou alterada.')
    await expect(page.getByRole('button', { name: 'Continuar com Facebook' })).toBeFocused()
    expect(await sessionToken(page)).toBeNull()

    // Esc também cancela (decisão enviada à API, que descarta o pedido).
    const again = await openConsent(page, '/entrar', 'Facebook')
    await page.keyboard.press('Escape')
    await expect(again).toBeHidden()
    await expect(page.getByRole('alert')).toContainText('Você cancelou o acesso pelo Facebook')
    expect(await sessionToken(page)).toBeNull()
  })

  test('conflito: e-mail do provedor já tem conta com senha → entrar com a senha', async ({ page }) => {
    const consent = await openConsent(page, '/entrar', 'Google')
    await consent.getByRole('radio', { name: /Ana Colecionadora/ }).check()
    await consent.getByRole('button', { name: 'Continuar' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Já existe uma conta Kurio com o e-mail ana@kurio.dev, criada com senha.')
    expect(await sessionToken(page)).toBeNull()

    await alert.getByRole('button', { name: 'Entrar com senha' }).click()
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('ana@kurio.dev')
    await expect(page.getByLabel('Senha', { exact: true })).toBeFocused()
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).not.toHaveURL(/\/entrar/)
    await expect(page.getByText('Olá, Ana Colecionadora!')).toBeVisible()
  })

  test('cenário oauth-falha: provedor fora do ar mostra o erro sem aparentar sucesso', async ({ page }) => {
    await openWithScenario(page, 'oauth-falha', '/entrar')
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'oauth-falha', overrides: { latency: { mode: 'none' } } } })
    await page.getByRole('button', { name: 'Continuar com Google' }).click()
    await expect(page.getByRole('alert')).toContainText('O provedor de login não respondeu.')
    await expect(page.getByRole('dialog', { name: 'Entrar com Google' })).toHaveCount(0)
    expect(await sessionToken(page)).toBeNull()
  })

  test('pedido de autorização é de uso único', async ({ page }) => {
    const auth = await mockApi(page, 'POST', '/auth/oauth/google/authorize', { body: {} })
    expect(auth.status).toBe(200)
    const body = { requestId: auth.body.requestId, decision: 'allow', subject: 'google-1001' }
    expect((await mockApi(page, 'POST', '/auth/oauth/google', { body })).status).toBe(201)
    const reuse = await mockApi(page, 'POST', '/auth/oauth/google', { body })
    expect(reuse.status).toBe(400)
  })
})
