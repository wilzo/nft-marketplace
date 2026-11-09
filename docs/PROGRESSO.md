# Progresso do desafio

Enunciado completo: [docs/DESAFIO.md](DESAFIO.md). Este arquivo é o ponto de retomada entre conversas.

## Etapas

| # | Etapa | Status |
| --- | --- | --- |
| 1 | Leitura do Figma + setup | ✅ Concluída |
| 2 | Contratos tipados + camada de mocks (banco simulado, cenários, reset, rede, Socket.IO) | ✅ Concluída (painel visual de cenários fica para a etapa 3/10) |
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
- **GitHub:** https://github.com/wilzo/nft-marketplace (criado **privado**; tornar público antes da entrega).
- Ícones SVG viram componentes via `vite-plugin-svgr` (`?react`); imagens otimizadas com `sharp`.
- **Deploy (Vercel):** projeto `wilzos-projects/nft-marketplace`, produção em https://nft-marketplace-xi-self.vercel.app (MSW e rewrite de SPA verificados). Deploy: `vercel deploy --prod --yes`.
- CLI da Vercel está em `%APPDATA%\npm\vercel.cmd` (fora do PATH do Git Bash).

### Figma

Arquivo de trabalho (cópia com acesso de edição): `Zo3ZHEbgu7rj2rggs6ueKR`
(https://www.figma.com/design/Zo3ZHEbgu7rj2rggs6ueKR/Frontend-Challenge--Copy-). Marca: **Kurio**, tema escuro, destaque laranja, fonte mono.

| Frame | Node | Tamanho | Screenshot em `docs/figma/screens` |
| --- | --- | --- | --- |
| Desktop / Início | 2:2 | 1440×3668 | desktop-inicio.png |
| Desktop / Detalhes do NFT | 10:244 | 1440×2246 | desktop-detalhes.png |
| Desktop / Carrinho de NFTs | 11:1278 | 1440×1754 | desktop-carrinho.png |
| Desktop / Pagamento | 11:2862 | 1440×1657 | desktop-pagamento.png |
| Desktop / Confirmação de Pedido | 11:4385 | 1440×1657 | desktop-confirmacao.png |
| Desktop / Login | 9:115 | 1440×1981 | desktop-login.png |
| Desktop / Cadastro | 9:1022 | 1440×1981 | desktop-cadastro.png |
| Desktop / Perfil do Colecionador | 9:1238 | 1440×1080 | desktop-perfil.png |
| Desktop / Carteiras | 9:1670 | 1440×1080 | desktop-carteiras.png |
| Mobile / Início | 14:5226 | 414×896 | mobile-inicio.png |
| Mobile / Detalhes do NFT | 15:5536 | 414×896 | mobile-detalhes.png |
| Mobile / Carrinho de NFTs | 16:360 | 414×896 | mobile-carrinho.png |
| Mobile / Pagamento | 16:748 | 414×896 | mobile-pagamento.png |
| Mobile / Login | 16:1022 | 414×896 | mobile-login.png |
| Mobile / Cadastro | 16:1228 | 414×896 | mobile-cadastro.png |

`docs/figma/file.json`: arquivo completo via REST API (`GET /v1/files/:key`, token `FIGMA_TOKEN` em `.env.local`, escopo `file_content:read`), com textos, estilos, cores, fontes, efeitos e referências de imagem.
`docs/figma/metadata.xml`: árvore completa (ids, nomes, posições e tamanhos) de todos os frames.

Tokens, tipografia e assets: ver [docs/figma/TOKENS.md](figma/TOKENS.md). Tema aplicado em `src/index.css`.
O MCP do Figma (plano Starter) bateu o limite mensal; use a REST API com `FIGMA_TOKEN` (`.env.local`) se precisar de mais dados.

## Etapa 2: o que foi feito

Mapa do código:

| Camada | Arquivos |
| --- | --- |
| Contratos (zod, compartilhados cliente ↔ mock) | `src/api/contracts/{common,nfts,account,commerce}.ts` |
| Funções REST tipadas (Axios + validação da resposta) | `src/api/client.ts`, `src/api/endpoints.ts` |
| Erro normalizado | `src/lib/api-error.ts` (`ApiError`: kind, status, code, fieldErrors, retryable) |
| Axios | `src/lib/http.ts` (Bearer token, `X-Cart-Id`, `onSessionLoss`, arrays repetidos na query) |
| Persistência do cliente | `src/lib/client-storage.ts` (token da sessão, id do carrinho de visitante) |
| ETH sem float | `src/lib/eth.ts` (BigInt em wei; `addEth`, `mulEth`, `percentOfEth`, `formatEth`) |
| Tempo real (cliente) | `src/lib/realtime.ts` (`RealtimeClient`: dedupe por eventId, versão por recurso, filtro por usuário, onReconnect) |
| Banco simulado | `src/mocks/db/{types,store}.ts` (localStorage `kurio:mock-db`, `transact`, `resetDb`, ids determinísticos) |
| Fixtures | `src/mocks/fixtures/{nfts,seed}.ts` (54 NFTs, 2 usuários, carteira, carrinho do Figma, cupons) |
| Cenários | `src/mocks/scenarios.ts` (presets, latência determinística por URL, falhas, flags de checkout) |
| Regras de negócio do mock | `src/mocks/domain/{commerce,mappers}.ts` (cotação, reservas, liquidação de pagamento) |
| Handlers REST | `src/mocks/handlers/{network,catalog,auth,commerce,account,control}.ts` + `src/mocks/handlers.ts` |
| Socket.IO simulado | `src/mocks/realtime.ts` (`ws.link` + `@mswjs/socket.io-binding`) |
| Boot | `src/mocks/browser.ts` (`startMocks`: initDb, cenário via `?cenario=`, retoma pedidos pendentes) |
| Testes | `e2e/mock-layer.spec.ts`, `e2e/support/mock-api.ts` |

Credenciais: `ana@kurio.dev` / `bruno@kurio.dev`, senha `Kurio2026!`. Cupons: `KURIO10` (10%), `LANCAMENTO` (15%), `EXPIRADO`.

Endpoints REST (prefixo `/api`): `GET /nfts`, `GET /nfts/:id`, `GET /nfts/:id/related`, `GET /highlights`,
`POST /auth/{register,login,logout}`, `GET /auth/session`, `GET|PUT|DELETE /favorites[/:nftId]`,
`GET /cart`, `POST /cart/items`, `PATCH|DELETE /cart/items/:id`, `POST /cart/acknowledge`, `PUT|DELETE /cart/coupon`, `POST /cart/merge`,
`POST /quotes`, `POST /orders` (header `Idempotency-Key`), `GET /orders[?status=]`, `GET /orders/:id`,
`GET|PATCH /profile`, `PUT|DELETE /profile/avatar`, `POST /profile/password`, `GET /wallets`, `PUT /wallets/:slot`,
`POST /wallet-connections`, `DELETE /wallet-connections/:id`.
Controle (sem latência/falhas): `GET|PUT /__mock/scenario`, `POST /__mock/reset`, `PATCH /__mock/nfts/:id`,
`POST /__mock/realtime/{replay,disconnect}`, `GET /__mock/realtime`, `POST /__mock/sessions/expire`, `POST /__mock/orders/:id/settle`.

Cenários: `padrao`, `sem-latencia`, `vazio`, `lento`, `latencia-variavel`, `offline`, `erro-servidor`, `falha-transitoria`,
`favoritos-falha`, `sessao-curta`, `preco-alterado`, `esgotado`, `timeout-pedido`, `pagamento-recusado`, `carteira-recusada`, `tempo-real-fora`.

### Armadilhas resolvidas (não repetir)

- **socket.io-client precisa ser importado depois do `worker.start()`**: o engine.io-client captura `globalThis.WebSocket`
  ao carregar o módulo. Por isso `realtime.connect()` faz `await import('socket.io-client')`.
- **O MSW remove `/socket.io/` da URL do cliente** antes de casar o handler: use `ws.link('wss://realtime.kurio.test/*')`.
- O binding não envia heartbeat: o mock manda ping Engine.IO (`"2"`) a cada 20 s.
- O binding confirma a conexão antes de ler o `auth`: o token é lido do pacote CONNECT bruto (`"40{...}"`).
- `transact()` persiste mesmo quando o handler lança erro (cenário "preço alterado" muda o catálogo e responde 409).
- Testes devem esperar `document.documentElement.dataset.app === 'ready'` (helper `waitForApp`) após `goto`/`reload`.
- Bundle inicial ~425 KB (133 KB gzip): revisar na etapa 9 (zod, devtools, code-splitting).

### Próximo passo (etapa 3)

Home real (header, hero, filtros, catálogo com estado na URL, paginação, skeletons) e detalhe do NFT,
substituindo o placeholder de `src/routes/index.tsx`. Integrar `realtime.on('nft.updated')` ao cache do Query
(`setQueryData` nas listas/detalhe + `noteVersion` com a versão vinda do REST) e `onReconnect` → `invalidateQueries`.

## Comandos

```bash
npm run dev            # desenvolvimento com mocks
npm run build          # tsc -b + vite build
npm run preview        # serve o build
npm run typecheck
npm run lint
npm run test:e2e       # Playwright (build + preview)
```
