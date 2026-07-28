import { useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRosterSnapshots, useDutyBankHistory } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { generateRoster } from '@/lib/rosterGenerator'
import { computeRosterStats } from '@/lib/rosterStats'
import { exportRosterExcel, exportRosterDocx, exportRosterCsv, importRosterFromXlsx, type RosterExportContext } from '@/lib/rosterExport'
import { monthKey, isHolidayDay, stationDisplayLabel } from '@/lib/utils'
import { MONTHS, SHIFTS, SHIFT_LABEL } from '@/types'
import type { Shift } from '@/types'
import {
  Play, Save, FileDown, FileSpreadsheet, FileText, FileType, Printer,
  AlertTriangle, ChevronDown, ChevronUp, Pencil, X, Search, Wand2,
  CalendarRange, FilePlus2, ListChecks, FileUp,
} from 'lucide-react'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function GeneratePage() {
  const {
    doctors, wards, stations, demands, holidays, meta, setMeta,
    roster, effectiveStations, warnings, setRoster, setEffectiveStations, setWarnings,
    shortfalls, setShortfalls, setImprovisations, setCurrentNav,
    fridayNightHistory, setFridayNightHistory, dutyBank, setDutyBank, settings,
    secretUnlocked,
  } = useAppStore()
  const { makerLabel, isMaster } = useAuth()
  const { saveSnapshot } = useRosterSnapshots()
  const { upsertMonth } = useDutyBankHistory()

  const [shiftTab, setShiftTab] = useState<Shift>('morning')
  const [editMode, setEditMode] = useState(false)
  // Per-doctor editable chart
  const [docSearch, setDocSearch] = useState('')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [docEditCell, setDocEditCell] = useState<{ day: number; shift: Shift } | null>(null)
  const [showWarnings, setShowWarnings] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isManual, setIsManual] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Day range to generate (within the selected month). Defaults to the whole month.
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(31)
  // Month/year the in-state roster was generated for — so a partial-range
  // generation or "complete" never mixes another month's duties into this one.
  const [rosterKey, setRosterKey] = useState('')
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'docx' | 'csv' | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const printRef = useRef<HTMLDivElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  // Effective duty caps / casual-leave days from the last generation, for the export's Flags tab.
  const [dutyMeta, setDutyMeta] = useState<{ effectiveTargets: Record<string, number>; casualLeaveDays: Record<string, number> }>({ effectiveTargets: {}, casualLeaveDays: {} })
  // How the current roster came to be, and which doctors are user-entered. When
  // completing a manual/imported roster (or any hand-edited doctor), those
  // doctors are frozen — the generator won't add or remove their duties.
  const [rosterSource, setRosterSource] = useState<'generated' | 'manual' | 'imported' | null>(null)
  const [lockedDoctorIds, setLockedDoctorIds] = useState<string[]>([])

  const activeDoctors = doctors.filter(d => d.active)
  const daysInMonth = new Date(meta.year, meta.month, 0).getDate()
  const years = Array.from({ length: 5 }, (_, i) => meta.year - 2 + i)
  const totalStations = SHIFTS.reduce((sum, s) => sum + stations[s].length, 0)
  const canGenerate = activeDoctors.length > 0 && totalStations > 0

  const applyResult = (result: ReturnType<typeof generateRoster>) => {
    setRoster(result.roster)
    setEffectiveStations(result.effectiveStations)
    setWarnings(result.warnings)
    setShortfalls(result.shortfalls)
    setImprovisations(result.improvisations)
    setMeta({ ...meta, days: daysInMonth, generatedAt: new Date().toISOString() })
    setFridayNightHistory({ ...fridayNightHistory, [monthKey(meta.year, meta.month)]: result.fridayNightCount })
    setDutyMeta({ effectiveTargets: result.effectiveTargets, casualLeaveDays: result.casualLeaveDays })
    setRosterKey(monthKey(meta.year, meta.month))
  }

  // Does the currently-displayed roster belong to the selected month?
  const rosterMatchesMonth = !!roster && rosterKey === monthKey(meta.year, meta.month)

  // Clamp the chosen day range to the selected month.
  const clampedStart = Math.min(Math.max(1, rangeStart), daysInMonth)
  const clampedEnd = Math.min(Math.max(clampedStart, rangeEnd), daysInMonth)
  const isWholeMonth = clampedStart === 1 && clampedEnd === daysInMonth

  // Reset the range whenever the target month/year changes.
  const changeMonth = (m: number) => {
    setMeta({ ...meta, month: m })
    setRangeStart(1)
    setRangeEnd(new Date(meta.year, m, 0).getDate())
  }
  const changeYear = (y: number) => {
    setMeta({ ...meta, year: y })
    setRangeStart(1)
    setRangeEnd(new Date(y, meta.month, 0).getDate())
  }

  // Strict generation — places only doctors who satisfy every rule, quota and
  // target, and leaves the rest empty (listed in the Shortfalls tab). When a
  // partial day range is chosen, only those days are (re)generated; any existing
  // duties on the other days of the month are kept and still count toward
  // targets, quotas and the rest rules.
  const handleGenerate = async () => {
    setIsGenerating(true)
    setSaveMsg('')
    await sleep(30) // let the button show its busy state before the sync work blocks the thread
    const result = generateRoster(
      doctors, stations, demands, holidays,
      meta.year, meta.month, daysInMonth,
      fridayNightHistory, dutyBank,
      {
        autoFill: false,
        startDay: clampedStart,
        endDay: clampedEnd,
        ...(isWholeMonth || !rosterMatchesMonth
          ? {}
          : { baseRoster: roster || undefined, baseEffectiveStations: effectiveStations || undefined }),
      }
    )
    applyResult(result)
    setRosterSource('generated')
    setLockedDoctorIds([])
    setIsGenerating(false)
  }

  // Manual entry — build the empty scaffold (stations exposed, nobody assigned)
  // for the chosen range so the whole roster can be filled by hand, then open
  // the per-doctor editor.
  const handleManual = async () => {
    setIsManual(true)
    setSaveMsg('')
    await sleep(30)
    const result = generateRoster(
      doctors, stations, demands, holidays,
      meta.year, meta.month, daysInMonth,
      fridayNightHistory, dutyBank,
      { scaffoldOnly: true, startDay: clampedStart, endDay: clampedEnd }
    )
    applyResult(result)
    setRosterSource('manual')
    setLockedDoctorIds([])
    setEditMode(true)
    setIsManual(false)
  }

  // Continue / complete — keep every existing duty (auto-generated or hand-entered)
  // and fill only the empty slots across the whole month, using the same rules.
  // `relax` true additionally bends the soft rules (auto-fill), logging each in
  // the Shortfalls tab; false leaves a slot empty rather than break a soft rule.
  const handleComplete = async (relax: boolean) => {
    if (!roster || !effectiveStations || !rosterMatchesMonth) return
    if (relax) setIsAutoFilling(true)
    else setIsCompleting(true)
    setSaveMsg('')
    await sleep(30)
    // Freeze user-entered doctors: every doctor in a manual/imported roster, plus
    // any doctor whose cells were hand-edited. Their duties are kept and never added to.
    const frozen = new Set(lockedDoctorIds)
    if (rosterSource === 'manual' || rosterSource === 'imported') {
      for (const dk of Object.keys(roster)) {
        SHIFTS.forEach(sh => Object.values(roster[+dk]?.[sh] || {}).forEach(ids => ids.forEach(id => frozen.add(id))))
      }
    }
    const result = generateRoster(
      doctors, stations, demands, holidays,
      meta.year, meta.month, daysInMonth,
      fridayNightHistory, dutyBank,
      {
        autoFill: relax,
        startDay: 1,
        endDay: daysInMonth,
        baseRoster: roster,
        baseEffectiveStations: effectiveStations,
        preserveExisting: true,
        frozenDoctorIds: [...frozen],
      }
    )
    applyResult(result)
    if (relax) setIsAutoFilling(false)
    else setIsCompleting(false)
  }

  // Auto-fill preserves existing placements and bends soft rules for the gaps.
  const handleAutoFill = () => handleComplete(true)

  // Import a half-completed roster from a .xlsx file (the app's own export
  // layout). We build a fresh scaffold for the selected month so column labels
  // map to the right stations, read the file's placements onto it, then load it
  // as the working roster — ready for "Complete Empty Slots" to finish.
  const handleImportXlsx = async (file: File) => {
    setIsImporting(true)
    setImportMsg('')
    setSaveMsg('')
    await sleep(30)
    try {
      const scaffold = generateRoster(
        doctors, stations, demands, holidays,
        meta.year, meta.month, daysInMonth,
        fridayNightHistory, dutyBank,
        { scaffoldOnly: true }
      )
      const res = await importRosterFromXlsx(file, doctors, scaffold.effectiveStations, daysInMonth)
      setRoster(res.roster)
      setEffectiveStations(scaffold.effectiveStations)
      setWarnings([])
      setShortfalls([])
      setImprovisations([])
      setMeta({ ...meta, days: daysInMonth, generatedAt: new Date().toISOString() })
      setRosterKey(monthKey(meta.year, meta.month))
      // Imported duties are user input — freeze those doctors when completing.
      setRosterSource('imported')
      const importedDocs = new Set<string>()
      for (const dk of Object.keys(res.roster)) SHIFTS.forEach(sh => Object.values(res.roster[+dk]?.[sh] || {}).forEach(ids => ids.forEach(id => importedDocs.add(id))))
      setLockedDoctorIds([...importedDocs])
      const parts = [`Imported ${res.placed} duties for ${MONTHS[meta.month - 1]} ${meta.year}.`]
      if (res.unmatched.length) {
        parts.push(`${res.unmatched.length} unknown name(s) skipped: ${res.unmatched.slice(0, 6).join(', ')}${res.unmatched.length > 6 ? '…' : ''}.`)
      }
      if (res.missingStations.length) {
        parts.push(`${res.missingStations.length} column(s) didn't match a station this month.`)
      }
      parts.push('Use "Complete Empty Slots" (or Auto-fill) to finish.')
      setImportMsg(parts.join(' '))
    } catch (err) {
      setImportMsg(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed.')
    } finally {
      setIsImporting(false)
      if (xlsxInputRef.current) xlsxInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!roster || !effectiveStations) return
    setIsSaving(true)
    setSaveMsg('')
    try {
      await saveSnapshot.mutateAsync({
        year: meta.year,
        month: meta.month,
        days: meta.days,
        roster: roster as unknown as import('@/types/database').Json,
        effective_stations: effectiveStations as unknown as import('@/types/database').Json,
        warnings,
        generated_by: isMaster ? 'Master' : (makerLabel || 'Roster Maker'),
      })

      // Recompute duty bank for this month and persist it, so next month's
      // generation knows who ran over their target.
      const stats = computeRosterStats(roster, effectiveStations)
      const key = monthKey(meta.year, meta.month)
      const prevKey = meta.month === 1 ? monthKey(meta.year - 1, 12) : monthKey(meta.year, meta.month - 1)
      const prevMonthBank = dutyBank[prevKey] || {}

      const entries = activeDoctors.map(d => {
        const prevBalance = prevMonthBank[d.id]?.balance || 0
        const effectiveTarget = Math.max(0, d.target - (prevBalance > 0 ? prevBalance : 0))
        const assigned = stats[d.id]?.assigned || 0
        return {
          month_key: key,
          doctor_id: d.id,
          base_target: d.target,
          effective_target: effectiveTarget,
          assigned,
          balance: assigned - effectiveTarget,
        }
      })

      await upsertMonth.mutateAsync(entries)

      const monthBank: Record<string, { baseTarget: number; effectiveTarget: number; assigned: number; balance: number }> = {}
      entries.forEach(e => {
        monthBank[e.doctor_id] = {
          baseTarget: e.base_target,
          effectiveTarget: e.effective_target,
          assigned: e.assigned,
          balance: e.balance,
        }
      })
      setDutyBank({ ...dutyBank, [key]: monthBank })

      setSaveMsg('Saved.')
    } catch (err) {
      setSaveMsg(err instanceof Error ? `Save failed: ${err.message}` : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const buildExportContext = (): RosterExportContext => ({
    doctors,
    roster: roster!,
    effectiveStations: effectiveStations!,
    holidays,
    year: meta.year,
    month: meta.month,
    days: meta.days,
    hospitalName: settings.hospitalName,
    preparedByName: settings.preparedByName,
    warnings,
    effectiveTargets: dutyMeta.effectiveTargets,
    casualLeaveDays: dutyMeta.casualLeaveDays,
    shortfalls,
  })

  const handleExportExcel = async () => {
    if (!roster || !effectiveStations) return
    setExporting('excel')
    setSaveMsg('')
    try {
      await exportRosterExcel(buildExportContext())
    } catch (err) {
      setSaveMsg(err instanceof Error ? `Excel export failed: ${err.message}` : 'Excel export failed.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportDocx = async () => {
    if (!roster || !effectiveStations) return
    setExporting('docx')
    setSaveMsg('')
    try {
      await exportRosterDocx(buildExportContext())
    } catch (err) {
      setSaveMsg(err instanceof Error ? `Word export failed: ${err.message}` : 'Word export failed.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportCsv = () => {
    if (!roster || !effectiveStations) return
    setExporting('csv')
    setSaveMsg('')
    try {
      exportRosterCsv(buildExportContext())
    } catch (err) {
      setSaveMsg(err instanceof Error ? `CSV export failed: ${err.message}` : 'CSV export failed.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportPdf = async () => {
    if (!roster || !effectiveStations || !printRef.current) return
    setExporting('pdf')
    const originalTab = shiftTab
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')
      const pdf = new jsPDF('p', 'pt', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < SHIFTS.length; i++) {
        setShiftTab(SHIFTS[i])
        await sleep(60)
        const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' })
        const imgData = canvas.toDataURL('image/png')
        const imgWidth = pageWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        let position = 0
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
      }

      pdf.save(`roster-${meta.year}-${String(meta.month).padStart(2, '0')}.pdf`)
    } finally {
      setShiftTab(originalTab)
      setExporting(null)
    }
  }

  const doctorName = (id: string) => doctors.find(d => d.id === id)?.name || '—'

  // Doctors that may be placed into a slot (respects the secret-team visibility rule).
  const pickableDoctors = doctors.filter(d => d.active && (!d.secret || (isMaster && secretUnlocked)))

  // ---- Per-doctor editable chart ----
  const selectedDoc = doctors.find(d => d.id === selectedDocId) || null
  const docSearchResults = docSearch
    ? pickableDoctors.filter(d => d.name.toLowerCase().includes(docSearch.toLowerCase())).slice(0, 8)
    : []

  // The station a doctor is on for a given day/shift (or null).
  const docStationId = (docId: string, day: number, shift: Shift): string | null => {
    const sr = roster?.[day]?.[shift] || {}
    return Object.keys(sr).find(stId => (sr[stId] || []).includes(docId)) || null
  }
  const stationLabelFor = (day: number, shift: Shift, stId: string | null): string => {
    if (!stId) return '—'
    const s = effectiveStations?.[day]?.[shift]?.find(x => x.id === stId)
    return s ? stationDisplayLabel(s) : stId
  }

  // Move a doctor to a station (or off) for a day/shift; adjusts the roster.
  const setDocAssignment = (docId: string, day: number, shift: Shift, newStationId: string | null) => {
    if (!roster) return
    const sr = roster[day]?.[shift] || {}
    const cleaned: Record<string, string[]> = {}
    for (const stId of Object.keys(sr)) cleaned[stId] = (sr[stId] || []).filter(id => id !== docId)
    if (newStationId) cleaned[newStationId] = [...(cleaned[newStationId] || []), docId]
    setRoster({ ...roster, [day]: { ...roster[day], [shift]: cleaned } })
    // A hand-edited doctor is user input — freeze them from auto-fill/complete.
    setLockedDoctorIds(prev => prev.includes(docId) ? prev : [...prev, docId])
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Generate & Export
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">Build the month's roster and export it as PDF, Excel, Word, or CSV</p>
      </div>

      {/* Month selector + range + pre-flight */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <select
            value={meta.month}
            onChange={e => changeMonth(parseInt(e.target.value))}
            className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={meta.year}
            onChange={e => changeYear(parseInt(e.target.value))}
            className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Day range within the month */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#5c6f6a]">
            <CalendarRange className="w-4 h-4" /> Day range
          </span>
          <div className="flex items-center gap-2">
            <select
              value={clampedStart}
              onChange={e => setRangeStart(parseInt(e.target.value))}
              className="px-2.5 py-2 rounded-lg border border-[#c9d8d1] text-sm"
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="text-xs text-[#5c6f6a]">to</span>
            <select
              value={clampedEnd}
              onChange={e => setRangeEnd(parseInt(e.target.value))}
              className="px-2.5 py-2 rounded-lg border border-[#c9d8d1] text-sm"
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d >= clampedStart).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {!isWholeMonth && (
            <button
              onClick={() => { setRangeStart(1); setRangeEnd(daysInMonth) }}
              className="text-xs text-[#0f6e5c] font-medium hover:underline sm:ml-1"
            >
              Whole month
            </button>
          )}
          <span className="text-[11px] text-[#5c6f6a] sm:ml-auto">
            {isWholeMonth
              ? `Full month (${daysInMonth} days)`
              : `Days ${clampedStart}–${clampedEnd} · other days kept as-is`}
          </span>
        </div>

        {/* Generation actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {isGenerating
              ? 'Generating...'
              : isWholeMonth
                ? (roster ? 'Regenerate Roster' : 'Generate Roster')
                : `Generate Days ${clampedStart}–${clampedEnd}`}
          </button>
          <button
            onClick={handleManual}
            disabled={!canGenerate || isManual}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9] disabled:opacity-50"
            title="Start with an empty roster and fill it in by hand"
          >
            <FilePlus2 className="w-4 h-4" />
            {isManual ? 'Preparing...' : 'Start Blank (Manual)'}
          </button>
          {roster && rosterMatchesMonth && (
            <button
              onClick={() => handleComplete(false)}
              disabled={isCompleting}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9] disabled:opacity-50"
              title="Keep every existing duty and fill only the empty slots"
            >
              <ListChecks className="w-4 h-4" />
              {isCompleting ? 'Completing...' : 'Complete Empty Slots'}
            </button>
          )}
          <button
            onClick={() => xlsxInputRef.current?.click()}
            disabled={!canGenerate || isImporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#c9d8d1] text-[#5c6f6a] text-sm font-medium hover:bg-[#eef3f0] disabled:opacity-50"
            title="Load a half-completed roster from an .xlsx file (the app's export layout), then complete it"
          >
            <FileUp className="w-4 h-4" />
            {isImporting ? 'Importing...' : 'Import .xlsx'}
          </button>
          <input
            ref={xlsxInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImportXlsx(f) }}
          />
        </div>

        {importMsg && (
          <p className="text-xs text-[#0f6e5c] bg-[#dcefe9] rounded-lg px-3 py-2 mb-4">{importMsg}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#5c6f6a]">
          <div>{activeDoctors.length} active doctors</div>
          <div>{totalStations} stations</div>
          <div>{demands?.length || 0} demands</div>
          <div>{holidays.filter(h => h.year === meta.year && h.month === meta.month).length} holidays this month</div>
        </div>
        {!canGenerate && (
          <p className="text-xs text-[#a83a2c] mt-3">
            Add at least one active doctor and one shift-requirement station before generating.
          </p>
        )}
      </div>

      {roster && effectiveStations && (
        <>
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-[#f6e3d3] rounded-xl border border-[#e0c299] p-4 mb-4">
              <button onClick={() => setShowWarnings(v => !v)} className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#6b4c19]">
                  <AlertTriangle className="w-4 h-4" />
                  {warnings.length} warning{warnings.length === 1 ? '' : 's'} to review
                </span>
                {showWarnings ? <ChevronUp className="w-4 h-4 text-[#6b4c19]" /> : <ChevronDown className="w-4 h-4 text-[#6b4c19]" />}
              </button>
              {showWarnings && (
                <ul className="mt-3 space-y-1.5 text-xs text-[#6b4c19] max-h-64 overflow-y-auto">
                  {warnings.map((w, i) => <li key={i}>&bull; {w}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Shortfalls / auto-fill banner */}
          {shortfalls.length > 0 && (
            <div className="bg-[#f7dfd9] rounded-xl border border-[#e0b4ab] p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <AlertTriangle className="w-4 h-4 text-[#a83a2c] flex-shrink-0" />
                  <span className="text-sm text-[#7a2c21]">
                    <b>{shortfalls.length} shortfall{shortfalls.length === 1 ? '' : 's'}</b> — slots left empty to keep strictly to the rules and demands.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentNav('shortfalls')}
                    className="px-3 py-2 rounded-lg border border-[#a83a2c] text-[#a83a2c] text-xs font-medium hover:bg-[#f2cfc7]"
                  >
                    View shortfalls
                  </button>
                  <button
                    onClick={handleAutoFill}
                    disabled={isAutoFilling}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#a83a2c] text-white text-xs font-medium hover:bg-[#822c21] disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {isAutoFilling ? 'Filling...' : 'Auto-fill (bend soft rules)'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#7a2c21] mt-2">
                Auto-fill keeps every existing duty and only fills the empty slots, relaxing soft rules (targets, quotas, leave, pacing) to do so. Every bend is logged in the Shortfalls tab. Hard rules and your demands are never broken.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Roster'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9] disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9] disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exporting === 'excel' ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              onClick={handleExportDocx}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9] disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {exporting === 'docx' ? 'Exporting...' : 'Export Word'}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#0f6e5c] text-[#0f6e5c] text-sm font-medium hover:bg-[#dcefe9] disabled:opacity-50"
            >
              <FileType className="w-4 h-4" />
              {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#c9d8d1] text-[#5c6f6a] text-sm font-medium hover:bg-[#eef3f0]"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            {saveMsg && <span className="text-xs text-[#5c6f6a]">{saveMsg}</span>}
          </div>

          {/* Per-doctor editable chart — revealed by the "Edit assignments" button */}
          {editMode && (
          <div className="bg-white rounded-xl border border-[#c9d8d1] p-4 mb-4 print:hidden">
            <div className="flex items-center gap-2 mb-1">
              <Search className="w-4 h-4 text-[#0f6e5c]" />
              <h2 className="text-sm font-semibold text-[#16221f]">Edit by doctor</h2>
            </div>
            <p className="text-xs text-[#5c6f6a] mb-3">
              Search a doctor to see their whole-month schedule. Tap any cell to change, add, or clear that duty — the roster updates instantly.
            </p>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6f6a]" />
              <input
                type="text"
                value={selectedDoc ? selectedDoc.name : docSearch}
                onChange={e => { setDocSearch(e.target.value); setSelectedDocId(null) }}
                placeholder="Search doctor name..."
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
              />
              {selectedDoc && (
                <button
                  onClick={() => { setSelectedDocId(null); setDocSearch('') }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5c6f6a] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {!selectedDoc && docSearchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-[#c9d8d1] rounded-lg shadow-sm max-h-64 overflow-y-auto">
                  {docSearchResults.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDocId(d.id); setDocSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#eef3f0] flex items-center justify-between"
                    >
                      <span className="text-[#16221f]">{d.name}</span>
                      <span className="text-[10px] text-[#5c6f6a]">{d.categories.join('/')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedDoc && (
              <div className="mt-4 overflow-x-auto border border-[#c9d8d1] rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#0f6e5c] text-white">
                      <th className="px-2 py-1.5 text-left font-medium">Day</th>
                      <th className="px-2 py-1.5 font-medium">Wk</th>
                      <th className="px-2 py-1.5 font-medium">Morning</th>
                      <th className="px-2 py-1.5 font-medium">Evening</th>
                      <th className="px-2 py-1.5 font-medium">Night</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: meta.days }, (_, i) => i + 1).map(day => {
                      const weekday = new Date(meta.year, meta.month - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
                      const holiday = isHolidayDay(day, meta.year, meta.month, holidays)
                      return (
                        <tr key={day} className={holiday ? 'bg-[#f6e3d3]' : ''}>
                          <td className="px-2 py-1 font-semibold text-[#16221f] border-t border-[#eef3f0]">{day}{holiday ? ' ★' : ''}</td>
                          <td className="px-2 py-1 text-center text-[#5c6f6a] border-t border-[#eef3f0]">{weekday}</td>
                          {(['morning', 'evening', 'night'] as Shift[]).map(shift => {
                            const stId = docStationId(selectedDoc.id, day, shift)
                            const label = stationLabelFor(day, shift, stId)
                            return (
                              <td key={shift} className="px-1.5 py-1 text-center border-t border-l border-[#eef3f0]">
                                <button
                                  onClick={() => setDocEditCell({ day, shift })}
                                  className={`w-full px-1.5 py-1 rounded border whitespace-nowrap ${
                                    stId ? 'border-[#c9d8d1] bg-white hover:border-[#0f6e5c] text-[#16221f]' : 'border-dashed border-[#d9c7bf] text-[#a9998f] hover:bg-[#eef3f0]'
                                  }`}
                                >
                                  {label}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {/* Shift tabs + edit toggle */}
          <div className="flex items-center justify-between gap-2 mb-4 border-b border-[#c9d8d1] print:hidden">
            <div className="flex gap-2">
              {SHIFTS.map(s => (
                <button
                  key={s}
                  onClick={() => setShiftTab(s)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    shiftTab === s ? 'border-[#0f6e5c] text-[#0f6e5c]' : 'border-transparent text-[#5c6f6a] hover:text-[#16221f]'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setEditMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium mb-1 ${
                editMode ? 'bg-[#0f6e5c] text-white' : 'bg-[#eef3f0] text-[#5c6f6a] hover:text-[#0f6e5c]'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              {editMode ? 'Done editing' : 'Edit assignments'}
            </button>
          </div>


          {/* Printable roster */}
          <div ref={printRef} className="print-area bg-white rounded-xl border border-[#c9d8d1] p-5">
            <div className="text-center mb-4">
              <div className="text-sm font-semibold text-[#0a4f42]">{settings.hospitalName}</div>
              <div className="text-xs text-[#5c6f6a] mt-1">
                Duty Roster — {SHIFT_LABEL[shiftTab]} — {MONTHS[meta.month - 1]} {meta.year}
              </div>
              {settings.preparedByName && (
                <div className="text-[10px] text-[#5c6f6a] mt-1">Prepared by {settings.preparedByName}</div>
              )}
            </div>

            <div className="space-y-3">
              {Array.from({ length: meta.days }, (_, i) => i + 1).map(day => {
                const dayStations = effectiveStations[day]?.[shiftTab] || []
                const weekday = new Date(meta.year, meta.month - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
                const holiday = isHolidayDay(day, meta.year, meta.month, holidays)
                return (
                  <div key={day} className="border-b border-[#eef3f0] pb-2 last:border-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[#16221f]">Day {day} ({weekday})</span>
                      {holiday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f7dfd9] text-[#a83a2c] font-medium">Holiday</span>}
                    </div>
                    {dayStations.length === 0 ? (
                      <p className="text-xs text-[#5c6f6a] italic">No stations staffed this shift.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        {dayStations.map(st => {
                          const ids = roster[day]?.[shiftTab]?.[st.id] || []
                          return (
                            <div key={st.id} className="text-xs flex justify-between gap-2">
                              <span className="text-[#5c6f6a]">{stationDisplayLabel(st)}</span>
                              <span className="text-[#16221f] font-medium text-right">
                                {ids.length > 0 ? ids.map(doctorName).join(', ') : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}


      {/* Per-doctor cell picker: choose which station this doctor is on */}
      {docEditCell && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:w-[420px] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[#c9d8d1] px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#16221f]">{selectedDoc.name}</h2>
                <p className="text-xs text-[#5c6f6a] mt-0.5">Day {docEditCell.day} · {docEditCell.shift}</p>
              </div>
              <button onClick={() => setDocEditCell(null)} className="text-[#5c6f6a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {docStationId(selectedDoc.id, docEditCell.day, docEditCell.shift) && (
                <button
                  onClick={() => { setDocAssignment(selectedDoc.id, docEditCell.day, docEditCell.shift, null); setDocEditCell(null) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#a83a2c] hover:bg-[#f7dfd9] font-medium"
                >
                  Off — remove this duty
                </button>
              )}
              {(() => {
                const cur = docStationId(selectedDoc.id, docEditCell.day, docEditCell.shift)
                const list = effectiveStations?.[docEditCell.day]?.[docEditCell.shift] || []
                if (list.length === 0) return <p className="text-center text-sm text-[#5c6f6a] py-6">No stations run this shift.</p>
                return list.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setDocAssignment(selectedDoc.id, docEditCell.day, docEditCell.shift, s.id); setDocEditCell(null) }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-[#eef3f0] flex items-center justify-between ${s.id === cur ? 'bg-[#dcefe9]' : ''}`}
                  >
                    <span className="font-medium text-[#16221f]">{stationDisplayLabel(s)}</span>
                    <span className="text-[10px] text-[#5c6f6a]">
                      {(roster?.[docEditCell.day]?.[docEditCell.shift]?.[s.id]?.length ?? 0)}/{s.needed}
                    </span>
                  </button>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
