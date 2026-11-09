import type { AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { ApiError } from '@/lib/api-error'
import { http } from '@/lib/http'

/**
 * Executa a chamada via Axios e valida a resposta com o schema do contrato.
 * Resposta fora do contrato vira ApiError('invalid-response') em vez de chegar à UI.
 */
export async function call<T extends z.ZodType>(schema: T, config: AxiosRequestConfig): Promise<z.infer<T>> {
  const response = await http.request(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    throw new ApiError({
      kind: 'invalid-response',
      status: response.status,
      message: 'Resposta inesperada do servidor',
      details: parsed.error.issues,
      retryable: false,
    })
  }
  return parsed.data
}

/** Para respostas 204 (sem corpo). */
export async function callVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
