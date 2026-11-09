/**
 * Substituto do `tldts` (lista de sufixos públicos, ~190 KB de fonte) usado só pelo `tough-cookie`, que o MSW usa para
 * o pote de cookies das respostas simuladas. Os handlers da Kurio não leem nem gravam cookies (a sessão é Bearer),
 * então a lista completa não tem efeito funcional — só custo de download e avaliação no carregamento.
 * Regra simplificada: domínio registrável = os dois últimos rótulos (ou o próprio nome, se tiver um só).
 * Alias configurado em vite.config.ts apenas para o import `tldts`.
 */
export function getDomain(hostname: string): string | null {
  const host = hostname.replace(/\.$/, '').toLowerCase()
  if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return null
  const labels = host.split('.')
  return labels.length <= 2 ? host : labels.slice(-2).join('.')
}

export function getPublicSuffix(hostname: string): string | null {
  const labels = hostname.replace(/\.$/, '').toLowerCase().split('.')
  return labels.at(-1) ?? null
}
