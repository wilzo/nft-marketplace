import { z } from 'zod'
import { IsoDateTime, Network, optionalText, WalletAddress } from './common'

// ---------- Campos reutilizados (mesmas regras no formulário e no handler MSW) ----------

export const Email = z.string().trim().toLowerCase().email('Informe um e-mail válido').max(120)

export const Username = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, ponto e sublinhado')

export const DisplayName = z.string().trim().min(2, 'Use pelo menos 2 caracteres').max(40, 'Use no máximo 40 caracteres')

export const Password = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número')

/** Nome ENS sem o sufixo ".eth" (o layout exibe ".eth" fixo ao lado do campo). */
export const EnsName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,32}$/, 'Use de 3 a 32 letras, números ou hífens')

// ---------- Usuário e sessão ----------

export const User = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  /** data: URL da imagem (mock) ou null. */
  avatarUrl: z.string().nullable(),
  updatedAt: IsoDateTime,
})
export type User = z.infer<typeof User>

export const Session = z.object({
  token: z.string(),
  expiresAt: IsoDateTime,
  user: User,
})
export type Session = z.infer<typeof Session>

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginInput = z.infer<typeof LoginInput>

export const RegisterInput = z
  .object({
    username: Username,
    email: Email,
    password: Password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
export type RegisterInput = z.infer<typeof RegisterInput>

// ---------- Perfil ----------

export const ProfileInput = z.object({
  displayName: DisplayName,
  username: Username,
  email: Email,
  ensName: optionalText(EnsName),
  walletNickname: optionalText(z.string().trim().max(32, 'Use no máximo 32 caracteres')),
})
export type ProfileInput = z.input<typeof ProfileInput>

/** Avatar enviado como data URL (PNG, JPEG ou WebP, até ~512 KB). */
export const AvatarInput = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Envie uma imagem PNG, JPEG ou WebP')
    .max(700_000, 'A imagem deve ter no máximo 512 KB'),
})
export type AvatarInput = z.infer<typeof AvatarInput>

export const ChangePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: Password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>

// ---------- Carteiras ----------

export const WALLET_TYPES = ['metamask', 'walletconnect', 'coinbase'] as const
export const WalletType = z.enum(WALLET_TYPES)
export type WalletType = z.infer<typeof WalletType>

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const WALLET_SLOTS = ['primary', 'secondary'] as const
export const WalletSlot = z.enum(WALLET_SLOTS)
export type WalletSlot = z.infer<typeof WalletSlot>

export const Wallet = z.object({
  id: z.string(),
  slot: WalletSlot,
  displayName: z.string(),
  nickname: z.string().nullable(),
  network: Network,
  address: z.string(),
  walletType: WalletType,
  ensName: z.string().nullable(),
  updatedAt: IsoDateTime,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletInput = z.object({
  displayName: DisplayName,
  nickname: optionalText(z.string().trim().max(32, 'Use no máximo 32 caracteres')),
  network: Network,
  address: WalletAddress,
  walletType: WalletType,
  ensName: optionalText(EnsName),
})
export type WalletInput = z.input<typeof WalletInput>

export const Wallets = z.object({
  primary: Wallet.nullable(),
  secondary: Wallet.nullable(),
})
export type Wallets = z.infer<typeof Wallets>

/** Simulação de conexão com a extensão/app da carteira (sem blockchain real). */
export const WalletConnectionInput = z.object({ walletId: z.string(), network: Network })
export const WalletConnection = z.object({
  id: z.string(),
  walletId: z.string(),
  network: Network,
  status: z.literal('connected'),
  connectedAt: IsoDateTime,
})
export type WalletConnection = z.infer<typeof WalletConnection>

// ---------- Favoritos ----------

export const Favorites = z.object({ nftIds: z.array(z.string()) })
export type Favorites = z.infer<typeof Favorites>
