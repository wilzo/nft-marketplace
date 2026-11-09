/**
 * Auditoria Lighthouse reproduzível: sobe o build (vite preview), roda 3 medições por página e perfil,
 * salva relatórios HTML/JSON e gera a mediana de cada categoria + LCP, CLS e TBT.
 * Uso: npm run lighthouse   (faz o build antes)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import config from '../lighthouse/config.mjs'

const root = process.cwd()
const out = path.join(root, config.outputDir)
fs.mkdirSync(out, { recursive: true })
const baseUrl = `http://localhost:${config.port}`

const median = (values) => {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(config.port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  shell: process.platform === 'win32',
})

const results = []
try {
  await waitForServer(baseUrl)
  const chromePath = chromium.executablePath()

  for (const page of config.pages) {
    for (const profile of config.profiles) {
      for (let run = 1; run <= config.runs; run++) {
        const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: config.chromeFlags })
        try {
          const flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: config.categories }
          const result = await lighthouse(`${baseUrl}${page.path}`, flags, profile === 'desktop' ? desktopConfig : undefined)
          const lhr = result.lhr
          const name = `${page.name}-${profile}-${run}`
          fs.writeFileSync(path.join(out, `${name}.report.html`), result.report[0])
          fs.writeFileSync(path.join(out, `${name}.report.json`), result.report[1])
          const entry = {
            page: page.name,
            profile,
            run,
            scores: Object.fromEntries(config.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
            cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
            tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
            fcpMs: Math.round(lhr.audits['first-contentful-paint'].numericValue),
            userAgent: lhr.environment.hostUserAgent,
            lighthouseVersion: lhr.lighthouseVersion,
            throttling: lhr.configSettings.throttling,
            formFactor: lhr.configSettings.formFactor,
          }
          results.push(entry)
          console.log(`${name}: ${JSON.stringify(entry.scores)} LCP=${entry.lcpMs}ms CLS=${entry.cls} TBT=${entry.tbtMs}ms`)
        } finally {
          await chrome.kill()
        }
      }
    }
  }
} finally {
  server.kill()
  if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
}

// ---------- Medianas e relatório ----------
const groups = []
for (const page of config.pages) {
  for (const profile of config.profiles) {
    const runs = results.filter((r) => r.page === page.name && r.profile === profile)
    groups.push({
      page: page.name,
      path: page.path,
      profile,
      median: {
        ...Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        lcpMs: median(runs.map((r) => r.lcpMs)),
        cls: median(runs.map((r) => r.cls)),
        tbtMs: median(runs.map((r) => r.tbtMs)),
      },
      runs,
    })
  }
}

const sample = results[0]
const environment = {
  date: new Date().toISOString(),
  lighthouse: sample?.lighthouseVersion,
  browser: sample?.userAgent,
  node: process.version,
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  memoryGb: Math.round(os.totalmem() / 1e9),
  server: `vite preview (build de produção) em ${baseUrl}`,
  mocks: 'MSW ativo, cenário padrão ("padrao": latência fixa de 150 ms por requisição REST)',
  throttling: {
    mobile: results.find((r) => r.profile === 'mobile')?.throttling,
    desktop: results.find((r) => r.profile === 'desktop')?.throttling,
  },
}
fs.writeFileSync(path.join(root, 'lighthouse/summary.json'), JSON.stringify({ environment, targets: config.targets, groups }, null, 2))

const label = { performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best Practices', seo: 'SEO' }
const mark = (c, v) => (v >= config.targets[c] ? `${v}` : `**${v}** ⚠️`)
let md = `# Resultados Lighthouse\n\nGerado por \`npm run lighthouse\` em ${environment.date}.\n\n`
md += `| Página | Perfil | ${config.categories.map((c) => label[c]).join(' | ')} | LCP | CLS | TBT |\n`
md += `| --- | --- | ${config.categories.map(() => '---:').join(' | ')} | ---: | ---: | ---: |\n`
for (const g of groups) {
  md += `| ${g.page} (\`${g.path}\`) | ${g.profile} | ${config.categories.map((c) => mark(c, g.median[c])).join(' | ')} | ${(g.median.lcpMs / 1000).toFixed(2)} s | ${g.median.cls} | ${g.median.tbtMs} ms |\n`
}
md += `\nValores = **mediana de ${config.runs} medições**. Metas: ${config.categories.map((c) => `${label[c]} ≥ ${config.targets[c]}`).join(', ')}.\n\n`
md += `## Medições individuais\n\n| Execução | ${config.categories.map((c) => label[c]).join(' | ')} | LCP | CLS | TBT |\n| --- | ${config.categories.map(() => '---:').join(' | ')} | ---: | ---: | ---: |\n`
for (const r of results) md += `| ${r.page}-${r.profile}-${r.run} | ${config.categories.map((c) => r.scores[c]).join(' | ')} | ${r.lcpMs} ms | ${r.cls} | ${r.tbtMs} ms |\n`
md += `\n## Ambiente e condições\n\n- Lighthouse ${environment.lighthouse}; navegador: ${environment.browser}\n- Node ${environment.node}; ${environment.os}; CPU ${environment.cpu}; ${environment.memoryGb} GB RAM\n- Servidor: ${environment.server}\n- Mocks: ${environment.mocks}\n- Throttling mobile: \`${JSON.stringify(environment.throttling.mobile)}\`\n- Throttling desktop: \`${JSON.stringify(environment.throttling.desktop)}\`\n- Cada medição usa um Chrome novo (sem cache, storage ou service worker de execuções anteriores).\n- Relatórios completos: \`lighthouse/reports/*.report.html\` e \`*.report.json\`.\n`
fs.writeFileSync(path.join(root, 'lighthouse/RESULTADOS.md'), md)
console.log('\nResumo em lighthouse/RESULTADOS.md')
