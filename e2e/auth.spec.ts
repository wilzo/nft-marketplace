import { expect, test } from '@playwright/test'
import { isMobile, loginViaUi, sessionToken, submitLogin } from './support/auth'
import { mockApi, openWithScenario } from './support/mock-api'

test.describe('conta e sessão (etapa 4)', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('cadastro: validação no cliente, conflito da API e criação da conta', async ({ page }) => {
    await page.goto('/cadastro')
    const submit = page.getByRole('button', { name: isMobile(page) ? 'Criar perfil' : 'Criar conta', exact: true })

    await submit.click()
    await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Use pelo menos 3 caracteres')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('colecionador.novo')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Senha1234')
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Senha9999')
    await submit.click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()

    // Conflito retornado pela API, associado ao campo
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Senha1234')
    await submit.click()
    const email = page.getByLabel('E-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(email).toBeFocused()

    await email.fill('novo@kurio.dev')
    await submit.click()
    await expect(page).toHaveURL('/')
    expect(await sessionToken(page)).toBeTruthy()
    await page.goto('/favoritos')
    await expect(page.getByRole('heading', { name: 'Favoritos' })).toBeVisible()
  })

  test('login: credenciais inválidas e retorno ao fluxo anterior', async ({ page }) => {
    await page.goto('/favoritos')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Ffavoritos/)

    await submitLogin(page, 'ana@kurio.dev', 'senhaerrada1')
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' })).toBeVisible()

    await submitLogin(page, 'ana@kurio.dev')
    await expect(page).toHaveURL(/\/favoritos$/)
    await expect(page.getByRole('link', { name: /^Emerald Ape #042/ })).toBeVisible()

    // Sessão recuperada após refresh
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Favoritos' })).toBeVisible()
  })

  test('expiração da sessão durante a navegação preserva o contexto para retomada', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/favoritos')
    await mockApi(page, 'POST', '/__mock/sessions/expire')
    await page.reload()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Ffavoritos&expirada=1/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou. Entre novamente para continuar.' })).toBeVisible()
    await submitLogin(page, 'ana@kurio.dev')
    await expect(page).toHaveURL(/\/favoritos$/)
  })

  test('expiração pelo horário da sessão (relógio controlado)', async ({ page }) => {
    await page.clock.install()
    await openWithScenario(page, 'sessao-curta')
    await loginViaUi(page, 'ana@kurio.dev', '/favoritos')
    await expect(page.getByRole('heading', { name: 'Favoritos' })).toBeVisible()
    await page.clock.fastForward('00:31')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Ffavoritos&expirada=1/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    expect(await sessionToken(page)).toBeNull()
  })

  test('logout e troca de usuário não expõem dados do usuário anterior', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/favoritos')
    await expect(page.getByRole('link', { name: /^Emerald Ape #042/ })).toBeVisible()

    if (isMobile(page)) {
      // Mobile: "Sair" no menu do perfil
      await page.goto('/perfil')
      await page.getByRole('button', { name: 'Sair' }).click()
    } else {
      await page.getByRole('button', { name: 'Conta de Ana Colecionadora' }).click()
      await page.getByRole('menuitem', { name: 'Sair' }).click()
      await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    }
    await expect(page).toHaveURL('/')
    expect(await sessionToken(page)).toBeNull()

    await loginViaUi(page, 'bruno@kurio.dev', '/favoritos')
    await expect(page.getByText('Você ainda não favoritou nenhum NFT.')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Emerald Ape #042/ })).toHaveCount(0)
  })

  test('favoritos: atualização otimista, rollback na falha e persistência', async ({ page }) => {
    await loginViaUi(page, 'bruno@kurio.dev', '/nft/sage-nomad-009')
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'favoritos-falha', overrides: { latency: { mode: 'fixed', ms: 800 } } } })

    // Botão de favorito visível (desktop: "Favoritar"/"Favoritado"; mobile: ícone no topo do detalhe)
    const fav = (isMobile(page)
      ? page.getByRole('button', { name: /^(Favoritar|Remover) Sage Nomad #009/ })
      : page.getByRole('button', { name: /^Favorit(ar|ado)$/ })
    )
      .filter({ visible: true })
      .first()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    // Otimista: marcado antes da resposta
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    // Falha → rollback + aviso
    await expect(page.getByText(/Não foi possível favoritar Sage Nomad #009/)).toBeVisible()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')

    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia' } })
    await fav.click()
    await expect(page.getByText('Sage Nomad #009 adicionado aos favoritos.')).toBeVisible()
    await page.reload()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
  })

  test('carrinho do visitante é preservado ao autenticar', async ({ page }) => {
    await page.goto('/nft/golden-beat-207')
    const buy = page.getByRole('button', { name: isMobile(page) ? 'Comprar NFT' : 'COMPRAR', exact: true })
    await buy.click()
    await expect(page).toHaveURL(/\/carrinho$/)

    await loginViaUi(page, 'bruno@kurio.dev')
    const cart = await mockApi(page, 'GET', '/cart', { token: (await sessionToken(page))! })
    expect(cart.body.owner).toBe('user')
    expect(cart.body.items.map((i: { nftId: string }) => i.nftId)).toContain('golden-beat-207')
    expect(await page.evaluate(() => localStorage.getItem('kurio:guest-cart-id'))).toBeNull()
  })
})
