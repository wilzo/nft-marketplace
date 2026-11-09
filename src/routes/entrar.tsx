import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/auth-screen'
import { redirectSearchSchema, sessionQuery } from '@/features/session/session'

export const Route = createFileRoute('/entrar')({
  validateSearch: redirectSearchSchema,
  // Já autenticado: segue direto para o destino.
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ href: search.redirect ?? '/', replace: true })
  },
  component: function AuthRoute() {
    const { redirect, expirada } = Route.useSearch()
    return <AuthScreen mode="login" redirect={redirect} expired={expirada === 1} />
  },
})
