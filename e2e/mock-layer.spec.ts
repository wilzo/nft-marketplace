import { expect, test } from '@playwright/test'
import { connectWalletApi, login, mockApi, openWithScenario, waitForApp, waitForRealtime } from './support/mock-api'

/**
 * Valida a camada de mocks (etapa 2): contratos REST nos handlers MSW e eventos via socket.io-client.
 * Os cenários de interface completos ficam nos specs de cada fluxo (etapa 8).
 */
test.describe('camada de mocks', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('nft.updated chega pelo Socket.IO e atualiza a interface, ignorando duplicatas e eventos antigos', async ({ page }) => {
    const card = (price: string) => page.getByRole('link', { name: `Emerald Ape #042, ${price} ETH` })
    await expect(card('1.19')).toBeVisible()
    await waitForRealtime(page)

    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '2.5' } })
    await expect(card('2.50')).toBeVisible()

    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '3.125' } })
    await expect(card('3.125')).toBeVisible()

    // Reentrega o evento antigo (versão menor) e o último (mesmo eventId): o estado não regride.
    const stale = await mockApi(page, 'POST', '/__mock/realtime/replay', { body: { mode: 'stale', resourceId: 'emerald-ape-042' } })
    expect(stale.status).toBe(200)
    const dup = await mockApi(page, 'POST', '/__mock/realtime/replay', { body: { mode: 'duplicate' } })
    expect(dup.status).toBe(200)
    await page.waitForTimeout(300)
    await expect(card('3.125')).toBeVisible()
  })

  test('reconecta após desconexão do servidor e volta a receber eventos', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Emerald Ape #042, 1.19 ETH' })).toBeVisible()
    await waitForRealtime(page)
    await mockApi(page, 'POST', '/__mock/realtime/disconnect')
    await expect.poll(async () => (await mockApi(page, 'GET', '/__mock/realtime')).body.connections.length, { timeout: 10_000 }).toBe(1)
    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '1.5' } })
    await expect(page.getByRole('link', { name: 'Emerald Ape #042, 1.50 ETH' })).toBeVisible()
  })

  test('listagem: paginação, filtros combinados, facetas e cenário vazio', async ({ page }) => {
    const all = await mockApi(page, 'GET', '/nfts')
    expect(all.body).toMatchObject({ total: 239, totalPages: 27, page: 1, pageSize: 9 })
    expect(all.body.items).toHaveLength(9)

    const filtered = await mockApi(page, 'GET', '/nfts?category=musica&category=jogos&network=ethereum&sort=preco-asc')
    expect(filtered.status).toBe(200)
    for (const item of filtered.body.items) {
      expect(['musica', 'jogos']).toContain(item.category)
      expect(item.network).toBe('ethereum')
    }

    const invalid = await mockApi(page, 'GET', '/nfts?sort=xyz')
    expect(invalid.status).toBe(422)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')

    expect((await mockApi(page, 'GET', '/nfts/nao-existe')).status).toBe(404)

    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'vazio' } })
    expect((await mockApi(page, 'GET', '/nfts')).body.total).toBe(0)
  })

  test('pedido idempotente: mesma chave recupera o pedido; conteúdo diferente gera conflito', async ({ page }) => {
    const token = await login(page)
    await connectWalletApi(page, token)
    const quote = await mockApi(page, 'POST', '/quotes', { token, body: { network: 'ethereum' } })
    expect(quote.status).toBe(201)
    // Carrinho da Ana reproduz o Figma: 26.83 + 0.016 = 26.846 ETH
    expect(quote.body).toMatchObject({ subtotal: '26.83', networkFee: '0.016', total: '26.846', issues: [] })

    const body = {
      quoteId: quote.body.id,
      walletId: 'wal_ana_primary',
      network: 'ethereum',
      collector: { displayName: 'Ana Colecionadora', username: 'ana.kurio', email: 'ana@kurio.dev', profileName: 'Cofre principal', ensName: 'anakurio', referralCode: 'KURIO-ANA' },
    }
    const headers = { 'Idempotency-Key': 'teste-chave-1' }
    const first = await mockApi(page, 'POST', '/orders', { token, body, headers })
    expect(first.status).toBe(201)
    expect(first.body.status).toBe('pending')

    const again = await mockApi(page, 'POST', '/orders', { token, body, headers })
    expect(again.status).toBe(200)
    expect(again.body.id).toBe(first.body.id)

    const conflict = await mockApi(page, 'POST', '/orders', { token, headers, body: { ...body, network: 'polygon' } })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT')

    await mockApi(page, 'POST', `/__mock/orders/${first.body.id}/settle`)
    const settled = await mockApi(page, 'GET', `/orders/${first.body.id}`, { token })
    expect(settled.body).toMatchObject({ status: 'confirmed', total: '26.846' })
    expect(settled.body.txHash).toMatch(/^0x[0-9a-f]{64}$/)
    // Itens comprados saem do carrinho.
    expect((await mockApi(page, 'GET', '/cart', { token })).body.items).toHaveLength(0)

    // Outro usuário não acessa o pedido.
    const bruno = await login(page, 'bruno@kurio.dev')
    expect((await mockApi(page, 'GET', `/orders/${first.body.id}`, { token: bruno })).status).toBe(403)
  })

  test('timeout após criação: o reenvio com a mesma chave recupera o mesmo pedido', async ({ page }) => {
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia', overrides: { checkout: { orderResponseDelayMs: 2_000 } } } })
    const token = await login(page)
    await connectWalletApi(page, token)
    const quote = await mockApi(page, 'POST', '/quotes', { token, body: {} })
    const body = {
      quoteId: quote.body.id,
      walletId: 'wal_ana_primary',
      network: 'ethereum',
      collector: { displayName: 'Ana', username: 'ana.kurio', email: 'ana@kurio.dev', profileName: 'Cofre principal', ensName: 'anakurio', referralCode: 'KURIO-ANA' },
    }
    const headers = { 'Idempotency-Key': 'teste-timeout' }
    const timedOut = await mockApi(page, 'POST', '/orders', { token, body, headers, timeoutMs: 500 })
    expect(timedOut.status).toBe(0)
    const retry = await mockApi(page, 'POST', '/orders', { token, body, headers })
    expect(retry.status).toBe(200)
    const pending = await mockApi(page, 'GET', '/orders?status=pending', { token })
    expect(pending.body.items).toHaveLength(1)
    expect(pending.body.items[0].id).toBe(retry.body.id)
  })

  test('preço alterado durante a confirmação exige nova cotação', async ({ page }) => {
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'preco-alterado', overrides: { latency: { mode: 'none' } } } })
    await waitForRealtime(page)
    const token = await login(page)
    await connectWalletApi(page, token)
    const quote = await mockApi(page, 'POST', '/quotes', { token, body: {} })
    const body = {
      quoteId: quote.body.id,
      walletId: 'wal_ana_primary',
      network: 'ethereum',
      collector: { displayName: 'Ana', username: 'ana.kurio', email: 'ana@kurio.dev', profileName: 'Cofre principal', ensName: 'anakurio', referralCode: 'KURIO-ANA' },
    }
    const stale = await mockApi(page, 'POST', '/orders', { token, body, headers: { 'Idempotency-Key': 'k1' } })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('QUOTE_STALE')
    expect(stale.body.error.details.quote.issues[0].type).toBe('PRICE_CHANGED')
    // A interface (visitante) também recebeu o novo preço pelo Socket.IO.
    await expect(page.getByRole('link', { name: 'Emerald Ape #042, 1.24 ETH' })).toBeVisible()
  })

  test('cupons, persistência após refresh e reset do cenário', async ({ page }) => {
    const token = await login(page)
    expect((await mockApi(page, 'PUT', '/cart/coupon', { token, body: { code: 'EXPIRADO' } })).body.error.code).toBe('COUPON_EXPIRED')
    expect((await mockApi(page, 'PUT', '/cart/coupon', { token, body: { code: 'NAOEXISTE' } })).body.error.code).toBe('COUPON_INVALID')
    expect((await mockApi(page, 'PUT', '/cart/coupon', { token, body: { code: 'kurio10' } })).body.couponCode).toBe('KURIO10')
    const quote = await mockApi(page, 'POST', '/quotes', { token, body: {} })
    expect(quote.body).toMatchObject({ subtotal: '26.83', discount: '2.683', total: '24.163' })

    await page.reload()
    await waitForApp(page)
    expect((await mockApi(page, 'GET', '/cart', { token })).body.couponCode).toBe('KURIO10')

    await mockApi(page, 'POST', '/__mock/reset')
    expect((await mockApi(page, 'GET', '/auth/session', { token })).status).toBe(401)
    const fresh = await login(page)
    expect((await mockApi(page, 'GET', '/cart', { token: fresh })).body.couponCode).toBeNull()
  })

  test('sessão expirada, credenciais inválidas e queda de conexão', async ({ page }) => {
    expect((await mockApi(page, 'POST', '/auth/login', { body: { email: 'ana@kurio.dev', password: 'errada1' } })).body.error.code).toBe(
      'INVALID_CREDENTIALS',
    )
    const conflict = await mockApi(page, 'POST', '/auth/register', {
      body: { username: 'nova', email: 'ana@kurio.dev', password: 'Senha1234', confirmPassword: 'Senha1234' },
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.fieldErrors.email).toBeTruthy()

    const token = await login(page)

    await mockApi(page, 'POST', '/__mock/sessions/expire')
    const expired = await mockApi(page, 'GET', '/favorites', { token })
    expect(expired.status).toBe(401)
    expect(expired.body.error.code).toBe('SESSION_EXPIRED')

    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'offline' } })
    expect((await mockApi(page, 'GET', '/nfts')).status).toBe(0)
  })
})
