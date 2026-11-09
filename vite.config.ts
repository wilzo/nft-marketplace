import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

/**
 * Com os mocks ativos, o chunk do MSW (src/mocks/browser.ts) é necessário para a primeira requisição de dados,
 * mas é importado dinamicamente pelo main.tsx — sem ajuda, só começaria a baixar depois que o bundle principal
 * executasse (cascata). Este plugin adiciona `modulepreload` para ele e seus imports no index.html do build:
 * o download corre em paralelo com o bundle principal; a execução continua sob demanda (import dinâmico).
 */
function preloadMocksChunk(enabled: boolean): Plugin {
  return {
    name: 'kurio:preload-mocks-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!enabled || !ctx.bundle) return
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk')
        const entry = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/mocks/browser.ts'))
        if (!entry) return
        const files = new Set<string>()
        const visit = (fileName: string) => {
          if (files.has(fileName)) return
          files.add(fileName)
          const chunk = chunks.find((c) => c.fileName === fileName)
          chunk?.imports.forEach(visit)
        }
        visit(entry.fileName)
        // Só o que o index.html ainda não referencia (o bundle principal e seus módulos já estão lá).
        return [...files].filter((file) => !html.includes(`/${file}`)).map((file) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const mocksEnabled = (env.VITE_ENABLE_MOCKS ?? 'true') === 'true'
  return {
    plugins: [
      // Deve vir antes do plugin do React (gera src/routeTree.gen.ts e faz code-splitting das rotas)
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      // Ícones do Figma importados como componentes: `import Icon from '@/assets/icons/x.svg?react'`
      svgr(),
      preloadMocksChunk(mocksEnabled),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Ver src/mocks/lib/tldts-lite.ts (lista de sufixos públicos desnecessária para o pote de cookies do MSW)
        tldts: fileURLToPath(new URL('./src/mocks/lib/tldts-lite.ts', import.meta.url)),
      },
    },
  }
})
