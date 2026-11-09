import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'

// Provisório: implementado na etapa 6.
export const Route = createFileRoute('/pagamento')({
  component: () => <PendingScreen title="Pagamento" />,
})
