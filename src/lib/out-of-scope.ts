import { toast } from 'sonner'

/**
 * Seções que aparecem no Figma, mas não fazem parte desta entrega (editoriais, suporte, atividade, ofertas...).
 * Decisão (ARCHITECTURE.md → Decisões de UX): os links continuam visíveis, como no Figma, e levam a uma página única
 * (`/secao-indisponivel?secao=<chave>`) que informa que a seção não faz parte desta versão — nunca simulam sucesso.
 */
export const OUT_OF_SCOPE_SECTIONS = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  'minha-colecao': 'Minha coleção',
  atividade: 'Atividade',
  'estudio-do-criador': 'Estúdio do criador',
  'central-de-ajuda': 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  'politica-do-mercado': 'Política do mercado',
  'denunciar-item': 'Denunciar item',
  ofertas: 'Ofertas',
  'arquivos-baixados': 'Arquivos baixados',
  suporte: 'Suporte',
  'recuperar-senha': 'Recuperação de senha',
  'diario-da-cunhagem': 'Diário da Cunhagem',
} as const

export type OutOfScopeSection = keyof typeof OUT_OF_SCOPE_SECTIONS

/** Ações que não são navegação (ex.: envio da newsletter): aviso, sem aparentar sucesso. */
export function notAvailable(label: string) {
  toast.info(`${label} não está disponível nesta demonstração.`, { id: `oos-${label}` })
}
