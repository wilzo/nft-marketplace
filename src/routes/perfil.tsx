import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'

// Provisório: implementado na etapa 7.
export const Route = createFileRoute('/perfil')({
  component: () => <PendingScreen title="Perfil do colecionador" />,
})
