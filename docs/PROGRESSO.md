# Progresso do desafio

Enunciado completo: [docs/DESAFIO.md](DESAFIO.md). Este arquivo é o ponto de retomada entre conversas.

## Etapas

| # | Etapa | Status |
| --- | --- | --- |
| 1 | Leitura do Figma + setup | ✅ Concluída |
| 2 | Contratos tipados + camada de mocks (banco simulado, cenários, reset, rede, Socket.IO) | ✅ Concluída (inclui painel de cenários) |
| 3 | Catálogo e detalhe do NFT | ✅ Concluída (favoritos entram na etapa 4) |
| 4 | Autenticação e sessão | ✅ Concluída (inclui favoritos com atualização otimista) |
| 5 | Carrinho e cotação | ✅ Concluída |
| 6 | Pagamento, pedidos idempotentes, confirmação e tempo real | ✅ Concluída |
| 7 | Perfil e carteiras | ✅ Concluída |
| 8 | Testes Playwright (12 cenários + regressão visual, desktop/mobile) | ✅ Concluída (matriz em [docs/TESTES.md](TESTES.md)) |
| 9 | Auditoria Lighthouse (3 medições, mediana, relatórios) | ✅ Concluída ([lighthouse/ANALISE.md](../lighthouse/ANALISE.md)) |
| 10 | README.md, ARCHITECTURE.md e deploy final | ✅ Concluída ([README.md](../README.md), [ARCHITECTURE.md](../ARCHITECTURE.md)) |

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
- **GitHub:** https://github.com/wilzo/nft-marketplace (**público**).
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

## Etapa 3: o que foi feito

| Parte | Arquivos |
| --- | --- |
| Layout | `src/routes/__root.tsx` (skip link, header, footer, tab bar mobile, Toaster, painel de cenários lazy), `src/components/layout/{site-header,site-footer,mobile-tab-bar}.tsx` |
| Home | `src/routes/index.tsx` (validateSearch + prefetch no loader), `src/features/catalog/components/{home-sections,catalog-section,catalog-filters,catalog-toolbar,catalog-pagination,nft-card}.tsx` |
| Estado na URL | `src/features/catalog/search.ts` (schema com `.catch`, defaults omitidos, `withFilters` zera a página) |
| Queries | `src/features/catalog/queries.ts` (keepPreviousData, AbortSignal, `noteVersion`), `src/lib/query-keys.ts` (privados sob `[private, scope]`) |
| Detalhe | `src/routes/nft.$nftId.tsx` (`?edicao=`, NFT inexistente, edição indisponível, limite, aviso de preço em tempo real, barra de compra mobile), `src/features/nft-detail/*` |
| Tempo real → cache | `src/features/realtime/use-realtime-sync.ts` (`nft.updated` em listas/destaques/relacionados/detalhe; invalida carrinho; `onReconnect` reconcilia) |
| Carrinho (mínimo) | `src/features/cart/{queries,mutations}.ts` (contador no header, "COMPRAR" adiciona e leva a /carrinho) |
| Fora do escopo | `src/lib/out-of-scope.ts` (toast "não está disponível nesta demonstração") |
| Painel de cenários | `src/features/dev/scenario-panel.tsx` + `src/api/mock-control.ts` (aplicar cenário / restaurar tudo) |
| Testes | `e2e/catalog.spec.ts` (filtros+histórico, busca/vazio, skeleton, erro+retry, detalhe, tempo real) |

Rotas provisórias (`PendingScreen`): /entrar, /cadastro, /favoritos, /carrinho, /pagamento, /perfil, /carteiras.

Decisões/desvios a documentar no ARCHITECTURE.md:
- Hero com arte estática (não espera a API) para não atrasar o LCP; links apontam aos destaques da API.
- Edição padrão no detalhe = a mais barata disponível (o Figma mostra 1/50 selecionada com o preço do card).
- "Contrato" e "Direitos autorais" do Figma estavam trocados; corrigido o conteúdo.
- Checkboxes visíveis nos filtros (acessibilidade); "Limpar filtros" e chip "Resultados para" não existem no Figma.
- Ícones de coração e "scan" da tab bar vêm do lucide (não foram exportados do Figma).
- Header desktop a partir de lg (1024); abaixo disso, layout mobile com tab bar e filtros em drawer.

## Etapa 4: o que foi feito

| Parte | Arquivos |
| --- | --- |
| Sessão | `src/features/session/session.ts` (`sessionQuery`, `requireAuth`, `startSession`, `clearSession`, `redirectSearchSchema` com `redirect` e `expirada`) |
| Hooks | `src/features/session/{use-viewer,mutations,use-session-sync}.ts` (`useSession`, `useViewerScope`, login/cadastro/logout, expiração por 401 e por timer, reconexão do Socket.IO) |
| Telas | `src/features/auth/{auth-screen,auth-forms}.tsx`, `src/routes/{entrar,cadastro}.tsx` (modal no desktop, tela cheia no mobile) |
| Formulários | `src/components/form/form-field.tsx` (FormField, PasswordField, FormAlert), `src/lib/use-api-form.ts` (`applyApiError`: fieldErrors da API → campos) |
| Favoritos | `src/features/favorites/{favorites.ts,favorite-button.tsx}`, `src/routes/favoritos.tsx` (otimista + rollback por item + revalidação) |
| Card | ações rápidas no hover/foco (carrinho, favoritar, ver) e coração no mobile; contrato ganhou `defaultEditionId` |
| Header | `src/components/layout/user-menu.tsx` (avatar, Meu perfil, Carteiras, Favoritos, Sair) |
| Rotas privadas | `staticData: { private: true }` + `beforeLoad: requireAuth` em favoritos, perfil, carteiras, pagamento |
| Testes | `e2e/auth.spec.ts`, `e2e/support/auth.ts` |

Decisões e armadilhas:
- **Toast emitido antes do `<Toaster>` montar é descartado pelo Sonner.** Expiração ao carregar uma rota privada redireciona com `?expirada=1` e a tela de login mostra o aviso inline (`role="status"`); toast só para expiração em página pública.
- **Rollback otimista não pode restaurar snapshot `undefined`** (`setQueryData(undefined)` é ignorado): o rollback desfaz só a alteração do item e `onSettled` revalida.
- No mobile os toasts ficam a 76px do topo (`mobileOffset`) para não encobrir voltar/favoritar.
- PBKDF2 do mock com 20k iterações (custo de CPU nos testes paralelos); `DB_SCHEMA_VERSION` = 3.
- Playwright: 2 workers, timeout 45 s, expect 10 s (execução estável nesta máquina; sem retries locais).
- Logout no mobile fica no Perfil (etapa 7); o teste de logout roda só no desktop por enquanto.

## Etapa 5: o que foi feito

| Parte | Arquivos |
| --- | --- |
| Tela | `src/routes/carrinho.tsx` (trilha/título, avisos de preço alterado e cupom inválido, vazio, erro, "Colecionadores também viram") |
| Itens | `src/features/cart/components/cart-item.tsx` (linha da tabela no desktop, card no mobile, status por item em texto) |
| Resumo | `src/features/cart/components/cart-summary.tsx` (cupom, valores da cotação, skeleton, "Conectar e finalizar" bloqueado com motivo) |
| Regras | `src/features/cart/checkout-rules.ts` (`blockingReason`: esgotado, acima do limite, preço não aceito, cupom inválido) |
| Queries | `src/features/cart/queries.ts` (`quoteQuery` com assinatura do carrinho; pausada durante mutations) |
| Mutations | `src/features/cart/mutations.ts` (scope serial `cart:<usuário>`, `mutationKey [cart]`, quantidade/remoção otimistas com rollback, cupom, aceitar preços) |
| Carrossel | `NftCarousel` genérico em `src/features/nft-detail/components/related.tsx` |
| Testes | `e2e/cart.spec.ts` |

Decisões:
- Valores do resumo vêm sempre da cotação da API (`POST /quotes`); o cliente nunca recalcula totais.
- A chave da cotação inclui versão do carrinho + preços/disponibilidade por item: `nft.updated` (que invalida o carrinho) gera nova cotação.
- Mutations do carrinho rodam em série (scope do TanStack Query): sem respostas fora de ordem nos cliques rápidos.
- Preço alterado exige "Aceitar novos preços" (`POST /cart/acknowledge`) antes de finalizar.
- Desktop mostra "ID do token · Edição" sob o nome (o Figma mostra só o ID). No mobile o carrinho é tela cheia, sem tab bar (como no Figma).

## Etapa 6: o que foi feito

| Parte | Arquivos |
| --- | --- |
| Tela de pagamento | `src/routes/pagamento.tsx` (formulário + rascunho, carteira/rede, conexão simulada, revisão, envio, aviso de pedido pendente) |
| Painéis | `src/features/checkout/components/checkout-panels.tsx` (CollectorFields, QuoteLines, QuoteTotals, WalletConnectionPanel) |
| Revisão | `src/features/checkout/components/review-dialog.tsx` (cotação congelada; problemas: changed/price/availability/retry/error) |
| Formulário | `src/features/checkout/checkout-form.ts` (`CollectorInput` + rede + carteira secundária) |
| Idempotência / rascunho | `src/features/checkout/storage.ts` (sessionStorage: `kurio:checkout-draft:<user>`, `kurio:checkout-attempt:<user>`) |
| Envio | `src/features/checkout/use-place-order.ts` (`retry: false`, chave reaproveitada para o mesmo conteúdo, `staleQuoteFrom`) |
| Pedido | `src/routes/pedidos.$orderId.tsx` (pendente / recibo confirmado / recusado), `src/features/orders/queries.ts` (`useOrderRealtime`, polling 5 s só enquanto pendente) |
| Carteiras | `src/features/wallets/queries.ts` (`useWallets`, `shortAddress`) |
| Regras | `src/features/cart/checkout-rules.ts` (`sameQuoteValues`) |
| Testes | `e2e/checkout.spec.ts` |

Decisões:
- Revisão obrigatória antes do envio; se a cotação ao vivo mudar (ex.: `nft.updated`) a revisão é invalidada e exige "Revisar novos valores".
- 409 `QUOTE_STALE` traz a nova cotação em `details.quote`; com `PRICE_CHANGED` o usuário aceita os preços (`/cart/acknowledge`) e confirma de novo.
- Timeout/rede: o botão vira "Tentar novamente" e reenvia o MESMO corpo com a MESMA `Idempotency-Key` (servidor devolve o mesmo pedido).
- Logout apaga rascunhos do checkout; expiração os mantém (`clearSession(client, { keepDrafts: true })`); login de outro usuário apaga rascunhos alheios.
- "Código de indicação" e "Nome ENS" opcionais (no Figma têm asterisco) — decisão de UX; dados da carteira vêm da carteira cadastrada (somente leitura).
- Mobile: ordem resumo → formulário → carteira/confirmar; carrinho e pagamento sem rodapé e sem tab bar (telas cheias, como no Figma).

## Etapa 7: o que foi feito

| Parte | Arquivos |
| --- | --- |
| Layout da conta | `src/features/account/account-layout.tsx` (menu "Meu perfil"; mobile: faixa rolável com "Sair") |
| Perfil | `src/routes/perfil.tsx` (dados, avatar, alterar senha), `src/features/account/profile.ts` (queries/mutations, `prepareAvatar`) |
| Carteiras | `src/routes/carteiras.tsx` (principal e secundária, "Igual à carteira principal", estados vazios) |
| Testes | `e2e/account.spec.ts`; logout mobile habilitado em `e2e/auth.spec.ts` |

Decisões:
- "Lista de interesse" → /favoritos; Atividade, Ofertas, Arquivos baixados e Suporte avisam que estão fora do escopo.
- Perfil: dois botões ("Salvar" dados e "Alterar senha") em vez do único "Salvar" do Figma, para o resultado de cada ação ficar claro.
- Avatar validado (PNG/JPEG/WebP, até 2 MB) e reduzido no navegador para 256px WebP antes do envio (data URL pequena no mock).
- Carteiras: campos do contrato `WalletInput` (nome, apelido, rede, tipo, endereço 0x, ENS). "Nome do perfil", "E-mail" e "Código de indicação"
  do frame pertencem ao perfil do colecionador/pagamento e não à carteira. "Igual à carteira principal" copia tudo menos o endereço
  (o servidor rejeita o mesmo endereço nas duas).
- `applyApiError`: erro indicado pela API num campo aparece só no campo (sem aviso geral duplicado).

## Revisão de fidelidade ao Figma (feita junto com a etapa 8)

A pedido, todos os desvios visuais foram removidos — a interface agora reproduz os frames:
- Catálogo com **239 NFTs** e as contagens exatas das coleções do Figma (33, 12, 65, 39, 23, 17, 19, 13, 18); itens do filtro em laranja
  com a contagem em negrito, sem caixa de seleção visível (checkbox nativo `sr-only`; selecionado = negrito + fundo).
- Todos os NFTs com as 4 edições; **1/50 é a edição padrão** e tem o preço do card (`defaultEditionId`); 1/1 esgotada só fora dos 9 NFTs do Figma.
- Detalhe: textos idênticos (inclusive "Kurio Editions" e os rótulos "Contrato"/"Direitos autorais" como no frame), galeria com a mesma arte
  (2ª miniatura selecionada), mobile com imagem única (deslize) e o resumo curto "1/50"; relacionados curados (Cosmic Bloom, Violet Nomad,
  Ivory Baron, Golden Beat, Golden Signal) completados até 15 itens (3 páginas).
- Carrinho com só "ID do token" no desktop e desconto "(-) 00.00"; login/cadastro sem textos extras, modal sem escurecimento e com a home atrás.
- Perfil com **um único "Salvar"** (dados + senha) e Nome ENS/Apelido obrigatórios (`EnsField` com o seletor ".eth").
- Carteiras com **todos os campos do frame** (contrato `Wallet` ganhou `profileName`, `secondaryAddress`, `referralCode`, `email`; ENS obrigatório).
- Pagamento com os campos/obrigatórios do frame (Código de indicação e Nome ENS obrigatórios), "Carteira e rede" como a lista de rádios do
  Figma (escolher o provedor conecta a carteira), mobile como o frame (carteiras cadastradas, "Trocar carteira", W/M/Coinbase, Total).
- Confirmação como modal sobre fundo sólido; data "29 Jul, 2026".
- Painel de cenários **oculto por padrão** (ativar com `?painel=1`, desativar com `?painel=0`).

Inconsistências do próprio Figma (registradas no ARCHITECTURE.md): as contagens de rede (119/78/86 = 283) não fecham com as de coleção
(239) — distribuídas proporcionalmente (100/66/73); o frame mobile do pagamento não tem os campos do colecionador — ficam recolhidos em
"Dados do colecionador" (estado não desenhado), abrindo sozinhos em caso de erro.

Outras correções: validação dos formulários no envio (`mode: 'onSubmit'`) — a validação no blur deslocava o layout por ancoragem de
rolagem e o clique no botão se perdia; foco devolvido ao botão da busca ao fechar o diálogo (`DialogTrigger`); foco inicial no 1º campo do login/cadastro.

## Etapa 8: o que foi feito

- `e2e/visual.spec.ts`: regressão visual de início, detalhe, carrinho e pagamento (desktop e mobile), baselines em `e2e/visual.spec.ts-snapshots/`.
- `e2e/keyboard.spec.ts`: skip link, foco visível, diálogo de busca (focus trap + retorno do foco), drawer de filtros, grupo de edições com setas, login por teclado.
- `docs/TESTES.md`: matriz dos 12 cenários → specs, isolamento, controle de tempo/eventos, artefatos.
- Script `npm run test:e2e:visual`.

## Etapa 9: o que foi feito

- `lighthouse/config.mjs` (configuração versionada), `scripts/lighthouse.mjs` (preview do build, 3 medições/página/perfil em Chrome novo,
  medianas, LCP/CLS/TBT), `lighthouse/RESULTADOS.md` (gerado), `lighthouse/summary.json`, `lighthouse/reports/*.report.{html,json}`,
  `lighthouse/ANALISE.md` (causas e justificativas). Script: `npm run lighthouse` (`LH_RUNS=1` para medição rápida).
- Medianas: desktop 98/100/100/100 nas duas páginas; mobile início 55 e detalhe 65 em Performance (Accessibility, Best Practices e SEO = 100).
- Otimizações: inicialização progressiva (`src/lib/boot.ts`: requisições e socket aguardam o MSW; params `?cenario`/`?painel` lidos antes do Router
  em `src/mocks/boot-params.ts`), conteúdo com `min-h-dvh` (CLS 0,288 → 0), hero por breakpoint, header desktop lazy, alvos de toque ≥ 24 px,
  `role="img"` nas estrelas, `h2` no painel de detalhes, `robots.txt`.
- Desvio mínimo do Figma por acessibilidade: espaço entre os pontos dos carrosséis 8 → 16 px (alvos de 24 px, WCAG 2.5.8).

## Etapa 10: o que foi feito

- `README.md`: stack, instalação a partir de checkout limpo, variáveis de ambiente, comandos, credenciais, cenários (URL, painel, API de
  controle), reset e passo a passo de cada fluxo de falha.
- `ARCHITECTURE.md`: organização, contratos REST e envelope de erro, eventos Socket.IO, sessão, carrinho/cotação, checkout idempotente,
  cache e retries, reconciliação REST × Socket.IO, boot progressivo, mocks, limitações (binding e performance mobile), decisões de UX e
  desvios/inconsistências do Figma.
- Verificação final: typecheck, lint e build sem erros; clone limpo → `npm ci` → typecheck/lint/build OK; suíte Playwright completa;
  deploy de produção e conferência das rotas diretas.
- `e2e/account.spec.ts`: o helper `pick` espera o Select fechar antes da próxima ação (instabilidade rara sob carga).
- Observação: o npm 11 avisa sobre o `postinstall` do `msw` não aprovado; é inofensivo (o worker já está em `public/`).

Pontos a observar numa continuação: Performance mobile do Lighthouse (55/65) — caminhos em `lighthouse/ANALISE.md`.

## Comandos

```bash
npm run dev            # desenvolvimento com mocks
npm run build          # tsc -b + vite build
npm run preview        # serve o build
npm run typecheck
npm run lint
npm run test:e2e       # Playwright (build + preview)
npm run lighthouse     # auditoria (3 medições, medianas)
```
