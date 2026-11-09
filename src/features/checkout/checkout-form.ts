import { z } from 'zod'
import { CollectorInput, Network } from '@/api/contracts'

/**
 * Formulário de pagamento (frame "Desktop / Pagamento").
 * Reaproveita o contrato `CollectorInput` (mesmas regras do servidor) e acrescenta o que é da tela:
 * rede escolhida e uso da carteira secundária. "Nome do perfil" é obrigatório como no layout;
 * "Código de indicação" e "Nome ENS" ficam opcionais (decisão de UX documentada no ARCHITECTURE.md).
 */
export const CheckoutForm = CollectorInput.extend({
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Use no máximo 40 caracteres'),
  network: Network,
  useSecondary: z.boolean(),
})
export type CheckoutFormInput = z.input<typeof CheckoutForm>
export type CheckoutFormValues = z.output<typeof CheckoutForm>
