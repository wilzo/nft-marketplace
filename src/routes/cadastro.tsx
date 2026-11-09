import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'

// Provisório: implementado na etapa 4.
export const Route = createFileRoute('/cadastro')({
  component: () => <PendingScreen title="Criar conta" />,
})
