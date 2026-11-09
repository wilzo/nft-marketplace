import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import type { Session } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { toApiError } from '@/lib/api-error'
import { guestCartId, sessionToken } from '@/lib/client-storage'
import { qk } from '@/lib/query-keys'

/**
 * Política de sessão (documentada em ARCHITECTURE.md):
 *  - o token opaco fica em localStorage; a sessão é revalidada na API ao carregar (recuperação após refresh);
 *  - expiração: 401 SESSION_EXPIRED em qualquer chamada OU o horário `expiresAt` (timer) encerram a sessão;
 *  - logout/troca de usuário removem todo o cache `['private']` e reconectam o Socket.IO sem o token anterior.
 */
export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.'
export const SESSION_EXPIRED_TOAST = 'session-expired'

/**
 * A validação da sessão pode ocorrer no beforeLoad, antes de o <Toaster> montar (o Sonner descarta toasts
 * emitidos sem inscritos). O aviso fica pendente e é exibido por `useSessionSync` após a montagem.
 */
let expiredNoticePending = false
export function consumeExpiredNotice() {
  const pending = expiredNoticePending
  expiredNoticePending = false
  return pending
}

export const sessionQuery = queryOptions({
  queryKey: ['session'] as const,
  queryFn: async ({ signal }): Promise<Session | null> => {
    if (!sessionToken.get()) return null
    try {
      return await authApi.session({ signal })
    } catch (error) {
      if (toApiError(error).isSessionLoss) {
        // Token salvo expirou (ex.: ao recarregar): avisa e segue como visitante; a rota privada redireciona ao login.
        sessionToken.set(null)
        expiredNoticePending = true
        return null
      }
      throw error
    }
  },
  staleTime: Infinity,
})

/** Destino de retorno após login: só caminhos internos (evita open redirect). */
export const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .refine((v) => v.startsWith('/') && !v.startsWith('//'), 'Destino inválido')
    .optional()
    .catch(undefined),
  /** Chegou ao login porque a sessão expirou (exibe aviso persistente na tela de login). */
  expirada: z.literal(1).optional().catch(undefined),
})

/** Guarda das rotas privadas (beforeLoad): sem sessão → /entrar?redirect=<rota atual com busca>. */
export async function requireAuth({ context, location }: { context: { queryClient: QueryClient }; location: { href: string } }) {
  const session = await context.queryClient.ensureQueryData(sessionQuery)
  if (!session) {
    // Havia token salvo mas a API o recusou: a sessão expirou.
    const expired = consumeExpiredNotice()
    throw redirect({ to: '/entrar', search: { redirect: location.href, expirada: expired ? 1 : undefined } })
  }
  return { session }
}

/** Inicia a sessão: limpa dados privados de qualquer sessão anterior e incorpora o carrinho do visitante. */
export async function startSession(client: QueryClient, session: Session) {
  const guestId = guestCartId.get()
  sessionToken.set(session.token)
  // Troca de usuário: rascunhos de checkout de outra conta não ficam disponíveis nesta aba.
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('kurio:checkout') && !key.endsWith(`:${session.user.id}`)) sessionStorage.removeItem(key)
    }
  } catch {
    // sessionStorage indisponível
  }
  client.removeQueries({ queryKey: qk.private.all })
  if (guestId) {
    try {
      await cartApi.merge(guestId)
    } catch {
      // O carrinho do visitante pode ter expirado; o login segue normalmente.
    } finally {
      guestCartId.set(null)
    }
  }
  client.setQueryData(sessionQuery.queryKey, session)
}

/**
 * Encerra a sessão localmente (logout, expiração, troca de usuário).
 * `keepDrafts`: na expiração, o rascunho do checkout é mantido para a retomada após novo login;
 * no logout ele é apagado (dados privados não ficam no navegador).
 */
export function clearSession(client: QueryClient, { keepDrafts = false } = {}) {
  sessionToken.set(null)
  guestCartId.set(null)
  if (!keepDrafts) {
    try {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('kurio:checkout')) sessionStorage.removeItem(key)
    } catch {
      // sessionStorage indisponível
    }
  }
  client.removeQueries({ queryKey: qk.private.all })
  client.setQueryData(sessionQuery.queryKey, null)
}
