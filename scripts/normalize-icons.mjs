/**
 * Converte os ícones monocromáticos exportados do Figma (src/assets/icons) para `currentColor`,
 * para que herdem a cor do texto (estados hover/ativo/desabilitado e contraste).
 * Logos de marca e ícones multicoloridos são mantidos como estão.
 * Uso: npm run assets:icons (idempotente)
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'src/assets/icons'
const KEEP = new Set(['social-google.svg', 'social-facebook.svg', 'header-cart.svg'])
const COLOR = /(fill|stroke)="#[0-9A-Fa-f]{3,8}"/g

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.svg'))) {
  if (KEEP.has(file)) continue
  const full = path.join(DIR, file)
  const svg = fs.readFileSync(full, 'utf8')
  const colors = new Set([...svg.matchAll(COLOR)].map((m) => m[0].split('"')[1].toUpperCase()))
  if (colors.size !== 1) {
    console.log(`ignorado (${colors.size} cores): ${file}`)
    continue
  }
  fs.writeFileSync(full, svg.replace(COLOR, '$1="currentColor"'))
  console.log(`currentColor: ${file}`)
}
