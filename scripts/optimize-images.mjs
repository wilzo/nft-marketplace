/**
 * Gera as variantes WebP responsivas das artes de NFT a partir das imagens originais
 * exportadas do Figma (docs/figma/source-images, 1254×1254 PNG ~2 MB).
 * Uso: npm run assets:images
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'docs/figma/source-images'
const OUT = 'public/images/nfts'
const WIDTHS = [320, 640, 960]

fs.mkdirSync(OUT, { recursive: true })

for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.png'))) {
  const name = path.basename(file, '.png')
  for (const w of WIDTHS) {
    const dest = path.join(OUT, `${name}-${w}.webp`)
    const info = await sharp(path.join(SRC, file)).resize(w, w).webp({ quality: 78 }).toFile(dest)
    console.log(`${dest}  ${(info.size / 1024).toFixed(0)} KB`)
  }
}
