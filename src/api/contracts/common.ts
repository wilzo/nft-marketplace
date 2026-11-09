import { z } from 'zod'
import { isEthString } from '@/lib/eth'

/** Valor em ETH como string decimal (até 18 casas). Nunca number. */
export const EthAmount = z.string().refine(isEthString, 'Valor ETH deve ser uma string decimal')
export type EthAmount = z.infer<typeof EthAmount>

export const IsoDateTime = z.iso.datetime({ offset: true })

/** Campo opcional de formulário: string vazia vira `undefined` antes da validação. */
export const optionalText = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional())

/** Endereço EVM (as telas pedem "Endereço 0x da carteira" para todas as redes). */
export const WalletAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Informe um endereço 0x com 40 caracteres hexadecimais')

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const Network = z.enum(NETWORKS)
export type Network = z.infer<typeof Network>

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

/** Códigos de erro do envelope padrão. `retryable` indica falha transitória. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  /** Login com e-mail/senha incorretos (não confundir com sessão perdida). */
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'AVAILABILITY_CONFLICT',
  'QUOTE_STALE',
  'IDEMPOTENCY_CONFLICT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  /** Login social: o usuário negou o acesso na tela de consentimento do provedor (simulado). */
  'OAUTH_DENIED',
  /** Login social: o provedor (simulado) não respondeu. */
  'OAUTH_PROVIDER_ERROR',
  /** Login social: o e-mail do provedor já pertence a uma conta criada com senha. */
  'ACCOUNT_EXISTS',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const
export const ApiErrorCode = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof ApiErrorCode>

export const ApiErrorBody = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    retryable: z.boolean(),
    /** Erros por campo (formulários). Chave = nome do campo no payload. */
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
}
