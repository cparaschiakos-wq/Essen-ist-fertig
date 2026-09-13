/**
 * Einheiten-Normalisierung für die Einkaufsliste.
 *
 * Zwei Zutaten aus verschiedenen Rezepten werden nur dann zusammengezählt,
 * wenn sie denselben Namen UND eine kompatible Einheit haben. 200 g Mehl und
 * 0,5 kg Mehl ergeben 700 g; 2 EL Öl und 100 ml Öl bleiben zwei Posten,
 * weil ein EL Öl je nach Rezept etwas anderes meint.
 */

export type UnitFamily = 'masse' | 'volumen' | 'stueck' | 'lose'

export interface UnitDef {
  /** Kanonische Schreibweise. */
  id: string
  family: UnitFamily
  /** Faktor zur Basiseinheit der Familie (g bzw. ml). */
  factor: number
  /** Alle Schreibweisen, die auf diese Einheit gemappt werden. */
  aliases: string[]
}

const UNIT_DEFS: UnitDef[] = [
  { id: 'g', family: 'masse', factor: 1, aliases: ['g', 'gr', 'gramm'] },
  { id: 'kg', family: 'masse', factor: 1000, aliases: ['kg', 'kilo', 'kilogramm'] },
  { id: 'ml', family: 'volumen', factor: 1, aliases: ['ml', 'milliliter'] },
  { id: 'l', family: 'volumen', factor: 1000, aliases: ['l', 'ltr', 'liter'] },
  { id: 'Stück', family: 'stueck', factor: 1, aliases: ['stück', 'stk', 'st', 'stueck', 'x'] },
  { id: 'EL', family: 'lose', factor: 1, aliases: ['el', 'esslöffel', 'esslöffel', 'essloeffel'] },
  { id: 'TL', family: 'lose', factor: 1, aliases: ['tl', 'teelöffel', 'teeloeffel'] },
  { id: 'Prise', family: 'lose', factor: 1, aliases: ['prise', 'prisen'] },
  { id: 'Bund', family: 'lose', factor: 1, aliases: ['bund', 'bünde'] },
  { id: 'Zehe', family: 'lose', factor: 1, aliases: ['zehe', 'zehen'] },
  { id: 'Dose', family: 'lose', factor: 1, aliases: ['dose', 'dosen'] },
  { id: 'Glas', family: 'lose', factor: 1, aliases: ['glas', 'gläser'] },
  { id: 'Packung', family: 'lose', factor: 1, aliases: ['packung', 'packungen', 'pck', 'pkg', 'p'] },
  { id: 'Scheibe', family: 'lose', factor: 1, aliases: ['scheibe', 'scheiben'] },
  { id: 'Becher', family: 'lose', factor: 1, aliases: ['becher'] },
  { id: 'Würfel', family: 'lose', factor: 1, aliases: ['würfel', 'wuerfel'] },
  { id: 'Handvoll', family: 'lose', factor: 1, aliases: ['handvoll', 'hand voll'] },
]

const UNIT_LOOKUP = new Map<string, UnitDef>()
for (const def of UNIT_DEFS) {
  UNIT_LOOKUP.set(def.id.toLowerCase(), def)
  for (const alias of def.aliases) UNIT_LOOKUP.set(alias, def)
}

/** Einheiten in der Reihenfolge, in der sie im Auswahlmenü erscheinen. */
export const UNIT_OPTIONS: string[] = UNIT_DEFS.map((d) => d.id)

export function lookupUnit(unit: string | null | undefined): UnitDef | null {
  if (!unit) return null
  const key = unit.trim().toLowerCase().replace(/\.$/, '')
  return UNIT_LOOKUP.get(key) ?? null
}

/** Vereinheitlicht die Schreibweise, lässt Unbekanntes unangetastet. */
export function canonicalUnit(unit: string | null | undefined): string | null {
  if (!unit || !unit.trim()) return null
  return lookupUnit(unit)?.id ?? unit.trim()
}

/**
 * Schlüssel, unter dem Posten zusammengefasst werden. Zutaten mit
 * unbekannter Einheit bekommen die Einheit selbst als Familie, damit
 * "2 Beutel" nicht mit "2 Riegel" verrechnet wird.
 */
export function unitFamilyKey(unit: string | null | undefined): string {
  const def = lookupUnit(unit)
  if (def) return def.family
  if (!unit || !unit.trim()) return 'ohne'
  return `frei:${unit.trim().toLowerCase()}`
}

/** Rechnet eine Menge in die Basiseinheit ihrer Familie um (g bzw. ml). */
export function toBaseAmount(quantity: number, unit: string | null): number {
  const def = lookupUnit(unit)
  return def ? quantity * def.factor : quantity
}

/**
 * Wandelt eine Basismenge zurück in eine gut lesbare Einheit:
 * 1500 g -> 1,5 kg, aber 800 g bleiben 800 g.
 */
export function fromBaseAmount(
  base: number,
  unit: string | null,
): { quantity: number; unit: string | null } {
  const def = lookupUnit(unit)
  if (!def) return { quantity: base, unit: canonicalUnit(unit) }

  if (def.family === 'masse') {
    return base >= 1000
      ? { quantity: round(base / 1000), unit: 'kg' }
      : { quantity: round(base), unit: 'g' }
  }
  if (def.family === 'volumen') {
    return base >= 1000
      ? { quantity: round(base / 1000), unit: 'l' }
      : { quantity: round(base), unit: 'ml' }
  }
  return { quantity: round(base), unit: def.id }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Normalisierter Zutatenname für den Abgleich zwischen Rezepten und mit dem
 * Vorrat. "Mehl (Type 405)" und " mehl " landen auf demselben Schlüssel.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMBER_FORMAT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** "1,5 kg" bzw. "3" wenn keine Einheit gesetzt ist. */
export function formatAmount(quantity: number | null, unit: string | null): string {
  if (quantity === null) return unit ?? ''
  const value = NUMBER_FORMAT.format(quantity)
  return unit ? `${value} ${unit}` : value
}

/**
 * Zerlegt eine getippte Zeile wie "2 kg Kartoffeln" in Menge, Einheit und Name.
 * Das ist die Schnelleingabe auf der Einkaufsliste - sie muss auch mit
 * "Kartoffeln", "2 Kartoffeln" und "1,5 l Milch" klarkommen.
 */
export function parseQuickEntry(input: string): {
  quantity: number | null
  unit: string | null
  name: string
} {
  const text = input.trim()
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜß.]+)?\s+(.*)$/)
  if (!match) return { quantity: null, unit: null, name: text }

  const [, rawQuantity, rawUnit, rawName] = match
  const quantity = Number.parseFloat(rawQuantity!.replace(',', '.'))
  if (!Number.isFinite(quantity)) return { quantity: null, unit: null, name: text }

  // "2 Zwiebeln" - das zweite Wort ist keine Einheit, sondern der Name.
  if (rawUnit && !lookupUnit(rawUnit)) {
    return { quantity, unit: null, name: `${rawUnit} ${rawName}`.trim() }
  }
  if (!rawUnit) return { quantity, unit: null, name: rawName!.trim() }
  return { quantity, unit: canonicalUnit(rawUnit), name: rawName!.trim() }
}
