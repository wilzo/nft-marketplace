# Progresso do desafio

Enunciado completo: [docs/DESAFIO.md](DESAFIO.md). Este arquivo é o ponto de retomada entre conversas.

## Etapas

| # | Etapa | Status |
| --- | --- | --- |
| 1 | Leitura do Figma + setup | 🟡 Setup concluído; Figma parcial (limite do plano) |
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

### Figma

Arquivo de trabalho (cópia com acesso de edição): `Zo3ZHEbgu7rj2rggs6ueKR`
(https://www.figma.com/design/Zo3ZHEbgu7rj2rggs6ueKR/Frontend-Challenge--Copy-). Marca: **Kurio**, tema escuro, destaque laranja, fonte mono.

| Frame | Node | Tamanho | Screenshot em `docs/figma/screens` |
| --- | --- | --- | --- |
| Desktop / Início | 2:2 | 1440×3668 | desktop-inicio.png |
| Desktop / Detalhes do NFT | 10:244 | 1440×2246 | ❌ falta |
| Desktop / Carrinho de NFTs | 11:1278 | 1440×1754 | ❌ falta |
| Desktop / Pagamento | 11:2862 | 1440×1657 | desktop-pagamento.png |
| Desktop / Confirmação de Pedido | 11:4385 | 1440×1657 | desktop-confirmacao.png |
| Desktop / Login | 9:115 | 1440×1981 | desktop-login.png |
| Desktop / Cadastro | 9:1022 | 1440×1981 | desktop-cadastro.png |
| Desktop / Perfil do Colecionador | 9:1238 | 1440×1080 | desktop-perfil.png |
| Desktop / Carteiras | 9:1670 | 1440×1080 | ❌ falta |
| Mobile / Início | 14:5226 | 414×896 | ❌ falta |
| Mobile / Detalhes do NFT | 15:5536 | 414×896 | mobile-detalhes.png |
| Mobile / Carrinho de NFTs | 16:360 | 414×896 | mobile-carrinho.png |
| Mobile / Pagamento | 16:748 | 414×896 | mobile-pagamento.png |
| Mobile / Login | 16:1022 | 414×896 | mobile-login.png |
| Mobile / Cadastro | 16:1228 | 414×896 | mobile-cadastro.png |

`docs/figma/metadata.xml`: árvore completa (ids, nomes, posições e tamanhos) de todos os frames.

**Bloqueio atual:** o MCP do Figma atingiu o limite de chamadas do plano Starter. Falta extrair os tokens
(cores, tipografia, espaçamentos, raios, sombras), os textos exatos e os assets (imagens, ícones, logo, fontes),
além dos 4 screenshots marcados acima.

## Comandos

```bash
npm run dev            # desenvolvimento com mocks
npm run build          # tsc -b + vite build
npm run preview        # serve o build
npm run typecheck
npm run lint
npm run test:e2e       # Playwright (build + preview)
```
