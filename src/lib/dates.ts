/** Datumshelfer für den Wochenplan. Woche beginnt am Montag. */

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

/** Montag der Woche, in der das Datum liegt. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - offset)
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

export function weekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => toIsoDate(addDays(weekStart, index)))
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[fromIsoDate(iso).getDay()]!
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[fromIsoDate(iso).getDay()]!
}

export function formatDayMonth(iso: string): string {
  const date = fromIsoDate(iso)
  return `${date.getDate()}.${date.getMonth() + 1}.`
}

export function isToday(iso: string): boolean {
  return iso === toIsoDate(new Date())
}

/** "14.09. – 20.09.2026" */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(weekStart.getDate())}.${pad(weekStart.getMonth() + 1)}. – ${pad(end.getDate())}.${pad(
    end.getMonth() + 1,
  )}.${end.getFullYear()}`
}

/** ISO-Kalenderwoche, für die Anzeige im Kopf des Wochenplans. */
export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNumber + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3)
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}
