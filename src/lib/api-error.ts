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
    return new ApiError({
      kind: 'http',
      status: error.response.status,
      message: 'Algo deu errado. Tente novamente.',
      retryable: error.response.status >= 500,
    })
  }
  return new ApiError({ kind: 'invalid-response', message: error instanceof Error ? error.message : 'Erro inesperado', retryable: false })
}
