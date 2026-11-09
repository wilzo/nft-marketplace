/**
 * Configuração versionada da auditoria Lighthouse (etapa 9 do desafio).
 * - Build otimizado servido por `vite preview` (mesmo artefato do deploy), com a camada MSW ativa no cenário padrão.
 * - Páginas: início e detalhe do NFT. Perfis: mobile (padrão do Lighthouse) e desktop (preset oficial).
 * - 3 medições por página/perfil, cada uma num Chrome novo (sem cache/service worker de execuções anteriores).
 */
export default {
  port: 4175,
  runs: Number(process.env.LH_RUNS ?? 3),
  pages: [
    { name: 'inicio', path: '/' },
    { name: 'detalhe', path: '/nft/emerald-ape-042' },
  ],
  profiles: ['mobile', 'desktop'],
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  outputDir: 'lighthouse/reports',
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
}
