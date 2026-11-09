# Testes E2E (Playwright)

Todos os testes rodam contra o **build otimizado** (`vite preview`) com a camada **MSW ativa** (REST e Socket.IO simulados),
em **Chromium**, nos projetos `desktop-chromium` (1440×900) e `mobile-chromium` (390×844).

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
- **Asserções na interface:** os testes observam o que o usuário vê (papéis, nomes acessíveis, textos, URL).
  A API é consultada só para preparar estado ou conferir o resultado de uma operação (ex.: nenhum pedido duplicado).
- **Artefatos:** relatório HTML em `playwright-report/`; trace, screenshot e vídeo das falhas em `test-results/` (`trace: retain-on-failure`).
- **Execução:** 2 workers, timeout de 45 s por teste e 10 s por asserção (estável em máquinas modestas), sem retries locais (1 no CI).

## Matriz dos cenários do desafio

| # | Cenário do enunciado | Spec / teste |
| --- | --- | --- |
| 1 | Busca, filtros combinados, ordenação, paginação e restauração pelo histórico | `catalog.spec.ts` › filtros combinados compõem a URL…; busca pela URL e resultado vazio |
| 2 | Acesso direto ao detalhe e recurso inexistente | `catalog.spec.ts` › acesso direto, edição indisponível, limite…; NFT inexistente |
| 3 | Cadastro, login, expiração de sessão, logout e troca de usuário | `auth.spec.ts` › cadastro…; login…; expiração (401 e relógio controlado); logout e troca de usuário |
| 4 | Favoritos, falha de mutation e recuperação | `auth.spec.ts` › favoritos: atualização otimista, rollback na falha e persistência |
| 5 | Carrinho, quantidades, remoção, cupom, persistência após refresh/login | `cart.spec.ts` › quantidades, cupom, resumo…; limite da edição; `auth.spec.ts` › carrinho do visitante preservado ao autenticar |
| 6 | Compra completa, do catálogo ao recibo confirmado | `checkout.spec.ts` › compra completa do catálogo ao recibo confirmado (snapshot imutável) |
| 7 | Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido | `checkout.spec.ts` › pagamento recusado…; clique repetido…; timeout após a criação (relógio controlado); `mock-layer.spec.ts` › pedido idempotente |
| 8 | Perfil, avatar, senha e carteiras, com erros de validação | `account.spec.ts` › perfil; avatar; alteração de senha; carteiras |
| 9 | Alteração de preço/disponibilidade via Socket.IO durante o checkout | `checkout.spec.ts` › preço alterado via Socket.IO…; edição esgotada…; `cart.spec.ts` › alteração de preço e disponibilidade via Socket.IO |
| 10 | Eventos duplicados ou antigos, desconexão e retomada de pedido pendente | `checkout.spec.ts` › pedido pendente: refresh, desconexão e retomada…; `mock-layer.spec.ts` › duplicatas/antigos; reconexão |
| 11 | Navegação por teclado, foco de diálogos e validação de formulários | `keyboard.spec.ts` (skip link, cards, diálogo de busca, drawer de filtros, grupo de edições, login) |
| 12 | Skeletons em carregamento lento, feedback de falha e recuperação | `catalog.spec.ts` › skeletons durante carregamento lento; falha da API…; `cart.spec.ts` › skeleton do resumo |

Regressão visual (`visual.spec.ts`): **início, detalhe, carrinho e pagamento** em desktop e mobile.
Baselines versionadas em `e2e/visual.spec.ts-snapshots/` (geradas em Windows/Chromium; em outro SO o Playwright usa o sufixo da
plataforma e as baselines precisam ser geradas uma vez com `npm run test:e2e:update -- e2e/visual.spec.ts`).

Também: `smoke.spec.ts` (aplicação sobe com o MSW, 404) e `mock-layer.spec.ts` (contratos REST e eventos da camada de mocks).
