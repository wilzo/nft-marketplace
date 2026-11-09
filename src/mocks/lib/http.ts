import { HttpResponse } from 'msw'
import type { z } from 'zod'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { env } from '@/config/env'
import { getDb, nowIso, transact } from '../db/store'
import type { UserRecord } from '../db/types'

export const api = (path: string) => `${env.apiBaseUrl}${path}`

const RETRYABLE: ApiErrorCode[] = ['SERVICE_UNAVAILABLE', 'INTERNAL_ERROR']

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string[]>; details?: unknown } = {},
) {
  const body: ApiErrorBody = { error: { code, message, retryable: RETRYABLE.includes(code), ...extra } }
  return HttpResponse.json(body, { status })
}

/** Converte issues do zod em erros por campo (chave = caminho no payload). */
export function toFieldErrors(error: z.ZodError) {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/** Valida o corpo com o mesmo schema do contrato; responde 422 com erros por campo. */
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw apiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido')
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    throw apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados', { fieldErrors: toFieldErrors(result.error) })
  }
  return result.data
}

export function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/** Resolve a sessão: null se ausente; lança 401 SESSION_EXPIRED se expirada. */
export function optionalUser(request: Request): UserRecord | null {
  const token = bearerToken(request)
  if (!token) return null
  const db = getDb()
  const session = db.sessions.find((s) => s.token === token)
  if (!session) throw apiError(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (session.expiresAt <= nowIso()) {
    transact((d) => (d.sessions = d.sessions.filter((s) => s.token !== token)))
    throw apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  return db.users.find((u) => u.id === session.userId) ?? null
}

export function requireUser(request: Request): UserRecord {
  const user = optionalUser(request)
  if (!user) throw apiError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  return user
}
