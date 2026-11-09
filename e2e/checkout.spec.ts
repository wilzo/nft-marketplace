import { expect, test, type Page } from '@playwright/test'
import { isMobile, loginViaUi, sessionToken } from './support/auth'
import { mockApi, openWithScenario, waitForApp, waitForRealtime } from './support/mock-api'

async function goToCheckout(page: Page) {
  await loginViaUi(page, 'ana@kurio.dev', '/pagamento')
  await expect(page.getByTestId('checkout-total')).toHaveText('26.846 ETH')
}

/** "Carteira e rede": escolher o provedor conecta a carteira cadastrada (simulação). */
async function connectWallet(page: Page) {
  await page.getByRole('radio', { name: 'MetaMask' }).check()
  await expect(page.getByText('Carteira conectada via MetaMask.')).toBeVisible()
}

/** Mobile: os dados do colecionador ficam recolhidos (estado não desenhado no frame). */
async function openCollector(page: Page) {
  if (isMobile(page)) await page.getByText('Dados do colecionador').click()
}

async function openReview(page: Page) {
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog).toBeVisible()
  return dialog
}

const orderIdFrom = (page: Page) => /\/pedidos\/(ord_\d+)/.exec(page.url())?.[1] ?? ''
const orders = async (page: Page) => (await mockApi(page, 'GET', '/orders', { token: (await sessionToken(page))! })).body.items as { id: string; status: string }[]

test.describe('pagamento, pedidos e tempo real (etapa 6)', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('compra completa do catálogo ao recibo confirmado (snapshot imutável)', async ({ page }) => {
    await loginViaUi(page, 'ana@kurio.dev', '/nft/golden-beat-207')
    await page.getByRole('button', { name: isMobile(page) ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByTestId('checkout-total')).toHaveText('27.836 ETH')

    const dialog = await openReview(page)
    await expect(dialog.getByTestId('checkout-total')).toHaveText('27.836 ETH')
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()

    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    // A confirmação só aparece depois que a simulação confirma (order.updated via Socket.IO)
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toHaveCount(0)
    await mockApi(page, 'POST', `/__mock/orders/${orderIdFrom(page)}/settle`)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByText('Transação confirmada na Ethereum.', { exact: false })).toBeVisible()

    // Itens comprados saíram do carrinho
    const cart = await mockApi(page, 'GET', '/cart', { token: (await sessionToken(page))! })
    expect(cart.body.items).toHaveLength(0)

    // Recibo é snapshot: alteração posterior de preço não muda os valores
    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '9' } })
    await page.reload()
    await expect(page.getByRole('listitem').filter({ hasText: 'Emerald Ape #042' })).toContainText('2.38 ETH')
    await expect(page.getByText('27.836 ETH').first()).toBeVisible()
  })

  test('validação do formulário e exigência de carteira conectada', async ({ page }) => {
    await goToCheckout(page)
    await openCollector(page)
    await page.getByLabel('Nome do perfil').fill('')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Informe o nome do perfil')).toBeVisible()
    await expect(page.getByLabel('Nome do perfil')).toBeFocused()

    await page.getByLabel('Nome do perfil').fill('Cofre principal')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Escolha uma opção em "Carteira e rede" para conectar a carteira.' })).toBeVisible()
  })

  test('carteira: recusa da conexão e desconexão', async ({ page }) => {
    await goToCheckout(page)
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'carteira-recusada', overrides: { latency: { mode: 'none' } } } })
    await page.getByRole('radio', { name: 'MetaMask' }).check()
    await expect(page.getByRole('alert').filter({ hasText: 'A conexão foi recusada na carteira' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'MetaMask' })).not.toBeChecked()

    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia' } })
    await connectWallet(page)
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByText('Carteira conectada via MetaMask.')).toBeHidden()
    await expect(page.getByRole('radio', { name: 'MetaMask' })).not.toBeChecked()
  })

  test('pagamento recusado preserva os itens do carrinho', async ({ page }) => {
    await goToCheckout(page)
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'pagamento-recusado', overrides: { latency: { mode: 'none' } } } })
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/pedidos\//)
    await mockApi(page, 'POST', `/__mock/orders/${orderIdFrom(page)}/settle`)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText('Seus itens continuam no carrinho.', { exact: false })).toBeVisible()
    const cart = await mockApi(page, 'GET', '/cart', { token: (await sessionToken(page))! })
    expect(cart.body.items).toHaveLength(3)
  })

  test('clique repetido não duplica o pedido', async ({ page }) => {
    await goToCheckout(page)
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'padrao', overrides: { latency: { mode: 'fixed', ms: 700 } } } })
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    // Durante o envio o botão fica desabilitado; cliques extras não disparam novo pedido.
    const sending = dialog.getByRole('button', { name: /Enviando pedido/ })
    await expect(sending).toBeDisabled()
    // Cliques extras enquanto envia (o botão pode já ter sumido se o pedido concluir rápido)
    for (let i = 0; i < 2; i++) await sending.dispatchEvent('click', undefined, { timeout: 1_000 }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedidos\//, { timeout: 15_000 })
    expect(await orders(page)).toHaveLength(1)
  })

  test('timeout após a criação: reenvio recupera o mesmo pedido (relógio controlado)', async ({ page }) => {
    await page.clock.install()
    await openWithScenario(page)
    await goToCheckout(page)
    await mockApi(page, 'PUT', '/__mock/scenario', {
      body: { name: 'sem-latencia', overrides: { checkout: { orderResponseDelayMs: 15_000, settleDelayMs: 600_000 } } },
    })
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    // O servidor cria o pedido, mas segura a resposta por 15 s
    await expect.poll(async () => (await orders(page)).length).toBe(1)
    await page.clock.fastForward('00:11') // timeout do cliente (10 s) antes da resposta (15 s)
    await expect(dialog.getByRole('alert')).toContainText('Não recebemos a confirmação do pedido')

    await dialog.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/)
    const list = await orders(page)
    expect(list).toHaveLength(1)
    expect(orderIdFrom(page)).toBe(list[0].id)
  })

  test('preço alterado via Socket.IO durante o checkout exige nova confirmação', async ({ page }) => {
    await goToCheckout(page)
    await waitForRealtime(page)
    const dialog = await openReview(page)

    await mockApi(page, 'PATCH', '/__mock/nfts/emerald-ape-042', { body: { price: '1.5' } })
    await expect(dialog.getByRole('alert')).toContainText('Os valores mudaram desde a revisão')
    await expect(dialog.getByRole('button', { name: 'Confirmar e pagar' })).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Revisar novos valores' }).click()
    await expect(dialog.getByTestId('checkout-total')).toHaveText('27.466 ETH')
    // O servidor recusa a cotação com preço ainda não aceito; nenhum pedido é criado.
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Aceite os novos preços')
    expect(await orders(page)).toHaveLength(0)

    await dialog.getByRole('button', { name: 'Aceitar novos preços' }).click()
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/pedidos\//)
    expect(await orders(page)).toHaveLength(1)
  })

  test('edição esgotada durante a confirmação leva à revisão do carrinho', async ({ page }) => {
    await goToCheckout(page)
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'esgotado', overrides: { latency: { mode: 'none' } } } })
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('alert')).toContainText('A disponibilidade de um ou mais itens mudou')
    await dialog.getByRole('button', { name: 'Revisar carrinho' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByText('Esgotado: remova este item para continuar.')).toBeVisible()
    expect(await orders(page)).toHaveLength(0)
  })

  test('pedido pendente: refresh, desconexão e retomada sem nova compra; eventos duplicados não regridem', async ({ page }) => {
    await goToCheckout(page)
    await mockApi(page, 'PUT', '/__mock/scenario', { body: { name: 'sem-latencia', overrides: { checkout: { settleDelayMs: 600_000 } } } })
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    const id = orderIdFrom(page)

    // Refresh durante o pendente: estado recuperado, sem novo pedido
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    // Voltar ao pagamento mostra o pedido em processamento (evita compra duplicada)
    await page.goto('/pagamento')
    await expect(page.getByRole('status').filter({ hasText: 'Você tem um pedido em processamento' })).toBeVisible()
    await page.getByRole('link', { name: 'Acompanhar pedido' }).click()

    // Queda da conexão em tempo real; o cliente reconecta e reconcilia com a API
    await waitForRealtime(page)
    await mockApi(page, 'POST', '/__mock/realtime/disconnect')
    await waitForRealtime(page)
    await mockApi(page, 'POST', `/__mock/orders/${id}/settle`)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()

    // Evento duplicado após o estado terminal: nada muda
    await mockApi(page, 'POST', '/__mock/realtime/replay', { body: { mode: 'duplicate' } })
    await page.waitForTimeout(300)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    expect(await orders(page)).toHaveLength(1)
  })
})
