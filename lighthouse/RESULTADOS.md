# Resultados Lighthouse

Gerado por `npm run lighthouse` em 2026-11-09T17:49:12.355Z.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio (`/`) | mobile | **55** ⚠️ | 100 | 100 | 100 | 6.00 s | 0 | 987 ms |
| inicio (`/`) | desktop | 98 | 100 | 100 | 100 | 1.10 s | 0.003 | 75 ms |
| detalhe (`/nft/emerald-ape-042`) | mobile | **65** ⚠️ | 100 | 100 | 100 | 4.72 s | 0 | 747 ms |
| detalhe (`/nft/emerald-ape-042`) | desktop | 98 | 100 | 100 | 100 | 1.05 s | 0 | 0 ms |

Valores = **mediana de 3 medições**. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

## Medições individuais

| Execução | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio-mobile-1 | 55 | 100 | 100 | 100 | 6096 ms | 0 | 1043 ms |
| inicio-mobile-2 | 53 | 100 | 100 | 100 | 6005 ms | 0 | 987 ms |
| inicio-mobile-3 | 59 | 100 | 100 | 100 | 5601 ms | 0 | 661 ms |
| inicio-desktop-1 | 98 | 100 | 100 | 100 | 1074 ms | 0.003 | 76 ms |
| inicio-desktop-2 | 97 | 100 | 100 | 100 | 1157 ms | 0.003 | 75 ms |
| inicio-desktop-3 | 98 | 100 | 100 | 100 | 1097 ms | 0.003 | 34 ms |
| detalhe-mobile-1 | 66 | 100 | 100 | 100 | 4640 ms | 0 | 727 ms |
| detalhe-mobile-2 | 63 | 100 | 100 | 100 | 4717 ms | 0 | 880 ms |
| detalhe-mobile-3 | 65 | 100 | 100 | 100 | 4720 ms | 0 | 747 ms |
| detalhe-desktop-1 | 98 | 100 | 100 | 100 | 1047 ms | 0 | 0 ms |
| detalhe-desktop-2 | 98 | 100 | 100 | 100 | 1132 ms | 0 | 32 ms |
| detalhe-desktop-3 | 99 | 100 | 100 | 100 | 1037 ms | 0 | 0 ms |

## Ambiente e condições

- Lighthouse 13.6.0; navegador: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.0.0 Safari/537.36
- Node v24.18.0; Windows_NT 10.0.26200 (x64); CPU Intel(R) Processor U300 × 6; 8 GB RAM
- Servidor: vite preview (build de produção) em http://localhost:4175
- Mocks: MSW ativo, cenário padrão ("padrao": latência fixa de 150 ms por requisição REST)
- Throttling mobile: `{"rttMs":150,"throughputKbps":1638.4,"requestLatencyMs":562.5,"downloadThroughputKbps":1474.5600000000002,"uploadThroughputKbps":675,"cpuSlowdownMultiplier":4}`
- Throttling desktop: `{"rttMs":40,"throughputKbps":10240,"requestLatencyMs":0,"downloadThroughputKbps":0,"uploadThroughputKbps":0,"cpuSlowdownMultiplier":1}`
- Cada medição usa um Chrome novo (sem cache, storage ou service worker de execuções anteriores).
- Relatórios completos: `lighthouse/reports/*.report.html` e `*.report.json`.
