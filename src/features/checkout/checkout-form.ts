import { z } from 'zod'
import { CollectorInput, Network, WalletSlot, type User, type Wallet } from '@/api/contracts'

/**
 * Formulário de pagamento (frame "Desktop / Pagamento").
 * Reaproveita o contrato `CollectorInput` (mesmas regras e obrigatórios do servidor/Figma)
 * e acrescenta a rede escolhida e a carteira cadastrada usada ("Usar outra carteira?").
 */
export const CheckoutForm = CollectorInput.extend({
  network: Network,
  walletSlot: WalletSlot,
})
export type CheckoutFormInput = z.input<typeof CheckoutForm>
export type CheckoutFormValues = z.output<typeof CheckoutForm>

/** Dados preenchidos a partir da carteira cadastrada (o usuário pode ajustar os do colecionador). */
export function fromWallet(wallet: Wallet | null) {
  return wallet
    ? { network: wallet.network, profileName: wallet.profileName, referralCode: wallet.referralCode, email: wallet.email, ensName: wallet.ensName }
    : {}
}

export function checkoutDefaults(user: User, wallet: Wallet | null): CheckoutFormInput {
  return {
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    profileName: user.walletNickname ?? '',
    ensName: user.ensName ?? '',
    referralCode: '',
    note: '',
    network: 'ethereum',
    walletSlot: 'primary',
    ...fromWallet(wallet),
  }
}
