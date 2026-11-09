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

/** Campos obrigatórios do layout (asterisco no Figma). */
export const WalletNickname = z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Use no máximo 32 caracteres')
export const ProfileName = z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Use no máximo 40 caracteres')
export const ReferralCode = z.string().trim().min(3, 'Informe o código de indicação').max(24, 'Use no máximo 24 caracteres')

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
  .min(1, 'Informe o nome ENS')
  .regex(/^(?=.{3,40}$)[a-z0-9-]+(.[a-z0-9-]+)*$/, 'Use de 3 a 40 letras, números, hífens ou pontos')

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

// ---------- Login social (provedor simulado pela API de demonstração) ----------

export const OAUTH_PROVIDERS = ['google', 'facebook'] as const
export const OAuthProvider = z.enum(OAUTH_PROVIDERS)
export type OAuthProvider = z.infer<typeof OAuthProvider>

/** Conta do provedor que o usuário pode escolher na tela de consentimento. */
export const OAuthAccount = z.object({ subject: z.string(), name: z.string(), email: Email })
export type OAuthAccount = z.infer<typeof OAuthAccount>

/** Resposta de `POST /auth/oauth/:provider/authorize`: pedido de consentimento a exibir ao usuário. */
export const OAuthAuthorization = z.object({
  requestId: z.string(),
  provider: OAuthProvider,
  providerName: z.string(),
  /** Dados que o provedor compartilhará com a Kurio. */
  scopes: z.array(z.string()).min(1),
  accounts: z.array(OAuthAccount).min(1),
  expiresAt: IsoDateTime,
})
export type OAuthAuthorization = z.infer<typeof OAuthAuthorization>

/** Corpo de `POST /auth/oauth/:provider`: decisão do usuário na tela de consentimento. */
export const OAuthCallbackInput = z.discriminatedUnion('decision', [
  z.object({ requestId: z.string(), decision: z.literal('allow'), subject: z.string() }),
  z.object({ requestId: z.string(), decision: z.literal('deny') }),
])
export type OAuthCallbackInput = z.infer<typeof OAuthCallbackInput>

/** Sessão aberta pelo login social; `created` indica conta nova (cadastro) ou já vinculada (login). */
export const OAuthSession = Session.extend({ created: z.boolean() })
export type OAuthSession = z.infer<typeof OAuthSession>

/** `details` do erro 409 ACCOUNT_EXISTS. */
export const AccountExistsDetails = z.object({ email: Email })

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
  ensName: EnsName,
  walletNickname: WalletNickname,
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

/** Carteira cadastrada (frame "Carteiras": todos os campos do layout). */
export const Wallet = z.object({
  id: z.string(),
  slot: WalletSlot,
  displayName: z.string(),
  nickname: z.string(),
  network: Network,
  profileName: z.string(),
  address: z.string(),
  /** "ENS ou carteira secundária (opcional)" */
  secondaryAddress: z.string().nullable(),
  walletType: WalletType,
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  updatedAt: IsoDateTime,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletInput = z.object({
  displayName: DisplayName,
  nickname: WalletNickname,
  network: Network,
  profileName: ProfileName,
  address: WalletAddress,
  secondaryAddress: optionalText(z.string().trim().max(64, 'Use no máximo 64 caracteres')),
  walletType: WalletType,
  referralCode: ReferralCode,
  email: Email,
  ensName: EnsName,
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
