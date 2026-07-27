import type { Doctor, RosterEntry, EffectiveStations, Holiday, Shift } from '@/types'
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
}

const SHIFT_TITLE: Record<Shift, string> = {
  morning: 'Morning',
  evening: 'Evening',
  night: 'Night',
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
// Excel (.xlsx)
// ---------------------------------------------------------------------------
export async function exportRosterExcel(ctx: RosterExportContext): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const nameOf = (id: string) => ctx.doctors.find(d => d.id === id)?.name || '—'

  // One sheet per shift: rows = days, columns = stations, cells = doctor names.
  SHIFTS.forEach(shift => {
    const cols = shiftColumns(ctx, shift)
    const header = ['Day', 'Weekday', 'Holiday', ...cols.map(c => c.label)]
    const rows: (string | number)[][] = [header]

    for (let day = 1; day <= ctx.days; day++) {
      const holiday = isHolidayDay(day, ctx.year, ctx.month, ctx.holidays)
      const row: (string | number)[] = [
        day,
        weekdayShort(ctx.year, ctx.month, day),
        holiday ? 'Holiday' : '',
      ]
      cols.forEach(col => {
        const ids = ctx.roster[day]?.[shift]?.[col.id] || []
        row.push(ids.map(nameOf).join(', '))
      })
      rows.push(row)
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 9 }, { wch: 9 },
      ...cols.map(() => ({ wch: 18 })),
    ]
    ws['!freeze'] = { xSplit: 3, ySplit: 1 } as unknown as (typeof ws)['!freeze']
    XLSX.utils.book_append_sheet(wb, ws, SHIFT_TITLE[shift])
  })

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

const IMPORT_SHEET_FOR: Record<Shift, string> = {
  morning: 'Morning',
  evening: 'Evening',
  night: 'Night',
}

/**
 * Read a partially- or fully-completed roster from a .xlsx file that follows
 * the app's own export layout (one sheet per shift; header row of
 * Day / Weekday / Holiday / station labels; cells hold comma-separated doctor
 * names). Station columns are matched to the given `effectiveStations` by their
 * display label per day, and names to doctors by an exact (case-insensitive)
 * match. Anything that can't be matched is reported rather than dropped
 * silently, so the caller can surface it.
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

  SHIFTS.forEach(shift => {
    const wanted = IMPORT_SHEET_FOR[shift].toLowerCase()
    const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === wanted)
    if (!sheetName) return
    const ws = wb.Sheets[sheetName]
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, blankrows: false })
    if (aoa.length < 2) return

    const header = (aoa[0] || []).map(h => String(h ?? '').trim())
    // Columns 0–2 are Day / Weekday / Holiday; station columns start at index 3.
    const stationCols = header
      .map((label, idx) => ({ label, idx }))
      .filter(c => c.idx >= 3 && c.label)

    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] || []
      const day = parseInt(String(row[0] ?? ''), 10)
      if (!day || day < 1 || day > days) continue
      const dayStations = effectiveStations[day]?.[shift] || []

      stationCols.forEach(col => {
        const raw = String(row[col.idx] ?? '').trim()
        if (!raw) return
        const st = dayStations.find(s => stationDisplayLabel(s).trim().toLowerCase() === col.label.toLowerCase())
        if (!st) { missingStations.add(`${col.label} (day ${day}, ${shift})`); return }
        raw.split(/[,;]/).map(s => s.trim()).filter(s => s && s !== '—' && s !== '-').forEach(nm => {
          const id = byName.get(nm.toLowerCase())
          if (!id) { unmatched.add(nm); return }
          roster[day] = roster[day] || {}
          roster[day][shift] = roster[day][shift] || {}
          const arr = roster[day][shift]![st.id] || (roster[day][shift]![st.id] = [])
          if (!arr.includes(id)) { arr.push(id); placed++ }
        })
      })
    }
  })

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
