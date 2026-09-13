import { guessCategory, defaultStoreFor } from './guessCategory'
import type { RecipeIngredient, RecipeStep } from './types'
import { canonicalUnit, lookupUnit } from './units'

export interface RecipeDraft {
  title: string
  servings: number | null
  ingredients: Array<Omit<RecipeIngredient, 'id'>>
  steps: Array<Omit<RecipeStep, 'id'>>
}

/**
 * Erkennt eine Cookidoo-Rezept-URL und zieht die Rezept-ID heraus.
 *
 * Cookidoo-Inhalte sind lizenziert und haben keine offene Schnittstelle - wir
 * holen deshalb bewusst keine Rezeptdaten von dort, sondern speichern nur den
 * Link. Das Rezept selbst wird eingefügt oder eingetippt.
 */
export function parseCookidooUrl(url: string): { isCookidoo: boolean; recipeId: string | null } {
  try {
    const parsed = new URL(url.trim())
    const isCookidoo = /(^|\.)cookidoo\./i.test(parsed.hostname)
    if (!isCookidoo) return { isCookidoo: false, recipeId: null }
    const match = parsed.pathname.match(/\/recipes?\/[^/]*\/(r\d+)/i) ?? parsed.pathname.match(/(r\d{4,})/i)
    return { isCookidoo: true, recipeId: match?.[1] ?? null }
  } catch {
    return { isCookidoo: false, recipeId: null }
  }
}

const INGREDIENT_HEADINGS = /^(zutaten|ingredients|einkaufsliste)\b/i
const STEP_HEADINGS = /^(zubereitung|anleitung|schritte|so geht'?s|preparation|method)\b/i

/**
 * Zerlegt eingefügten Rezepttext in Zutaten und Schritte.
 *
 * Gedacht für "Rezept aus der Cookidoo-App teilen -> Text einfügen" und für
 * abgetippte Familienrezepte. Der Parser rät bewusst großzügig; korrigiert
 * wird hinterher im Editor, das ist schneller als alles einzeln einzutippen.
 */
export function parseRecipeText(raw: string): RecipeDraft {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const draft: RecipeDraft = { title: '', servings: null, ingredients: [], steps: [] }
  if (lines.length === 0) return draft

  let section: 'kopf' | 'zutaten' | 'schritte' = 'kopf'

  for (const line of lines) {
    if (INGREDIENT_HEADINGS.test(line)) {
      section = 'zutaten'
      continue
    }
    if (STEP_HEADINGS.test(line)) {
      section = 'schritte'
      continue
    }

    const servings = line.match(/(\d+)\s*(portion|portionen|personen|stück)/i)
    if (servings && draft.servings === null) {
      draft.servings = Number.parseInt(servings[1]!, 10)
      if (section === 'kopf') continue
    }

    if (section === 'kopf') {
      if (!draft.title) draft.title = stripBullet(line)
      continue
    }

    if (section === 'zutaten') {
      // Eine Zutatenzeile ohne Mengenangabe, die wie ein Satz aussieht, ist
      // meistens schon der erste Zubereitungsschritt.
      const parsed = parseIngredientLine(line)
      if (!parsed.quantity && line.length > 60) {
        section = 'schritte'
        draft.steps.push(buildStep(line))
        continue
      }
      draft.ingredients.push(parsed)
      continue
    }

    draft.steps.push(buildStep(line))
  }

  // Ohne erkannte Überschriften: alles, was mit einer Zahl beginnt, ist Zutat.
  if (draft.ingredients.length === 0 && draft.steps.length === 0) {
    for (const line of lines.slice(1)) {
      if (/^\d/.test(line)) draft.ingredients.push(parseIngredientLine(line))
      else draft.steps.push(buildStep(line))
    }
  }

  return draft
}

function stripBullet(line: string): string {
  return line.replace(/^[-*•–]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
}

/** "200 g Mehl (Type 405)" -> Menge, Einheit, Name, Anmerkung. */
export function parseIngredientLine(line: string): Omit<RecipeIngredient, 'id'> {
  let text = stripBullet(line)

  let note: string | null = null
  const noteMatch = text.match(/,\s*(gehackt|gewürfelt|geschnitten|gerieben|frisch|getrocknet|in stücken|in scheiben|nach geschmack|optional)[^,]*/i)
  if (noteMatch) {
    note = noteMatch[1]!.trim()
    text = text.replace(noteMatch[0], '').trim()
  }

  const match = text.match(/^(\d+(?:[.,]\d+)?(?:\s*[-–/]\s*\d+(?:[.,]\d+)?)?)\s*([^\s\d]+)?\s*(.*)$/)

  let quantity: number | null = null
  let unit: string | null = null
  let name = text

  if (match) {
    const [, rawQuantity, rawSecond, rest] = match
    // Bei Spannen wie "2-3 Zwiebeln" den oberen Wert nehmen - lieber zu viel einkaufen.
    const numbers = rawQuantity!.split(/[-–/]/).map((part) => Number.parseFloat(part.replace(',', '.')))
    const value = Math.max(...numbers.filter(Number.isFinite))
    if (Number.isFinite(value)) quantity = value

    if (rawSecond && lookupUnit(rawSecond)) {
      unit = canonicalUnit(rawSecond)
      name = (rest ?? '').trim()
    } else {
      name = `${rawSecond ?? ''} ${rest ?? ''}`.trim()
    }
  }

  name = name.replace(/^(der|die|das|von|vom)\s+/i, '').trim() || text
  const category = guessCategory(name)

  return {
    name,
    quantity,
    unit,
    category,
    store_type: defaultStoreFor(category),
    note,
    // Wasser kauft niemand fürs Kochen - direkt von der Liste nehmen.
    skip_shopping: /^(wasser|leitungswasser)$/i.test(name.trim()),
  }
}

function buildStep(line: string): Omit<RecipeStep, 'id'> {
  const text = stripBullet(line)
  return { text, ...parseThermomixSettings(text) }
}

/**
 * Liest Thermomix-Angaben aus einem Schritt heraus, z.B.
 * "3 Min./100 °C/Stufe 2" oder "20 Sek./Stufe 5/Linkslauf".
 */
export function parseThermomixSettings(text: string): {
  tm_seconds: number | null
  tm_temp: string | null
  tm_speed: string | null
  tm_reverse: boolean
  tm_varoma: boolean
} {
  let seconds: number | null = null

  const minutes = text.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minute[n]?)\b/i)
  if (minutes) seconds = Math.round(Number.parseFloat(minutes[1]!.replace(',', '.')) * 60)

  const secs = text.match(/(\d+)\s*(?:sek|sec|sekunde[n]?)\b/i)
  if (secs) seconds = (seconds ?? 0) + Number.parseInt(secs[1]!, 10)

  const varoma = /varoma/i.test(text)
  const tempMatch = text.match(/(\d{2,3})\s*°?\s*C\b/i)
  const temp = tempMatch ? `${tempMatch[1]}°C` : varoma ? 'Varoma' : null

  const speedMatch = text.match(/stufe\s*([\d,.]+(?:\s*-\s*[\d,.]+)?|soft|sanft)/i)
  const turbo = /turbo/i.test(text)
  const knead = /knet|teigstufe|ähre/i.test(text)
  const speed = speedMatch
    ? `Stufe ${speedMatch[1]!.replace(/\s/g, '')}`
    : turbo
      ? 'Turbo'
      : knead
        ? 'Teigstufe'
        : null

  return {
    tm_seconds: seconds,
    tm_temp: temp,
    tm_speed: speed,
    tm_reverse: /linkslauf|gegenlauf/i.test(text),
    tm_varoma: varoma,
  }
}

/** "3 Min./100°C/Stufe 2" für die Anzeige im Rezept. */
export function formatThermomixSettings(step: {
  tm_seconds: number | null
  tm_temp: string | null
  tm_speed: string | null
  tm_reverse: boolean
}): string {
  const parts: string[] = []
  if (step.tm_seconds !== null) {
    parts.push(
      step.tm_seconds >= 60 && step.tm_seconds % 60 === 0
        ? `${step.tm_seconds / 60} Min.`
        : step.tm_seconds >= 60
          ? `${Math.floor(step.tm_seconds / 60)}:${String(step.tm_seconds % 60).padStart(2, '0')} Min.`
          : `${step.tm_seconds} Sek.`,
    )
  }
  if (step.tm_temp) parts.push(step.tm_temp)
  if (step.tm_speed) parts.push(step.tm_speed)
  if (step.tm_reverse) parts.push('Linkslauf')
  return parts.join(' / ')
}
