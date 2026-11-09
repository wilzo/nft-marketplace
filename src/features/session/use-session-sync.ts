import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { onSessionLoss } from '@/lib/http'
import { realtime } from '@/lib/realtime'
import { clearSession, consumeExpiredNotice, SESSION_EXPIRED_MESSAGE, SESSION_EXPIRED_TOAST } from './session'
import { useSession } from './use-viewer'

/**
 * Mantém a sessão coerente durante a navegação:
 *  - 401 em qualquer chamada autenticada → encerra a sessão e, numa rota privada, leva ao login preservando a URL;
 *  - timer até `expiresAt` → mesmo tratamento, mesmo sem nenhuma chamada em andamento;
 *  - mudança de usuário → reconecta o Socket.IO com o novo token (eventos da sessão anterior deixam de chegar).
 */
export function useSessionSync() {
  const client = useQueryClient()
  const router = useRouter()
  const session = useSession()
  const token = session.data?.token ?? null
  const userId = session.data?.user.id ?? null
  const expiresAt = session.data?.expiresAt

  useEffect(() => {
    if (consumeExpiredNotice()) toast.warning(SESSION_EXPIRED_MESSAGE, { id: SESSION_EXPIRED_TOAST })
  }, [session.dataUpdatedAt])

  useEffect(() => {
    const expire = () => {
      clearSession(client, { keepDrafts: true })
      const isPrivate = router.state.matches.some((m) => m.staticData?.private)
      if (isPrivate) {
        void router.navigate({ to: '/entrar', search: { redirect: router.state.location.href, expirada: 1 }, replace: true })
      } else {
        toast.warning(SESSION_EXPIRED_MESSAGE, { id: SESSION_EXPIRED_TOAST })
      }
    }
    const off = onSessionLoss(expire)
    let timer: ReturnType<typeof setTimeout> | undefined
    if (expiresAt) timer = setTimeout(expire, Math.max(0, new Date(expiresAt).getTime() - Date.now()))
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [client, router, expiresAt])

  useEffect(() => {
    if (session.isPending) return
    void realtime.connect(token && userId ? { token, userId } : null)
  }, [session.isPending, token, userId])
}
