import { toast } from 'sonner'

/**
 * Ações e páginas fora do escopo do desafio (editoriais, suporte, atividade, ofertas, downloads...).
 * Comportamento coerente: informa que não está disponível — nunca simula sucesso.
 */
export function notAvailable(label: string) {
  toast.info(`${label} não está disponível nesta demonstração.`, { id: `oos-${label}` })
}
