import type { Doctor, RosterEntry, EffectiveStations, Holiday, Shift, Station, Shortfall } from '@/types'
import { SHIFTS, SHIFT_LABEL, MONTHS } from '@/types'
import { computeRosterStats } from '@/lib/rosterStats'
import { stationDisplayLabel, isHolidayDay } from '@/lib/utils'

export interface RosterExportContext {
  doctors: Doctor[]
  roster: RosterEntry
  effectiveStations: EffectiveStations
  holidays: Holiday[]
  year: number
  month: number
  days: number
  hospitalName: string
  preparedByName: string
  warnings: string[]
  /** Effective monthly duty cap per doctor (after duty-bank + casual-leave reduction). Falls back to base target when absent. */
  effectiveTargets?: Record<string, number>
  /** Casual-leave days counted this month per doctor. */
  casualLeaveDays?: Record<string, number>
  /** Unfilled slots from generation, used for the ward-gaps flag. */
  shortfalls?: Shortfall[]
}


function fileStem(year: number, month: number): string {
  return `roster-${year}-${String(month).padStart(2, '0')}`
}

function weekdayShort(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
}

/** Stations that appear for a shift across the whole month, in first-seen order. */
function shiftColumns(ctx: RosterExportContext, shift: Shift): { id: string; label: string }[] {
  const cols: { id: string; label: string }[] = []
  const seen = new Set<string>()
  for (let day = 1; day <= ctx.days; day++) {
    const list = ctx.effectiveStations[day]?.[shift] || []
    for (const st of list) {
      if (!seen.has(st.id)) {
        seen.add(st.id)
        cols.push({ id: st.id, label: stationDisplayLabel(st) })
      }
    }
  }
  return cols
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------------
// CSV (.csv)
// ---------------------------------------------------------------------------
function csvEscape(val: string | number): string {
  const s = String(val ?? '')
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function exportRosterCsv(ctx: RosterExportContext): void {
  const nameOf = (id: string) => ctx.doctors.find(d => d.id === id)?.name || '—'
  const rows: (string | number)[][] = []

  rows.push([ctx.hospitalName])
  rows.push([`${MONTHS[ctx.month - 1]} ${ctx.year} — Duty Roster`])
  if (ctx.preparedByName) rows.push([`Prepared by ${ctx.preparedByName}`])
  rows.push([])

  // One block per shift: rows = days, columns = stations.
  SHIFTS.forEach(shift => {
    const cols = shiftColumns(ctx, shift)
    rows.push([SHIFT_LABEL[shift]])
    rows.push(['Day', 'Weekday', 'Holiday', ...cols.map(c => c.label)])
    for (let day = 1; day <= ctx.days; day++) {
      const holiday = isHolidayDay(day, ctx.year, ctx.month, ctx.holidays)
      const row: (string | number)[] = [
        day,
        weekdayShort(ctx.year, ctx.month, day),
        holiday ? 'Holiday' : '',
      ]
      cols.forEach(col => {
        const ids = ctx.roster[day]?.[shift]?.[col.id] || []
        row.push(ids.map(nameOf).join('; '))
      })
      rows.push(row)
    }
    rows.push([])
  })

  // Per-doctor summary.
  const stats = computeRosterStats(ctx.roster, ctx.effectiveStations)
  rows.push(['Duty count summary'])
  rows.push(['Doctor', 'Assigned', 'Target', 'Difference', 'Nights', 'Night Target', 'Cath', 'Cath Quota', 'OPD', 'OPD Max'])
  ctx.doctors
    .filter(d => d.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(d => {
      const s = stats[d.id] || { assigned: 0, night: 0, cath: 0, opd: 0 }
      rows.push([
        d.name, s.assigned, d.target, s.assigned - d.target,
        s.night, d.nightTarget,
        d.cathEligible ? s.cath : '—', d.cathEligible ? d.cathQuota : '—',
        s.opd, d.opdMax != null ? d.opdMax : '—',
      ])
    })

  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\r\n')
  // Prepend a BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${fileStem(ctx.year, ctx.month)}.csv`)
}

// ---------------------------------------------------------------------------
// Excel (.xlsx) — the hospital's traditional three-block layout
// (Morning | Evening | Night side by side; one row per day; each ward column
// spans as many sub-columns as it takes doctors; cells hold doctor names).
// ---------------------------------------------------------------------------
interface TemplateCol { label: string; wards: string[] | null; width: number }
interface TemplateBlock { shift: Shift; title: string; cols: TemplateCol[] }

const TEMPLATE_BLOCKS: TemplateBlock[] = [
  {
    shift: 'morning', title: 'Morning (8:00 AM to 2:30 PM)', cols: [
      { label: 'Observation', wards: ['Observation'], width: 2 },
      { label: 'OPD A', wards: ['OPD A'], width: 1 }, { label: 'OPD B', wards: ['OPD B'], width: 1 },
      { label: 'OPD C', wards: ['OPD C'], width: 1 }, { label: 'HTN', wards: ['HTN'], width: 1 },
      { label: 'W-7(CCU-2)', wards: ['7'], width: 2 }, { label: 'W-3A', wards: ['3A'], width: 2 },
      { label: 'W-3B', wards: ['3B'], width: 1 }, { label: 'W-5B', wards: ['5B'], width: 1 },
      { label: 'W-5D', wards: ['5D'], width: 1 }, { label: 'W-5A', wards: ['5A'], width: 1 },
      { label: 'W-5C', wards: ['5C'], width: 1 }, { label: 'Cabin', wards: ['Cabin'], width: 1 },
      { label: 'W-9', wards: ['9'], width: 1 }, { label: 'W10', wards: ['10'], width: 1 },
      { label: 'W12', wards: ['12'], width: 1 }, { label: 'DS 15A', wards: ['DS 15A'], width: 2 },
      { label: 'DS 15B', wards: ['DS 15B'], width: 1 }, { label: 'DS 15C', wards: ['DS 15C'], width: 1 },
      { label: 'DS W-8', wards: ['DS 8'], width: 1 }, { label: 'DS W-9A', wards: ['DS 9A'], width: 1 },
      { label: 'DS W-9B', wards: ['DS 9B'], width: 2 },
    ],
  },
  {
    shift: 'evening', title: 'Evening (2:30 PM to 9:00 PM)', cols: [
      { label: 'Observation', wards: ['Observation'], width: 2 }, { label: 'OPD A', wards: ['OPD A'], width: 1 },
      { label: 'W-7(CCU-2)', wards: ['7'], width: 2 }, { label: 'W-3A', wards: ['3A'], width: 2 },
      { label: 'W-3B', wards: ['3B'], width: 1 }, { label: 'Cath Lab', wards: ['Cath'], width: 1 },
      { label: 'W-5B', wards: ['5B'], width: 1 }, { label: 'W-5D', wards: ['5D'], width: 1 },
      { label: 'W- A+C', wards: ['5A', '5C'], width: 1 }, { label: 'W-9+Cabin', wards: ['9', 'Cabin'], width: 1 },
      { label: 'W-10', wards: ['10'], width: 1 }, { label: 'W-12', wards: ['12'], width: 1 },
      { label: 'DS 15A', wards: ['DS 15A'], width: 2 }, { label: 'DS 15B', wards: ['DS 15B'], width: 1 },
      { label: 'DS 15C', wards: ['DS 15C'], width: 1 }, { label: 'DS W-8', wards: ['DS 8'], width: 1 },
      { label: 'DS W-9A', wards: ['DS 9A'], width: 1 }, { label: 'DS W-9B', wards: ['DS 9B'], width: 2 },
    ],
  },
  {
    shift: 'night', title: 'Night (9:00 PM-8:00 AM)', cols: [
      { label: 'Observation', wards: ['Observation'], width: 1 }, { label: 'W-7(CCU-2)', wards: ['7'], width: 2 },
      { label: 'W-3A', wards: ['3A'], width: 1 }, { label: 'W3B', wards: ['3B'], width: 1 },
      { label: 'W5A+B', wards: ['5A', '5B'], width: 1 }, { label: 'W5C+D', wards: ['5C', '5D'], width: 1 },
      { label: 'W9+Cabin+ Obs', wards: ['9', 'Cabin'], width: 1 }, { label: 'W10+12', wards: ['10', '12'], width: 1 },
      { label: 'DS15A', wards: ['DS 15A'], width: 1 }, { label: 'DS15B', wards: ['DS 15B'], width: 1 },
      { label: 'DS15C', wards: ['DS 15C'], width: 1 }, { label: 'DS W8', wards: ['DS 8'], width: 1 },
      { label: 'DS W9A+B', wards: ['DS 9A', 'DS 9B'], width: 1 }, { label: 'Consultant', wards: null, width: 1 },
    ],
  },
]

// Find the station for a template column on a given day/shift: exact ward-set
// match first, then a station whose wards are a subset/superset (covers the
// holiday-merged 9+Cabin). `used` prevents one station filling two columns.
function stationForTemplateCol(stList: Station[], wards: string[], used: Set<string>): Station | undefined {
  const target = [...wards].sort().join('|')
  let st = stList.find(s => !used.has(s.id) && [...s.wards].sort().join('|') === target)
  if (!st) st = stList.find(s => !used.has(s.id) && (s.wards.every(w => wards.includes(w)) || wards.every(w => s.wards.includes(w))))
  return st
}

export async function exportRosterExcel(ctx: RosterExportContext): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const nameOf = (id: string) => ctx.doctors.find(d => d.id === id)?.name || ''

  const blockWidths = TEMPLATE_BLOCKS.map(b => 2 + b.cols.reduce((s, c) => s + c.width, 0))
  const blockStart: number[] = []
  let totalWidth = 0
  TEMPLATE_BLOCKS.forEach((_, i) => { blockStart[i] = totalWidth; totalWidth += blockWidths[i] })

  const aoa: (string | number | null)[][] = []
  const put = (r: number, c: number, v: string | number) => {
    while (aoa.length <= r) aoa.push([])
    const row = aoa[r]
    while (row.length <= c) row.push(null)
    row[c] = v
  }
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  put(0, 0, ctx.hospitalName)
  put(1, 0, `1-${ctx.days} ${MONTHS[ctx.month - 1]} ${ctx.year}`)
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalWidth - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: totalWidth - 1 } })

  TEMPLATE_BLOCKS.forEach((b, i) => {
    merges.push({ s: { r: 2, c: blockStart[i] }, e: { r: 2, c: blockStart[i] + blockWidths[i] - 1 } })
    put(2, blockStart[i], b.title)
    let c = blockStart[i]
    put(3, c++, 'Date'); put(3, c++, 'Day')
    b.cols.forEach(col => { put(3, c, col.label); if (col.width > 1) merges.push({ s: { r: 3, c }, e: { r: 3, c: c + col.width - 1 } }); c += col.width })
  })

  for (let day = 1; day <= ctx.days; day++) {
    const r = 3 + day // row index 4 == day 1
    const weekday = new Date(ctx.year, ctx.month - 1, day).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dateStr = `${ctx.year % 100}.${ctx.month}.${day}`
    TEMPLATE_BLOCKS.forEach((b, i) => {
      let c = blockStart[i]
      put(r, c++, dateStr); put(r, c++, weekday)
      const stList = ctx.effectiveStations[day]?.[b.shift] || []
      const used = new Set<string>()
      b.cols.forEach(col => {
        const base = c; c += col.width
        if (!col.wards) return
        const st = stationForTemplateCol(stList, col.wards, used)
        if (!st) return
        used.add(st.id)
        const names = (ctx.roster[day]?.[b.shift]?.[st.id] || []).map(nameOf).filter(Boolean)
        names.forEach((nm, k) => {
          if (k < col.width) put(r, base + k, nm)
          else { const last = base + col.width - 1; put(r, last, `${aoa[r][last] || ''}, ${nm}`) }
        })
      })
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = Array.from({ length: totalWidth }, () => ({ wch: 9 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Roster')

  // Summary sheet: per-doctor totals against target.
  const stats = computeRosterStats(ctx.roster, ctx.effectiveStations)
  const summaryHeader = [
    'Doctor', 'Assigned', 'Target', 'Difference',
    'Nights', 'Night Target', 'Cath', 'Cath Quota', 'OPD', 'OPD Max',
  ]
  const summaryRows: (string | number)[][] = [summaryHeader]
  ctx.doctors
    .filter(d => d.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(d => {
      const s = stats[d.id] || { assigned: 0, night: 0, cath: 0, opd: 0 }
      summaryRows.push([
        d.name,
        s.assigned,
        d.target,
        s.assigned - d.target,
        s.night,
        d.nightTarget,
        d.cathEligible ? s.cath : '—',
        d.cathEligible ? d.cathQuota : '—',
        s.opd,
        d.opdMax != null ? d.opdMax : '—',
      ])
    })
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
  summaryWs['!cols'] = [{ wch: 22 }, ...summaryHeader.slice(1).map(() => ({ wch: 12 }))]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Flags sheet: doctors off their duty cap + wards that need more staffing.
  {
    const rows: (string | number)[][] = []
    rows.push(['Duty cap flags & ward gaps'])
    rows.push([`${MONTHS[ctx.month - 1]} ${ctx.year}`])
    rows.push([])

    // Section 1 — per-doctor duty balance against the effective cap.
    rows.push(['Doctors — duty count vs cap'])
    rows.push(['Doctor', 'CL days', 'Base cap', 'Effective cap', 'Assigned', 'Difference', 'Flag', 'Nights', 'Night target'])
    let under = 0, over = 0
    ctx.doctors
      .filter(d => d.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(d => {
        const s = stats[d.id] || { assigned: 0, night: 0, cath: 0, opd: 0 }
        const cl = ctx.casualLeaveDays?.[d.id] ?? 0
        const eff = ctx.effectiveTargets?.[d.id] ?? d.target
        const diff = s.assigned - eff
        let flag = 'OK'
        if (diff > 0) { flag = `OVER by ${diff}`; over++ }
        else if (diff < 0) { flag = `UNDER by ${-diff}`; under++ }
        rows.push([d.name, cl, d.target, eff, s.assigned, diff, flag, s.night, d.nightTarget])
      })
    rows.push([])
    rows.push([`${under} doctor(s) under cap, ${over} over cap.`])
    rows.push([])

    // Section 2 — wards/shifts left short (extra duty needed).
    rows.push(['Wards needing more duties (unfilled slots)'])
    rows.push(['Ward / Station', 'Shift', 'Days short', 'Total missing', 'Sample days'])
    const shortfalls = ctx.shortfalls || []
    const byStation = new Map<string, { label: string; shift: Shift; days: Set<number>; missing: number }>()
    shortfalls.forEach(sf => {
      const key = `${sf.stationLabel}|${sf.shift}`
      const e = byStation.get(key) || { label: sf.stationLabel || '—', shift: sf.shift, days: new Set<number>(), missing: 0 }
      e.days.add(sf.day)
      e.missing += sf.missing || 1
      byStation.set(key, e)
    })
    const gaps = [...byStation.values()].sort((a, b) => b.missing - a.missing)
    if (gaps.length === 0) rows.push(['— none —'])
    gaps.forEach(g => {
      const dayList = [...g.days].sort((a, b) => a - b)
      rows.push([g.label, g.shift, dayList.length, g.missing, dayList.slice(0, 12).join(', ') + (dayList.length > 12 ? ' …' : '')])
    })

    const flagsWs = XLSX.utils.aoa_to_sheet(rows)
    flagsWs['!cols'] = [{ wch: 24 }, { wch: 9 }, { wch: 10 }, { wch: 13 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, flagsWs, 'Flags')
  }

  // Warnings sheet (only when there is something to report).
  if (ctx.warnings.length > 0) {
    const warnWs = XLSX.utils.aoa_to_sheet([
      ['Warnings from roster generation'],
      ...ctx.warnings.map(w => [w]),
    ])
    warnWs['!cols'] = [{ wch: 110 }]
    XLSX.utils.book_append_sheet(wb, warnWs, 'Warnings')
  }

  XLSX.writeFile(wb, `${fileStem(ctx.year, ctx.month)}.xlsx`)
}

// ---------------------------------------------------------------------------
// Excel import (.xlsx) — read a half-completed roster back in
// ---------------------------------------------------------------------------
export interface RosterImportResult {
  /** The parsed (partial) roster, keyed by the given effectiveStations' station ids. */
  roster: RosterEntry
  /** How many doctor placements were read in. */
  placed: number
  /** Doctor names found in the file that don't match any active doctor. */
  unmatched: string[]
  /** Column headers that didn't match a station that runs that shift/day. */
  missingStations: string[]
}

// Map a ward-column header label from the traditional layout to a set of ward
// names (or null for a spacer/unmapped column such as "Consultant").
function headerLabelToWards(labelRaw: unknown): string[] | null {
  const s = String(labelRaw ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!s || s === 'date' || s === 'day' || s.includes('consultant')) return null
  if (/a\s*\+\s*c/.test(s) && !s.includes('ds')) return ['5A', '5C']
  if (/5a\s*\+\s*b/.test(s)) return ['5A', '5B']
  if (/5c\s*\+\s*d/.test(s)) return ['5C', '5D']
  if (/9a\s*\+\s*b/.test(s)) return ['DS 9A', 'DS 9B']
  if (/9\s*\+\s*cabin/.test(s)) return ['9', 'Cabin']
  if (/10\s*\+\s*12/.test(s)) return ['10', '12']
  if (/ds.*15a|ds15a/.test(s)) return ['DS 15A']
  if (/ds.*15b|ds15b/.test(s)) return ['DS 15B']
  if (/ds.*15c|ds15c/.test(s)) return ['DS 15C']
  if (/ds\s*w?[-\s]*9a/.test(s)) return ['DS 9A']
  if (/ds\s*w?[-\s]*9b/.test(s)) return ['DS 9B']
  if (/ds\s*w?[-\s]*8/.test(s)) return ['DS 8']
  if (/opd\s*a/.test(s)) return ['OPD A']
  if (/opd\s*b/.test(s)) return ['OPD B']
  if (/opd\s*c/.test(s)) return ['OPD C']
  if (/htn/.test(s)) return ['HTN']
  if (/cath/.test(s)) return ['Cath']
  if (/observation|^obs/.test(s)) return ['Observation']
  if (/cabin/.test(s)) return ['Cabin']
  if (/7|ccu/.test(s)) return ['7']
  if (/3a/.test(s)) return ['3A']
  if (/3b/.test(s)) return ['3B']
  if (/5a/.test(s)) return ['5A']
  if (/5b/.test(s)) return ['5B']
  if (/5c/.test(s)) return ['5C']
  if (/5d/.test(s)) return ['5D']
  if (/(^|[^0-9])9([^0-9]|$)/.test(s)) return ['9']
  if (/10/.test(s)) return ['10']
  if (/12/.test(s)) return ['12']
  return null
}

/**
 * Read a partially- or fully-completed roster from a .xlsx file in the hospital's
 * traditional three-block layout (Morning | Evening | Night side by side, each
 * block starting with Date / Day columns; a date cell like "26.8.1"; ward columns
 * that may span two sub-columns; cells hold doctor names). Ward columns are
 * matched to the given `effectiveStations` per day by ward set, and names to
 * active doctors by an exact (case-insensitive) match. Anything that can't be
 * matched is reported rather than dropped silently.
 */
export async function importRosterFromXlsx(
  file: File,
  doctors: Doctor[],
  effectiveStations: EffectiveStations,
  days: number,
): Promise<RosterImportResult> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })

  const byName = new Map<string, string>()
  doctors.filter(d => d.active).forEach(d => byName.set(d.name.trim().toLowerCase(), d.id))

  const roster: RosterEntry = {}
  const unmatched = new Set<string>()
  const missingStations = new Set<string>()
  let placed = 0

  const isDate = (c: unknown) => String(c ?? '').trim().toLowerCase() === 'date'

  // Pick the sheet and header row that contain the three "Date" block markers.
  let aoa: unknown[][] | null = null
  let headerRowIdx = -1
  for (const sn of wb.SheetNames) {
    const a = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, blankrows: false, defval: null })
    const idx = a.findIndex(row => (row || []).some(isDate))
    if (idx >= 0) { aoa = a; headerRowIdx = idx; break }
  }
  if (!aoa) return { roster, placed, unmatched: [], missingStations: [] }

  const headerRow = aoa[headerRowIdx] || []
  const dateCols: number[] = []
  headerRow.forEach((c, i) => { if (isDate(c)) dateCols.push(i) })
  const blocks = dateCols.map((start, i) => ({
    shift: (['morning', 'evening', 'night'] as Shift[])[i],
    start,
    end: dateCols[i + 1] ?? headerRow.length,
  }))

  for (const b of blocks) {
    if (!b.shift) continue
    // Column -> ward set, forward-filled so a two-wide ward covers both sub-columns.
    const colWards: Record<number, { wards: string[]; label: string }> = {}
    let cur: { wards: string[]; label: string } | null = null
    for (let c = b.start; c < b.end; c++) {
      const t = String(headerRow[c] ?? '').trim()
      if (t) {
        const low = t.toLowerCase()
        if (low === 'date' || low === 'day') { cur = null; continue }
        const wards = headerLabelToWards(t)
        cur = wards ? { wards, label: t } : null
      }
      if (cur) colWards[c] = cur
    }

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] || []
      const dateStr = String(row[b.start] ?? '').trim()
      if (!dateStr) continue
      const seg = dateStr.split('.')
      const day = parseInt(seg[seg.length - 1], 10)
      if (!day || day < 1 || day > days) continue
      const dayStations = effectiveStations[day]?.[b.shift] || []

      for (const cStr of Object.keys(colWards)) {
        const c = Number(cStr)
        const { wards, label } = colWards[c]
        const raw = String(row[c] ?? '').trim()
        if (!raw) continue
        const target = [...wards].sort().join('|')
        const st = dayStations.find(s => [...s.wards].sort().join('|') === target)
          || dayStations.find(s => s.wards.every(w => wards.includes(w)) || wards.every(w => s.wards.includes(w)))
        if (!st) { missingStations.add(`${label} (day ${day}, ${b.shift})`); continue }
        raw.split(/[,/;]/).map(x => x.trim()).filter(x => x && x !== '—' && x !== '-').forEach(nm => {
          const id = byName.get(nm.toLowerCase())
          if (!id) { unmatched.add(nm); return }
          roster[day] = roster[day] || {}
          roster[day][b.shift] = roster[day][b.shift] || {}
          const arr = roster[day][b.shift]![st.id] || (roster[day][b.shift]![st.id] = [])
          if (!arr.includes(id)) { arr.push(id); placed++ }
        })
      }
    }
  }

  return { roster, placed, unmatched: [...unmatched], missingStations: [...missingStations] }
}

// ---------------------------------------------------------------------------
// Word (.docx)
// ---------------------------------------------------------------------------
export async function exportRosterDocx(ctx: RosterExportContext): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
  } = await import('docx')

  const nameOf = (id: string) => ctx.doctors.find(d => d.id === id)?.name || '—'
  const TEAL = '0F6E5C'
  const MUTED = '5C6F6A'

  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: 'C9D8D1' }
  const cellBorders = {
    top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder,
  }

  const children: object[] = []

  // Letterhead
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: ctx.hospitalName, bold: true, size: 26, color: '0A4F42' })],
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({
      text: `Duty Roster — ${MONTHS[ctx.month - 1]} ${ctx.year}`,
      size: 22, color: MUTED,
    })],
  }))
  if (ctx.preparedByName) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Prepared by ${ctx.preparedByName}`, size: 18, color: MUTED, italics: true })],
    }))
  }

  SHIFTS.forEach((shift, idx) => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: idx === 0 ? 120 : 300, after: 120 },
      children: [new TextRun({ text: SHIFT_LABEL[shift], bold: true, color: TEAL, size: 26 })],
    }))

    for (let day = 1; day <= ctx.days; day++) {
      const holiday = isHolidayDay(day, ctx.year, ctx.month, ctx.holidays)
      const dayStations = ctx.effectiveStations[day]?.[shift] || []

      children.push(new Paragraph({
        spacing: { before: 140, after: 40 },
        children: [
          new TextRun({ text: `Day ${day} (${weekdayShort(ctx.year, ctx.month, day)})`, bold: true, size: 20 }),
          ...(holiday ? [new TextRun({ text: '  —  Holiday', color: 'A83A2C', size: 18, italics: true })] : []),
        ],
      }))

      if (dayStations.length === 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'No stations staffed this shift.', italics: true, color: MUTED, size: 18 })],
        }))
        continue
      }

      const rows = dayStations.map(st => {
        const ids = ctx.roster[day]?.[shift]?.[st.id] || []
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: stationDisplayLabel(st), size: 18, color: MUTED })] })],
            }),
            new TableCell({
              width: { size: 62, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: ids.length ? ids.map(nameOf).join(', ') : '—', size: 18 })] })],
            }),
          ],
        })
      })

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      }))
    }
  })

  const doc = new Document({
    creator: ctx.hospitalName,
    title: `Duty Roster — ${MONTHS[ctx.month - 1]} ${ctx.year}`,
    sections: [{ children: children as never[] }],
  })

  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${fileStem(ctx.year, ctx.month)}.docx`)
}
