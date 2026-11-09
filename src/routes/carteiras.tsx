import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'
import { requireAuth } from '@/features/session/session'

// Provisório: implementado na etapa 7. Já protegido por sessão.
export const Route = createFileRoute('/carteiras')({
  staticData: { private: true },
  beforeLoad: requireAuth,
  component: () => <PendingScreen title="Carteiras" />,
})
