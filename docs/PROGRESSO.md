# Progresso do desafio

Enunciado completo: [docs/DESAFIO.md](DESAFIO.md). Este arquivo é o ponto de retomada entre conversas.

## Etapas

| # | Etapa | Status |
| --- | --- | --- |
| 1 | Leitura do Figma + setup | 🟡 Setup concluído; **Figma bloqueado** (ver abaixo) |
| 2 | Contratos tipados + camada de mocks (banco simulado, cenários, reset, rede, Socket.IO) | ⬜ |
| 3 | Catálogo e detalhe do NFT | ⬜ |
| 4 | Autenticação e sessão | ⬜ |
| 5 | Carrinho e cotação | ⬜ |
| 6 | Pagamento, pedidos idempotentes, confirmação e tempo real | ⬜ |
| 7 | Perfil e carteiras | ⬜ |
| 8 | Testes Playwright (12 cenários + regressão visual, desktop/mobile) | ⬜ |
| 9 | Auditoria Lighthouse (3 medições, mediana, relatórios) | ⬜ |
| 10 | README.md, ARCHITECTURE.md e deploy final | ⬜ |

## Etapa 1: o que foi feito

- Vite 8 + React 19 + TypeScript 7 (template `react-ts` oficial), lint com **oxlint**.
- Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn/ui (base Radix, preset Nova) com componentes base:
  button, input, label, dialog, sheet, select, checkbox, skeleton, sonner, dropdown-menu, badge, separator.
  O tema padrão do shadcn será substituído pelos tokens do Figma.
- TanStack Router com rotas por arquivo (`src/routes`, plugin Vite gera `src/routeTree.gen.ts`), contexto com `queryClient`, 404.
- TanStack Query (`src/lib/query-client.ts`) e Axios (`src/lib/http.ts`, base `VITE_API_BASE_URL`).
- MSW 2.x: worker em `public/mockServiceWorker.js`, ativado por `VITE_ENABLE_MOCKS` (padrão `true`, inclusive no build).
  Handler `/api/health` só para validar a cadeia Router → Query → Axios → MSW.
- `socket.io-client` + `@mswjs/socket.io-binding` instalados (integração na etapa 2).
- Playwright: projetos `desktop-chromium` (1440) e `mobile-chromium` (390), roda contra `vite preview`;
  `e2e/smoke.spec.ts` passa nos dois viewports.
- Lighthouse instalado (configuração na etapa 9).
- `vercel.json` com rewrite de SPA (rotas sem extensão → `index.html`) e cabeçalhos do service worker.

### Decisões e observações técnicas

- **MSW fixado em 2.x**: `@mswjs/socket.io-binding@0.2.0` tem peer `msw@^2.10.2`; o MSW 3 é incompatível.
- npm 11 bloqueia scripts de postinstall; o worker do MSW é gerado com `npx msw init public --save`.
- `cn` (pacote oficial `shadcn-ui/cn`) substitui `clsx` + `tailwind-merge` em `src/lib/utils.ts`.
- CLI da Vercel está em `%APPDATA%\npm\vercel.cmd` (fora do PATH do Git Bash).

### Bloqueio: acesso ao Figma

O conector do Figma está autenticado como `wilson.hernandesjunior@gmail.com`, com assento **View** no plano **Starter**.
Todas as leituras do arquivo `Ff0SksUi7UFtPWUO8kyNtw` retornam *"you don't have edit access to this file"*.
Pendências da etapa 1 que dependem disso: inventário de frames, tokens (cores, tipografia, espaçamentos, raios, sombras),
download de assets (imagens, ícones, logo, fontes) para `public/` / `src/assets/`.

## Comandos

```bash
npm run dev            # desenvolvimento com mocks
npm run build          # tsc -b + vite build
npm run preview        # serve o build
npm run typecheck
npm run lint
npm run test:e2e       # Playwright (build + preview)
```
