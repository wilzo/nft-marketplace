import { expect, test } from '@playwright/test'
import { mockApi, openWithScenario } from './support/mock-api'

/** Newsletter do rodapé: inscrição pela API simulada (POST /newsletter), com validação e e-mail repetido. */
test.describe('newsletter do rodapé', () => {
  test.beforeEach(async ({ page }) => {
    await openWithScenario(page)
  })

  test('valida o e-mail, inscreve e recusa e-mail já inscrito', async ({ page }) => {
    const form = page.getByRole('form', { name: 'Antecipe-se ao próximo lançamento' })
    const email = form.getByLabel('E-mail para a newsletter')
    const send = form.getByRole('button', { name: 'Enviar' })

    // Inválido: erro no campo, nenhuma inscrição.
    await email.fill('wilson.hernandesjunior')
    await send.click()
    await expect(form.getByRole('alert')).toHaveText('Informe um e-mail válido')
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    // Válido: inscrição registrada pela API simulada.
    await email.fill('Colecionador.Teste@Example.com ')
    await send.click()
    await expect(form.getByRole('status')).toHaveText('Inscrição confirmada: colecionador.teste@example.com vai receber as novidades da Kurio.')
    await expect(email).toHaveValue('')
    await expect(page.getByText('não está disponível nesta demonstração')).toHaveCount(0)

    // Repetido: 409 da API, mostrado no campo.
    await email.fill('colecionador.teste@example.com')
    await send.click()
    await expect(form.getByRole('alert')).toHaveText('Este e-mail já está inscrito na newsletter.')
    await expect(email).toBeFocused()

    const db = JSON.parse((await page.evaluate(() => localStorage.getItem('kurio:mock-db')))!)
    expect(db.newsletter.map((s: { email: string }) => s.email)).toEqual(['colecionador.teste@example.com'])
  })

  test('falha do servidor mostra o erro sem aparentar sucesso', async ({ page }) => {
    await mockApi(page, 'PUT', '/__mock/scenario', {
      body: { name: 'sem-latencia', overrides: { failures: [{ method: 'POST', path: '/newsletter', status: 503, code: 'SERVICE_UNAVAILABLE' }] } },
    })
    const form = page.getByRole('form', { name: 'Antecipe-se ao próximo lançamento' })
    await form.getByLabel('E-mail para a newsletter').fill('alguem@example.com')
    await form.getByRole('button', { name: 'Enviar' }).click()
    await expect(form.getByRole('alert')).toContainText('Serviço temporariamente indisponível')
    await expect(form.getByRole('status')).toHaveCount(0)
  })
})
