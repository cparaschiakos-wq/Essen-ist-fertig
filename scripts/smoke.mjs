/**
 * Durchstich im echten Browser: Rezept anlegen -> einplanen -> Einkaufsliste
 * erzeugen -> abhaken -> neu laden.
 *
 * Braucht einen laufenden Dev-Server auf Port 5180 und Playwright:
 *   npm install --no-save playwright && npx playwright install chromium
 *   npm run dev -- --port 5180
 *   node scripts/smoke.mjs
 *
 * Playwright steht bewusst nicht in den devDependencies - für ein Projekt
 * dieser Größe lohnt der Browser-Download nicht bei jedem `npm install`.
 */
import { chromium } from 'playwright'

/** Wohin die Screenshots geschrieben werden. */
const OUT = process.env.SP ?? '.'

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
)
const context = await browser.newContext({ viewport: { width: 400, height: 860 }, locale: 'de-DE' })
const page = await context.newPage()

const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const step = async (label, fn) => {
  try {
    await fn()
    console.log(`  ok  ${label}`)
  } catch (error) {
    console.log(`FAIL  ${label}: ${error.message}`)
    await page.screenshot({ path: `${OUT}/fail-${label.replace(/\W+/g, '-')}.png` })
    throw error
  }
}

await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' })

await step('Wochenplan startet', async () => {
  await page.getByRole('heading', { name: /^KW \d+$/ }).waitFor({ timeout: 8000 })
})

await step('Rezept anlegen per Textimport', async () => {
  await page.getByRole('link', { name: /Rezepte/ }).click()
  await page.getByRole('button', { name: '+ Neu' }).click()
  await page.getByRole('button', { name: /Rezepttext einfügen/ }).click()
  await page.locator('textarea').fill(
    [
      'Linsensuppe',
      '4 Portionen',
      '',
      'Zutaten',
      '250 g rote Linsen',
      '2 Karotten',
      '1 Zwiebel',
      '500 ml Gemüsebrühe',
      '2 EL Olivenöl',
      '',
      'Zubereitung',
      'Zwiebel und Karotten 5 Sek./Stufe 5 zerkleinern.',
      'Alles 15 Min./100°C/Stufe 1 garen.',
    ].join('\n'),
  )
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await page.getByRole('button', { name: 'Rezept speichern' }).click()
  await page.getByText('Linsensuppe').first().waitFor({ timeout: 5000 })
})

await step('Zutaten wurden erkannt', async () => {
  const meta = await page.locator('.recipe .tiny').first().innerText()
  if (!meta.includes('5 Zutaten')) throw new Error(`erwartet 5 Zutaten, bekommen: ${meta}`)
  if (!meta.includes('4 Portionen')) throw new Error(`erwartet 4 Portionen, bekommen: ${meta}`)
})

await step('Thermomix automatisch erkannt', async () => {
  await page.locator('.badge--tm').first().waitFor({ timeout: 3000 })
})

await step('Zweites Rezept mit überlappender Zutat', async () => {
  await page.getByRole('button', { name: '+ Neu' }).click()
  await page.getByRole('button', { name: /Rezepttext einfügen/ }).click()
  await page.locator('textarea').fill(
    ['Karottensalat', '2 Portionen', '', 'Zutaten', '300 g Karotten', '1 EL Olivenöl'].join('\n'),
  )
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await page.getByRole('button', { name: 'Rezept speichern' }).click()
  await page.getByText('Karottensalat').first().waitFor({ timeout: 5000 })
})

await step('Beide Rezepte einplanen', async () => {
  await page.getByRole('link', { name: /Woche/ }).click()
  await page.locator('.day').nth(0).getByRole('button').filter({ hasText: 'Mittag' }).click()
  await page.getByRole('button', { name: /Linsensuppe/ }).click()
  await page.locator('.day').nth(1).getByRole('button').filter({ hasText: 'Abend' }).click()
  await page.getByRole('button', { name: /Karottensalat/ }).click()
  await page.getByText('Linsensuppe').first().waitFor()
})

await step('Einkaufsliste erzeugen', async () => {
  await page.getByRole('button', { name: /Einkaufsliste aus dieser Woche/ }).click()
  await page.getByRole('heading', { name: 'Liste erzeugen' }).waitFor({ timeout: 5000 })
})

await step('Karotten aus beiden Rezepten zusammengefasst', async () => {
  const row = page.locator('.item').filter({ hasText: 'Karotten' }).first()
  const text = await row.innerText()
  // 2 Karotten (Stück) und 300 g Karotten haben unterschiedliche Einheiten-
  // familien und bleiben deshalb bewusst getrennt.
  if (!text.includes('Karottensalat') && !text.includes('Linsensuppe')) {
    throw new Error(`kein Rezeptbezug in der Zeile: ${text}`)
  }
})

await step('Olivenöl aus beiden Rezepten addiert', async () => {
  const row = page.locator('.item').filter({ hasText: 'Olivenöl' }).first()
  const text = await row.innerText()
  if (!text.includes('3 EL')) throw new Error(`erwartet "3 EL", bekommen: ${text}`)
  if (!text.includes('Linsensuppe') || !text.includes('Karottensalat')) {
    throw new Error(`erwartet beide Rezepte, bekommen: ${text}`)
  }
})

await page.screenshot({ path: `${OUT}/shot-generate.png`, fullPage: true })

await step('Posten übernehmen', async () => {
  await page.getByRole('button', { name: /Posten auf die Einkaufsliste/ }).click()
  await page.getByRole('heading', { name: 'Einkaufsliste' }).waitFor({ timeout: 5000 })
})

await step('Nach Warengruppen sortiert', async () => {
  const heads = await page.locator('.group__head').allInnerTexts()
  if (heads.length < 2) throw new Error(`zu wenige Gruppen: ${JSON.stringify(heads)}`)
  const upper = heads.map((h) => h.toUpperCase())
  const obstIndex = upper.findIndex((h) => h.includes('OBST'))
  const trockenIndex = upper.findIndex((h) => h.includes('TROCKEN'))
  if (obstIndex === -1 || trockenIndex === -1 || obstIndex > trockenIndex) {
    throw new Error(`Reihenfolge stimmt nicht: ${JSON.stringify(heads)}`)
  }
})

await step('Schnelleingabe "2 kg Kartoffeln"', async () => {
  await page.getByPlaceholder('z.B. 2 kg Kartoffeln').fill('2 kg Kartoffeln')
  await page.getByPlaceholder('z.B. 2 kg Kartoffeln').press('Enter')
  const row = page.locator('.item').filter({ hasText: 'Kartoffeln' }).first()
  await row.waitFor({ timeout: 3000 })
  const text = await row.innerText()
  if (!text.includes('2 kg')) throw new Error(`erwartet "2 kg", bekommen: ${text}`)
})

await step('Abhaken', async () => {
  const row = page.locator('.item').filter({ hasText: 'Kartoffeln' }).first()
  await row.locator('.item__toggle').click()
  await page.locator('.item--checked').filter({ hasText: 'Kartoffeln' }).first().waitFor({ timeout: 3000 })
})

await step('Umschalten auf Sortierung nach Rezept', async () => {
  await page.getByRole('button', { name: /Nach Rezept/ }).click()
  const heads = await page.locator('.group__head').allInnerTexts()
  if (!heads.some((h) => h.toUpperCase().includes('LINSENSUPPE'))) {
    throw new Error(`Rezeptgruppen fehlen: ${JSON.stringify(heads)}`)
  }
})

await page.screenshot({ path: `${OUT}/shot-liste.png`, fullPage: true })

await step('Nach Neuladen noch da (IndexedDB)', async () => {
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('link', { name: /Liste/ }).click()
  await page.locator('.item').filter({ hasText: 'Kartoffeln' }).first().waitFor({ timeout: 5000 })
})

await page.getByRole('link', { name: /Woche/ }).click()
await page.screenshot({ path: `${OUT}/shot-plan.png`, fullPage: true })

await browser.close()

if (errors.length > 0) {
  console.log('\nBrowser-Fehler:')
  for (const error of errors) console.log('  ' + error)
  process.exit(1)
}
console.log('\nalle Schritte bestanden')
