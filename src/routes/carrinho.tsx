import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'

// Provisório: implementado na etapa 5.
export const Route = createFileRoute('/carrinho')({
  component: () => <PendingScreen title="Carrinho de NFTs" />,
})
