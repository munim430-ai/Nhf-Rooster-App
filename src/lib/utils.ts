import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return 'id' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function escHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  )
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function monthKeyLabel(key: string): string {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]
  const [y, m] = key.split('-').map(Number)
  return `${months[m - 1]} ${y}`
}

export function isHolidayDay(day: number, year: number, month: number, holidays: { date: number; year: number; month: number }[]): boolean {
  const wd = new Date(year, month - 1, day).getDay()
  return wd === 5 || holidays.some(h => h.date === day && h.year === year && h.month === month)
}

export function wardDisplayLabel(name: string): string {
  const map: Record<string, string> = {
    'Observation':'Observation', '3A':'W-3A', '3B':'W-3B', '5A':'W-5A', '5B':'W-5B',
    '5C':'W-5C', '5D':'W-5D', '7':'W-7(CCU-2)', '9':'W-9', '10':'W-10', '12':'W-12', 'HTN':'HTN',
    'Cabin':'Cabin', 'DS 15A':'DS 15A', 'DS 15B':'DS 15B', 'DS 15C':'DS 15C',
    'DS 9A':'DS W-9A', 'DS 9B':'DS W-9B', 'DS 8':'DS W-8',
    'OPD A':'OPD A', 'OPD B':'OPD B', 'OPD C':'OPD C', 'Cath':'Cath Lab'
  }
  return map[name] || name
}

export function wardShortSuffix(name: string): string {
  const full = wardDisplayLabel(name)
  const m = full.match(/^(W-|DS W-)(.+)$/)
  return m ? m[2] : full
}

export function stationDisplayLabel(station: { wards: string[] }): string {
  if (station.wards.length === 1) return wardDisplayLabel(station.wards[0])
  const prefix = station.wards[0].startsWith('DS') ? 'DS W-' : 'W-'
  return prefix + station.wards.map(wardShortSuffix).join('+')
}
