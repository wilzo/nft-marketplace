import { isAxiosError } from 'axios'
import { ApiErrorBody, type ApiErrorCode } from '@/api/contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'invalid-response'

/** Erro normalizado de qualquer chamada REST. A UI e o Query só lidam com este tipo. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ApiErrorCode | null
  readonly fieldErrors: Record<string, string[]>
  readonly details: unknown
  /** Falha transitória: pode ser repetida com segurança. */
  readonly retryable: boolean

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ApiErrorCode | null
    fieldErrors?: Record<string, string[]>
    details?: unknown
    retryable: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
    this.retryable = init.retryable
  }

  get isSessionLoss() {
    return this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'
  }

  /** Primeira mensagem de erro do campo, para associar ao input (aria-describedby). */
  fieldError(name: string) {
    return this.fieldErrors[name]?.[0]
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') return new ApiError({ kind: 'canceled', message: 'Requisição cancelada', retryable: false })
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder. Tente novamente.', retryable: true })
    }
    if (!error.response) {
      return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.', retryable: true })
    }
    const parsed = ApiErrorBody.safeParse(error.response.data)
    if (parsed.success) {
      const e = parsed.data.error
      return new ApiError({
        kind: 'http',
        status: error.response.status,
        code: e.code,
        message: e.message,
        fieldErrors: e.fieldErrors,
        details: e.details,
        retryable: e.retryable,
      })
    }
    // Resposta fora do envelope da API: registra para diagnóstico e explica a causa provável.
    const { status, data, headers } = error.response
    console.error('[api] resposta fora do contrato', { method: error.config?.method, url: error.config?.url, status, data })
    const isHtml = String(headers?.['content-type'] ?? '').includes('text/html') || (typeof data === 'string' && data.trimStart().startsWith('<'))
    const mswException = data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
    const message = isHtml || status === 404 || status === 405
      ? 'A API simulada não respondeu nesta página (o service worker dos mocks não está ativo). Recarregue a página e tente de novo.'
      : mswException
        ? `Erro interno da API simulada: ${(data as { message: string }).message}`
        : `Algo deu errado (HTTP ${status}). Tente novamente.`
    return new ApiError({ kind: 'http', status, code: 'INTERNAL_ERROR', message, retryable: status >= 500 })
  }
  return new ApiError({ kind: 'invalid-response', message: error instanceof Error ? error.message : 'Erro inesperado', retryable: false })
}
