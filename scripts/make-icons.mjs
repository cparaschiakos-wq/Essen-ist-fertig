/**
 * Erzeugt die PWA-Icons als PNG.
 *
 * Bewusst ohne Bildbibliothek: das Motiv (Topf mit Deckel und Dampf) ist rein
 * geometrisch, und so bleibt das Repo frei von Binärdateien, deren Herkunft
 * man später nicht mehr nachvollziehen kann. `npm run icons` baut sie neu.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = [194, 65, 12] // --accent
const CREAM = [250, 247, 242]
const STEAM = [253, 236, 227]

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // Bittiefe
  header[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // Filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Weiche Kante: 1 innerhalb, 0 außerhalb, dazwischen anteilig. */
function coverage(distance, edge) {
  return Math.max(0, Math.min(1, 0.5 - (distance - edge)))
}

function blend(target, offset, color, alpha) {
  if (alpha <= 0) return
  for (let channel = 0; channel < 3; channel++) {
    const current = target[offset + channel]
    target[offset + channel] = Math.round(current + (color[channel] - current) * alpha)
  }
  target[offset + 3] = Math.max(target[offset + 3], Math.round(255 * alpha))
}

function render(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4)
  // Bei maskable schneidet Android die Ecken großzügig weg - Motiv kleiner halten.
  const scale = maskable ? 0.62 : 0.78
  const center = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4

      // Hintergrund: abgerundetes Quadrat, bei maskable voll deckend.
      let bgAlpha = 1
      if (!maskable) {
        const radius = size * 0.22
        const dx = Math.max(Math.abs(x + 0.5 - center) - (center - radius), 0)
        const dy = Math.max(Math.abs(y + 0.5 - center) - (center - radius), 0)
        bgAlpha = coverage(Math.hypot(dx, dy), radius)
      }
      if (bgAlpha > 0) blend(pixels, offset, BG, bgAlpha)

      // Koordinaten relativ zur Motivmitte, normiert auf -1..1.
      const nx = (x + 0.5 - center) / (size * scale * 0.5)
      const ny = (y + 0.5 - center) / (size * scale * 0.5)
      const unit = size * scale * 0.5

      // Topfkörper: Halbkreis unterhalb der Deckellinie.
      const bodyDistance = (Math.hypot(nx, ny - 0.12) - 0.62) * unit
      if (ny > 0.05) blend(pixels, offset, CREAM, coverage(bodyDistance, 0))

      // Deckel: flaches Rechteck mit runden Enden.
      const lidX = Math.max(Math.abs(nx) - 0.62, 0)
      const lidY = Math.max(Math.abs(ny - 0.02) - 0.05, 0)
      blend(pixels, offset, CREAM, coverage(Math.hypot(lidX, lidY) * unit - 0.06 * unit, 0))

      // Knauf auf dem Deckel.
      blend(pixels, offset, CREAM, coverage((Math.hypot(nx, ny + 0.16) - 0.11) * unit, 0))

      // Drei Dampffähnchen darüber.
      for (const [sx, amplitude] of [[-0.3, 0.05], [0, 0.06], [0.3, 0.05]]) {
        const wave = sx + Math.sin((ny + 0.75) * 9) * amplitude
        const inColumn = Math.abs(nx - wave) < 0.055 && ny > -0.72 && ny < -0.26
        if (inColumn) blend(pixels, offset, STEAM, 0.92)
      }
    }
  }
  return encodePng(size, pixels)
}

mkdirSync(OUT_DIR, { recursive: true })
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
]
for (const [name, size, maskable] of targets) {
  writeFileSync(join(OUT_DIR, name), render(size, { maskable }))
  console.log(`${name} (${size}x${size})`)
}
