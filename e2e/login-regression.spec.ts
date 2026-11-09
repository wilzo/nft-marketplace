import { expect, test, type Page } from '@playwright/test'
import { loginViaUi, sessionToken } from './support/auth'
import { waitForApp } from './support/mock-api'

/**
 * Regressão do bug "não consigo entrar com as credenciais documentadas".
 * Causa: o banco simulado vive em memória em cada aba e era regravado inteiro no localStorage; uma aba antiga
 * apagava as sessões criadas em outra. Também cobre banco/cenário salvos por versões anteriores ou corrompidos.
 */

const ACCOUNTS = ['ana@kurio.dev', 'bruno@kurio.dev']

/** Garante que a sessão sobrevive a refresh e dá acesso a uma rota privada. */
async function expectLoggedIn(page: Page, email: string) {
  expect(await sessionToken(page)).toBeTruthy()
  await page.goto('/perfil')
  await waitForApp(page)
  await expect(page).toHaveURL(/\/perfil$/)
  await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue(email)
}

for (const email of ACCOUNTS) {
  test(`login de ${email} a partir de um banco simulado de versão antiga`, async ({ page }) => {
    // Estado deixado por uma versão anterior da aplicação: schema antigo (hash inválido, campos faltando)
    // e cenário salvo sem os blocos de configuração adicionados depois.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded-old-state')) return
      sessionStorage.setItem('seeded-old-state', '1')
      localStorage.setItem(
        'kurio:mock-db',
        JSON.stringify({ schemaVersion: 1, users: [{ id: 'usr_ana', email: 'ana@kurio.dev', passwordHash: 'antigo', passwordSalt: 'x' }] }),
      )
      localStorage.setItem('kurio:mock-scenario', JSON.stringify({ name: 'sem-latencia', latency: { mode: 'none' } }))
      localStorage.setItem('kurio:session-token', 'token-de-outra-versao')
    })
    await page.goto('/')
    await waitForApp(page)
    await loginViaUi(page, email)
    await expectLoggedIn(page, email)
  })
}

test('login funciona com um banco salvo corrompido na versão atual', async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)
  await page.evaluate(() => {
    const { schemaVersion } = JSON.parse(localStorage.getItem('kurio:mock-db')!)
    localStorage.setItem('kurio:mock-db', JSON.stringify({ schemaVersion }))
  })
  await page.reload()
  await waitForApp(page)
  await loginViaUi(page, 'ana@kurio.dev')
  await expectLoggedIn(page, 'ana@kurio.dev')
})

test('sessão criada numa aba não é apagada por outra aba aberta', async ({ page, context }) => {
  await page.goto('/')
  await waitForApp(page)

  const other = await context.newPage()
  await other.goto('/')
  await waitForApp(other)

  await loginViaUi(page, 'bruno@kurio.dev')

  // A aba antiga grava no banco simulado (visitante adiciona ao carrinho) depois do login na primeira aba.
  const status = await other.evaluate(async () => {
    const res = await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'emerald-ape-042--1-50', quantity: 1 }),
    })
    return res.status
  })
  expect(status).toBeLessThan(300)

  await expectLoggedIn(page, 'bruno@kurio.dev')
  await other.close()
})
