import { expect, test, type Page } from '@playwright/test'
import { isMobile, loginViaUi, PASSWORD, sessionToken, submitLogin } from './support/auth'
import { connectWalletApi, login, mockApi, openWithScenario, waitForApp, waitForRealtime } from './support/mock-api'

/**
 * Auditoria das APIs simuladas (pagamento, carteiras, autenticação, consistência REST × eventos).
 * REST passa pelos handlers MSW; tempo real pelo socket.io-client da página. Nada é interceptado pelo Playwright.
 */

const RECEIPT = 'Seus NFTs agora estão na sua carteira'
const PENDING = 'Aguardando confirmação do pagamento'

const orderIdFrom = (page: Page) => /\/pedidos\/(ord_\d+)/.exec(page.url())?.[1] ?? ''
const token = async (page: Page) => (await sessionToken(page))!

async function openCollector(page: Page) {
  if (isMobile(page)) await page.getByText('Dados do colecionador').click()
}

/** Login da Ana → pagamento → conecta MetaMask → revisão → confirma. Devolve o id do pedido. */
async function placeOrderViaUi(page: Page) {
  await loginViaUi(page, 'ana@kurio.dev', '/pagamento')
  await expect(page.getByTestId('checkout-total')).toHaveText('26.846 ETH')
  await page.getByRole('radio', { name: 'MetaMask' }).check()
  await expect(page.getByText('Carteira conectada via MetaMask.')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
  return orderIdFrom(page)
}

/** Pedido criado direto pela API (para preparar estado). */
async function placeOrderViaApi(page: Page, userToken: string) {
  await connectWalletApi(page, userToken)
  // Preços alterados por testes anteriores ao pedido precisam ser aceitos (regra do servidor).
  await mockApi(page, 'POST', '/cart/acknowledge', { token: userToken })
  const quote = await mockApi(page, 'POST', '/quotes', { token: userToken, body: { network: 'ethereum' } })
  const order = await mockApi(page, 'POST', '/orders', {
    token: userToken,
    headers: { 'Idempotency-Key': `prep-${Date.now()}` },
    body: {
      quoteId: quote.body.id,
      walletId: 'wal_ana_primary',
      network: 'ethereum',
      collector: { displayName: 'Ana', username: 'ana.kurio', email: 'ana@kurio.dev', profileName: 'Cofre principal', ensName: 'anakurio', referralCode: 'KURIO-ANA' },
    },
  })
  expect(order.status).toBe(201)
  return order.body as { id: string; number: string }
}

test.describe('APIs simuladas: pagamento, carteiras, sessão e eventos', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
    // Liquidação só pela API de controle: o tempo do pagamento simulado fica sob controle do teste.
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia', overrides: { checkout: { settleDelayMs: 600_000 } } } })
  })

  test('pagamento: pendente até a simulação confirmar; recibo e referência vêm da API; só os itens comprados saem do carrinho', async ({ page }) => {
    const id = await placeOrderViaUi(page)
    await expect(page.getByRole('heading', { name: PENDING })).toBeVisible()
    await expect(page.getByText(RECEIPT)).toHaveCount(0)
    expect((await mockApi(page, 'GET', `/orders/${id}`, { token: await token(page) })).body.status).toBe('pending')

    // Item adicionado ao carrinho DEPOIS do pedido não faz parte da compra.
    const added = await mockApi(page, 'POST', '/cart/items', {
      token: await token(page),
      body: { nftId: 'golden-beat-207', editionId: 'golden-beat-207--1-50', quantity: 1 },
    })
    expect(added.status).toBeLessThan(300)

    await waitForRealtime(page)
    await mockApi(page, 'POST', `/__mock/orders/${id}/settle`)
    await expect(page.getByRole('heading', { name: RECEIPT })).toBeVisible()

    // Referência e link de exploração exibidos são os da resposta simulada.
    const order = (await mockApi(page, 'GET', `/orders/${id}`, { token: await token(page) })).body
    expect(order).toMatchObject({ status: 'confirmed', total: '26.846' })
    await expect(page.getByTitle(order.txHash)).toBeVisible()
    await expect(page.getByRole('link', { name: /Ver no Etherscan/ })).toHaveAttribute('href', order.explorerUrl)

    // Carrinho: os 3 itens comprados saíram; o item adicionado depois continua.
    const cart = (await mockApi(page, 'GET', '/cart', { token: await token(page) })).body
    expect(cart.items.map((i: { nftId: string; quantity: number }) => [i.nftId, i.quantity])).toEqual([['golden-beat-207', 1]])

    // Terminal não regride: evento duplicado e refresh mantêm o recibo; o recibo é snapshot do pedido.
    await mockApi(page, 'POST', '/__mock/realtime/replay', { body: { mode: 'duplicate' } })
    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '9' } })
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: RECEIPT })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Emerald Ape #042' })).toContainText('2.38 ETH')
    expect((await mockApi(page, 'GET', `/orders/${id}`, { token: await token(page) })).body).toMatchObject({ status: 'confirmed', version: order.version })
  })

  test('pagamento recusado é terminal e não regride', async ({ page }) => {
    await mockApi(page, 'PUT', '/__mock/scenario', {
      body: { name: 'pagamento-recusado', overrides: { latency: { mode: 'none' }, checkout: { settleDelayMs: 600_000 } } },
    })
    const id = await placeOrderViaUi(page)
    await expect(page.getByRole('heading', { name: PENDING })).toBeVisible()
    await mockApi(page, 'POST', `/__mock/orders/${id}/settle`)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    // Liquidar de novo não muda um pedido terminal.
    await mockApi(page, 'POST', `/__mock/orders/${id}/settle`)
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText(RECEIPT)).toHaveCount(0)
  })

  test('tempo-real-fora: pedido pendente é confirmado pelo polling REST', async ({ page }) => {
    await mockApi(page, 'PUT', '/__mock/scenario', {
      body: { name: 'tempo-real-fora', overrides: { latency: { mode: 'none' }, checkout: { settleDelayMs: 600_000 } } },
    })
    await page.reload()
    await waitForApp(page)
    const id = await placeOrderViaUi(page)
    await expect(page.getByRole('heading', { name: PENDING })).toBeVisible()
    expect((await mockApi(page, 'GET', '/__mock/realtime')).body.connections).toHaveLength(0)

    await mockApi(page, 'POST', `/__mock/orders/${id}/settle`)
    // Sem Socket.IO, o polling de 5 s do pedido pendente busca o estado novo pela API.
    await expect(page.getByRole('heading', { name: RECEIPT })).toBeVisible({ timeout: 12_000 })
    expect((await mockApi(page, 'GET', '/orders', { token: await token(page) })).body.items).toHaveLength(1)
  })

  test('queda do Socket.IO com pedido pendente: o evento perdido é reconciliado via REST, sem nova compra', async ({ page }) => {
    const id = await placeOrderViaUi(page)
    await waitForRealtime(page)

    // Servidor de eventos cai: a liquidação acontece enquanto o cliente está desconectado (evento perdido).
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'tempo-real-fora', overrides: { latency: { mode: 'none' }, checkout: { settleDelayMs: 600_000 } } } })
    await mockApi(page, 'POST', '/__mock/realtime/disconnect')
    await expect.poll(async () => (await mockApi(page, 'GET', '/__mock/realtime')).body.connections.length).toBe(0)
    await mockApi(page, 'POST', `/__mock/orders/${id}/settle`)

    // Servidor volta: o cliente reconecta, invalida os dados e busca o pedido pela API.
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia', overrides: { checkout: { settleDelayMs: 600_000 } } } })
    await expect(page.getByRole('heading', { name: RECEIPT })).toBeVisible({ timeout: 12_000 })
    expect((await mockApi(page, 'GET', '/orders', { token: await token(page) })).body.items).toHaveLength(1)
  })

  test('carteira: rede escolhida, conexão, desconexão pela API e pedido sem conexão recusado pelo servidor', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/pagamento')
    await openCollector(page)
    await page.getByRole('combobox', { name: 'Rede' }).click()
    await page.getByRole('option', { name: 'Polygon' }).click()
    await expect(page.getByRole('listbox')).toBeHidden()

    await page.getByRole('radio', { name: 'MetaMask' }).check()
    await expect(page.getByText('Carteira conectada via MetaMask.')).toBeVisible()
    const quote = await mockApi(page, 'POST', '/quotes', { token: await token(page), body: { network: 'polygon' } })
    const body = {
      quoteId: quote.body.id,
      walletId: 'wal_ana_primary',
      network: 'polygon',
      collector: { displayName: 'Ana', username: 'ana.kurio', email: 'ana@kurio.dev', profileName: 'Cofre principal', ensName: 'anakurio', referralCode: 'KURIO-ANA' },
    }
    // A conexão é por rede: conectada na Polygon, um pedido na Ethereum é recusado.
    const otherNetwork = await mockApi(page, 'POST', '/orders', {
      token: await token(page),
      headers: { 'Idempotency-Key': 'rede-errada' },
      body: { ...body, network: 'ethereum' },
    })
    expect(otherNetwork.body.error?.code).toBe('WALLET_NOT_CONNECTED')

    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByText('Carteira conectada via MetaMask.')).toBeHidden()
    const afterDisconnect = await mockApi(page, 'POST', '/orders', { token: await token(page), headers: { 'Idempotency-Key': 'sem-conexao' }, body })
    expect(afterDisconnect.status).toBe(409)
    expect(afterDisconnect.body.error.code).toBe('WALLET_NOT_CONNECTED')
    expect((await mockApi(page, 'GET', '/orders', { token: await token(page) })).body.items).toHaveLength(0)
  })

  test('403: um usuário não vê o pedido de outro (API e interface)', async ({ page }) => {
    const ana = await login(page)
    const order = await placeOrderViaApi(page, ana)

    await loginViaUi(page, 'bruno@kurio.dev')
    const bruno = await token(page)
    expect((await mockApi(page, 'GET', `/orders/${order.id}`, { token: bruno })).status).toBe(403)
    expect((await mockApi(page, 'GET', '/orders', { token: bruno })).body.items).toHaveLength(0)

    await page.goto(`/pedidos/${order.id}`)
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()
    await expect(page.getByText('Você não tem permissão para ver este pedido')).toBeVisible()
    await expect(page.getByText(order.number)).toHaveCount(0)
    await expect(page.getByText('26.846')).toHaveCount(0)
  })

  test('sessão expira durante o checkout: login devolve ao pagamento com o rascunho preservado', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/pagamento')
    await openCollector(page)
    await page.getByLabel('Nome do perfil').fill('Rascunho do teste')

    await mockApi(page, 'POST', '/__mock/sessions/expire')
    await page.reload()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento&expirada=1/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()

    await submitLogin(page, 'ana@kurio.dev', PASSWORD)
    await expect(page).toHaveURL(/\/pagamento$/)
    await openCollector(page)
    await expect(page.getByLabel('Nome do perfil')).toHaveValue('Rascunho do teste')
  })

  test('senhas nunca ficam em claro no banco simulado', async ({ page }) => {
    const reg = await mockApi(page, 'POST', '/auth/register', {
      body: { username: 'senha.teste', email: 'senha@kurio.dev', password: 'SenhaSecreta123', confirmPassword: 'SenhaSecreta123' },
    })
    expect(reg.status).toBe(201)
    const raw = (await page.evaluate(() => localStorage.getItem('kurio:mock-db')))!
    expect(raw).not.toContain(PASSWORD)
    expect(raw).not.toContain('SenhaSecreta123')
    const users = JSON.parse(raw).users as { email: string; passwordHash: string; passwordSalt: string }[]
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^[A-Za-z0-9+/]{43}=$/) // PBKDF2-SHA256, 32 bytes em base64
      expect(u.passwordSalt.length).toBeGreaterThan(0)
    }
  })

  test('mudanças da simulação aparecem iguais no REST e nos eventos (nft.updated e order.updated)', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await waitForApp(page)
    await waitForRealtime(page)

    const patched = await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '3.21', available: 7 } })
    const event = patched.body.event
    expect(event).toMatchObject({ type: 'nft.updated', resource: { type: 'nft', id: 'emerald-ape-042' }, data: { price: '3.21' } })
    const rest = (await mockApi(page, 'GET', '/nfts/emerald-ape-042')).body
    expect(rest.version).toBe(event.version)
    // Cada edição do evento (preço e estoque) é igual à do REST; `data.available` é o total das edições.
    type Ed = { id: string; price: string; available: number }
    expect(event.data.editions.find((e: Ed) => e.id === event.data.defaultEditionId)).toMatchObject({ price: '3.21', available: 7 })
    for (const e of event.data.editions as Ed[]) expect(rest.editions.find((r: Ed) => r.id === e.id)).toMatchObject({ price: e.price, available: e.available })
    expect(event.data.available).toBe(rest.editions.reduce((sum: number, e: Ed) => sum + e.available, 0))
    // O evento chegou à interface pelo Socket.IO.
    await expect(page.getByText('3.21 ETH', { exact: true }).filter({ visible: true }).first()).toBeVisible()

    // Evento antigo reentregue não desfaz a mudança.
    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '3.5' } })
    await expect(page.getByText('3.50 ETH', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    expect((await mockApi(page, 'POST', '/__mock/realtime/replay', { body: { mode: 'stale', resourceId: 'emerald-ape-042' } })).status).toBe(200)
    await page.waitForTimeout(300)
    await expect(page.getByText('3.50 ETH', { exact: true }).filter({ visible: true }).first()).toBeVisible()

    // order.updated: o estado da liquidação é o mesmo no REST e no evento.
    const ana = await login(page)
    const order = await placeOrderViaApi(page, ana)
    const settled = (await mockApi(page, 'POST', `/__mock/orders/${order.id}/settle`)).body.order
    const restOrder = (await mockApi(page, 'GET', `/orders/${order.id}`, { token: ana })).body
    expect(restOrder).toMatchObject({ status: settled.status, txHash: settled.txHash, version: settled.version })
  })
})
