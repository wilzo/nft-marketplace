import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'Kurio2026!'

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024

/** Preenche e envia o formulário de login (modal no desktop, tela cheia no mobile). */
export async function submitLogin(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Login pela interface a partir de /entrar (com destino opcional). */
export async function loginViaUi(page: Page, email: string, redirect?: string) {
  await page.goto(`/entrar${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)
  await submitLogin(page, email)
  await expect(page).not.toHaveURL(/\/entrar/)
}

export const sessionToken = (page: Page) => page.evaluate(() => localStorage.getItem('kurio:session-token'))
