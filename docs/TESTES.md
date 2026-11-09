# Testes E2E (Playwright)

Todos os testes rodam contra o **build otimizado** (`vite preview`) com a camada **MSW ativa** (REST e Socket.IO simulados),
em **Chromium**, nos projetos `desktop-chromium` (1440×900) e `mobile-chromium` (390×844). A largura de tablet (768 px)
é coberta por `responsive.spec.ts` (sem rolagem horizontal em 768, 390 e 1440 px).

```bash
npm run test:e2e            # suíte completa (gera o build e sobe o preview automaticamente)
npm run test:e2e:visual     # só a regressão visual
npm run test:e2e:update     # atualiza as baselines visuais
npm run test:e2e:report     # abre o relatório HTML (playwright-report/)
```

- **Isolamento:** cada teste usa um contexto de navegador novo. O banco simulado vive no `localStorage` desse contexto,
  então todo teste parte do seed conhecido. O cenário é escolhido por `?cenario=` ou pela API de controle `/api/__mock/*`.
- **Tempo e eventos controlados:** `page.clock` (expiração de sessão e timeout do pedido), latência configurada por cenário,
  disparo de eventos pela API de controle (`PATCH /__mock/nfts/:id`, `POST /__mock/realtime/{replay,disconnect}`,
  `POST /__mock/orders/:id/settle`). Os eventos chegam à interface pelo **socket.io-client**; as chamadas REST passam pelos **handlers MSW**.
- **Sem mocks do Playwright:** nenhum teste usa `page.route`; REST passa pelos handlers MSW e eventos pelo socket.io-client.
- **Asserções na interface:** os testes observam o que o usuário vê (papéis, nomes acessíveis, textos, URL).
  A API é consultada só para preparar estado ou conferir o resultado de uma operação (ex.: nenhum pedido duplicado).
- **Artefatos:** relatório HTML em `playwright-report/`; trace, screenshot e vídeo das falhas em `test-results/` (`trace: retain-on-failure`).
- **Execução:** 2 workers, timeout de 45 s por teste e 10 s por asserção (estável em máquinas modestas), sem retries locais (1 no CI).

## Matriz dos cenários do desafio

| # | Cenário do enunciado | Spec / teste |
| --- | --- | --- |
| 1 | Busca, filtros combinados, ordenação, paginação e restauração pelo histórico | `catalog.spec.ts` › filtros combinados compõem a URL…; busca pela URL e resultado vazio |
| 2 | Acesso direto ao detalhe e recurso inexistente | `catalog.spec.ts` › acesso direto, edição indisponível, limite…; NFT inexistente |
| 3 | Cadastro, login, expiração de sessão, logout e troca de usuário | `auth.spec.ts` › cadastro (conflito no campo)…; login…; expiração (401 e relógio controlado); logout e troca de usuário sem recarregar (cache e Socket.IO); `login-regression.spec.ts` (Ana/Bruno com banco antigo, banco corrompido, duas abas); `social-login.spec.ts` (sucesso, cancelamento, conflito, `oauth-falha`, uso único); `simulated-apis.spec.ts` › sessão expira durante o checkout; senhas nunca em claro |
| 4 | Favoritos, falha de mutation e recuperação | `auth.spec.ts` › favoritos: atualização otimista, rollback na falha e persistência |
| 5 | Carrinho, quantidades, remoção, cupom, persistência após refresh/login | `cart.spec.ts` › quantidades, cupom inválido × expirado (resumo inalterado)…; limite da edição; `auth.spec.ts` › carrinho do visitante preservado ao autenticar |
| 6 | Compra completa, do catálogo ao recibo confirmado | `checkout.spec.ts` › compra completa…(snapshot imutável); `simulated-apis.spec.ts` › pendente até a simulação confirmar, referência/link da API, remoção parcial do carrinho; recusado terminal |
| 7 | Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido | `checkout.spec.ts` › pagamento recusado…; clique repetido…; timeout após a criação (relógio controlado); carteira: recusa e desconexão; `mock-layer.spec.ts` › pedido idempotente (mesma chave + outro conteúdo → 409); `simulated-apis.spec.ts` › carteira por rede, desconexão e pedido sem conexão (409) |
| 8 | Perfil, avatar, senha e carteiras, com erros de validação | `account.spec.ts` › perfil; avatar; alteração de senha; carteiras (cadastro, edição, erro da API, persistência) |
| 9 | Alteração de preço/disponibilidade via Socket.IO durante o checkout | `checkout.spec.ts` › preço alterado via Socket.IO…; edição esgotada…; `cart.spec.ts` › alteração de preço e disponibilidade via Socket.IO |
| 10 | Eventos duplicados ou antigos, desconexão e retomada de pedido pendente | `checkout.spec.ts` › pedido pendente: refresh, desconexão e retomada…; `mock-layer.spec.ts` › duplicatas/antigos; reconexão; `simulated-apis.spec.ts` › queda do Socket.IO reconciliada via REST; polling no `tempo-real-fora`; consistência REST × eventos (evento antigo ignorado); 403 entre usuários |
| 11 | Navegação por teclado, foco de diálogos e validação de formulários | `keyboard.spec.ts` (skip link, cards, diálogo de busca, drawer de filtros, grupo de edições, login) |
| 12 | Skeletons em carregamento lento, feedback de falha e recuperação | `catalog.spec.ts` › skeletons durante carregamento lento; falha da API…; `cart.spec.ts` › skeleton do resumo |

Regressão visual (`visual.spec.ts`): **início, detalhe, carrinho e pagamento** em desktop e mobile.
Baselines versionadas em `e2e/visual.spec.ts-snapshots/` para **Windows** (`*-win32.png`) e **Linux** (`*-linux.png`, geradas no
CI dentro da imagem oficial `mcr.microsoft.com/playwright:v1.65.0-noble`). Em macOS, gere uma vez com
`npm run test:e2e:update -- e2e/visual.spec.ts` (ou rode a suíte na mesma imagem Docker do CI).

**CI:** [.github/workflows/ci.yml](../.github/workflows/ci.yml) roda typecheck, lint e a suíte completa num Linux limpo a cada
push, publicando o relatório HTML (e traces das falhas) como artefatos. "Run workflow" com `update_snapshots` regera as
baselines de Linux.

**Zoom e reflow** (`responsive.spec.ts`): todas as telas, públicas e privadas, em 320 px (zoom de 400%, WCAG 1.4.10),
768, 390 e 1440 px, e com a fonte do navegador em 200% (WCAG 1.4.4) em 1280 e 390 px — nenhuma rolagem horizontal.

Também: `smoke.spec.ts` (aplicação sobe com o MSW, 404), `mock-layer.spec.ts` (contratos REST e eventos da camada de mocks)
e `responsive.spec.ts` (telas públicas e privadas sem rolagem horizontal em 768, 390 e 1440 px).

## Auditoria das APIs simuladas (`simulated-apis.spec.ts`)

| Verificação | Teste |
| --- | --- |
| Confirmação só depois de `confirmed` na simulação; pendente → confirmado/recusado, terminais não regridem | pendente até a simulação confirmar…; pagamento recusado é terminal |
| Referência da transação e link do explorador vindos da resposta | pendente até a simulação confirmar… (`title` = `txHash`, `href` = `explorerUrl`) |
| Carrinho: só itens/quantidades comprados saem; recusa preserva | idem + `checkout.spec.ts` › pagamento recusado preserva os itens |
| Recibo é snapshot | idem (preço alterado depois via `PATCH /__mock/nfts/:id`) |
| Refresh, queda do Socket.IO e polling sem nova compra | queda do Socket.IO…; tempo-real-fora…; `checkout.spec.ts` › pedido pendente: refresh… |
| Carteira: rede, conexão, recusa, desconexão | carteira: rede escolhida…; `checkout.spec.ts` › carteira: recusa e desconexão |
| Sessão: expiração no checkout com contexto | sessão expira durante o checkout… |
| Senha nunca em claro | senhas nunca ficam em claro… |
| REST × `nft.updated`/`order.updated` iguais; eventos antigos/duplicados ignorados | mudanças da simulação aparecem iguais… |
| Isolamento entre usuários | 403: um usuário não vê o pedido de outro |
