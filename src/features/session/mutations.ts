import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { LoginInput, OAuthCallbackInput, OAuthProvider, RegisterInput } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { clearSession, startSession } from './session'

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: async (session) => {
      await startSession(client, session)
      toast.success(`Olá, ${session.user.displayName}!`)
    },
  })
}

export function useRegister() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: async (session) => {
      await startSession(client, session)
      toast.success('Conta criada. Boas-vindas à Kurio!')
    },
  })
}

/** Login social simulado, 1º passo: pede ao provedor (fictício, via API) o consentimento a exibir. */
export function useOAuthAuthorize() {
  return useMutation({ mutationFn: (provider: OAuthProvider) => authApi.oauthAuthorize(provider) })
}

/** Login social simulado, 2º passo: envia a decisão; com sessão aberta, segue como um login comum. */
export function useOAuthComplete() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ provider, input }: { provider: OAuthProvider; input: OAuthCallbackInput }) => authApi.oauthComplete(provider, input),
    onSuccess: async (session) => {
      await startSession(client, session)
      toast.success(session.created ? 'Conta criada. Boas-vindas à Kurio!' : `Olá, ${session.user.displayName}!`)
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    // Falha no servidor não impede o logout local.
    mutationFn: () => authApi.logout().catch(() => undefined),
    onSettled: () => {
      clearSession(client)
      toast.success('Você saiu da sua conta.')
      void navigate({ to: '/' })
    },
  })
}
