// Official Bangladesh public holidays, used to pre-fill the Holidays page for a
// given month/year. Fixed national days repeat every year; movable religious
// holidays (Eid, Shab-e-Barat, Ashura, Puja, etc.) depend on moon sighting and
// are listed per year as they are announced.

interface BdHoliday {
  m: number // month, 1-12
  d: number // day of month
  label: string
}

const BD_HOLIDAYS_FIXED: BdHoliday[] = [
  { m: 2, d: 21, label: 'Shaheed Day & Int’l Mother Language Day' },
  { m: 3, d: 26, label: 'Independence Day' },
  { m: 4, d: 14, label: 'Pohela Boishakh (Bengali New Year)' },
  { m: 5, d: 1, label: 'May Day' },
  { m: 8, d: 5, label: 'July Mass Uprising Day' },
  { m: 12, d: 16, label: 'Victory Day' },
  { m: 12, d: 25, label: 'Christmas Day' },
]

const BD_HOLIDAYS_BY_YEAR: Record<number, BdHoliday[]> = {
  2025: [
    { m: 2, d: 15, label: 'Shab-e-Barat' },
    { m: 3, d: 28, label: 'Shab-e-Qadr' },
    { m: 3, d: 29, label: 'Eid-ul-Fitr Holiday' }, { m: 3, d: 30, label: 'Eid-ul-Fitr Holiday' },
    { m: 3, d: 31, label: 'Eid-ul-Fitr' }, { m: 4, d: 1, label: 'Eid-ul-Fitr Holiday' }, { m: 4, d: 2, label: 'Eid-ul-Fitr Holiday' },
    { m: 5, d: 11, label: 'Buddha Purnima' },
    { m: 6, d: 5, label: 'Eid-ul-Azha Holiday' }, { m: 6, d: 6, label: 'Eid-ul-Azha Holiday' },
    { m: 6, d: 7, label: 'Eid-ul-Azha' }, { m: 6, d: 8, label: 'Eid-ul-Azha Holiday' },
    { m: 6, d: 9, label: 'Eid-ul-Azha Holiday' }, { m: 6, d: 10, label: 'Eid-ul-Azha Holiday' },
    { m: 7, d: 6, label: 'Ashura' },
    { m: 8, d: 16, label: 'Janmashtami' },
    { m: 9, d: 5, label: 'Eid-e-Milad-un-Nabi' },
    { m: 10, d: 1, label: 'Durga Puja Holiday' }, { m: 10, d: 2, label: 'Durga Puja (Bijoya Dashami)' },
  ],
  2026: [
    { m: 2, d: 4, label: 'Shab-e-Barat' },
    { m: 3, d: 18, label: 'Shab-e-Qadr (approx — moon sighting)' },
    { m: 3, d: 19, label: 'Eid-ul-Fitr Holiday' }, { m: 3, d: 20, label: 'Eid-ul-Fitr Holiday' },
    { m: 3, d: 21, label: 'Eid-ul-Fitr (expected)' }, { m: 3, d: 22, label: 'Eid-ul-Fitr Holiday' }, { m: 3, d: 23, label: 'Eid-ul-Fitr Holiday' },
    { m: 5, d: 1, label: 'Buddha Purnima' },
    { m: 5, d: 25, label: 'Eid-ul-Azha Holiday' }, { m: 5, d: 26, label: 'Eid-ul-Azha Holiday' },
    { m: 5, d: 27, label: 'Eid-ul-Azha (expected)' }, { m: 5, d: 28, label: 'Eid-ul-Azha Holiday' },
    { m: 5, d: 29, label: 'Eid-ul-Azha Holiday' }, { m: 5, d: 30, label: 'Eid-ul-Azha Holiday' },
    { m: 6, d: 26, label: 'Ashura' },
    { m: 8, d: 26, label: 'Eid-e-Milad-un-Nabi (approx)' },
    { m: 9, d: 4, label: 'Janmashtami' },
    { m: 10, d: 20, label: 'Durga Puja Holiday' }, { m: 10, d: 21, label: 'Durga Puja (Bijoya Dashami)' },
  ],
}

export interface BdHolidayResult {
  list: { date: number; label: string }[]
  /** Whether this app has movable-holiday data for the requested year. */
  hasYearData: boolean
}

/** Official Bangladesh holidays that fall in the given month/year. */
export function bdHolidaysFor(year: number, month: number): BdHolidayResult {
  const fixed = BD_HOLIDAYS_FIXED.filter(h => h.m === month).map(h => ({ date: h.d, label: h.label }))
  const yearly = (BD_HOLIDAYS_BY_YEAR[year] || []).filter(h => h.m === month).map(h => ({ date: h.d, label: h.label }))
  return { list: fixed.concat(yearly), hasYearData: !!BD_HOLIDAYS_BY_YEAR[year] }
}
