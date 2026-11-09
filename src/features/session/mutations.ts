import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { LoginInput, RegisterInput } from '@/api/contracts'
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
