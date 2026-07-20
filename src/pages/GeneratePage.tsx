import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRosterSnapshots, useDutyBankHistory } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { generateRoster } from '@/lib/rosterGenerator'
import { computeRosterStats } from '@/lib/rosterStats'
import { exportRosterExcel, exportRosterDocx, exportRosterCsv, type RosterExportContext } from '@/lib/rosterExport'
import { monthKey, isHolidayDay, stationDisplayLabel } from '@/lib/utils'
import { MONTHS, SHIFTS, SHIFT_LABEL } from '@/types'
import type { Shift } from '@/types'
import {
  Play, Save, FileDown, FileSpreadsheet, FileText, FileType, Printer,
  AlertTriangle, ChevronDown, ChevronUp, Pencil, X, Search,
} from 'lucide-react'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function GeneratePage() {
  const {
    doctors, wards, stations, demands, holidays, meta, setMeta,
    roster, effectiveStations, warnings, setRoster, setEffectiveStations, setWarnings,
    fridayNightHistory, setFridayNightHistory, dutyBank, setDutyBank, settings,
    secretUnlocked,
  } = useAppStore()
  const { makerLabel, isMaster } = useAuth()
  const { saveSnapshot } = useRosterSnapshots()
  const { upsertMonth } = useDutyBankHistory()

  const [shiftTab, setShiftTab] = useState<Shift>('morning')
  const [editMode, setEditMode] = useState(false)
  const [editSlot, setEditSlot] = useState<
    { day: number; stationId: string; position: number; current: string | null; label: string } | null
  >(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [showWarnings, setShowWarnings] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'docx' | 'csv' | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const printRef = useRef<HTMLDivElement>(null)

  const activeDoctors = doctors.filter(d => d.active)
  const daysInMonth = new Date(meta.year, meta.month, 0).getDate()
  const years = Array.from({ length: 5 }, (_, i) => meta.year - 2 + i)
  const totalStations = SHIFTS.reduce((sum, s) => sum + stations[s].length, 0)
  const canGenerate = activeDoctors.length > 0 && totalStations > 0

  const handleGenerate = async () => {
    setIsGenerating(true)
    setSaveMsg('')
    await sleep(30) // let the button show its busy state before the sync work blocks the thread
    const result = generateRoster(
      doctors, stations, demands, holidays,
      meta.year, meta.month, daysInMonth,
      fridayNightHistory, dutyBank
    )
    setRoster(result.roster)
    setEffectiveStations(result.effectiveStations)
    setWarnings(result.warnings)
    setMeta({ ...meta, days: daysInMonth, generatedAt: new Date().toISOString() })
    setFridayNightHistory({ ...fridayNightHistory, [monthKey(meta.year, meta.month)]: result.fridayNightCount })
    setIsGenerating(false)
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

  // Columns for the editable grid: every station that appears for the selected
  // shift anywhere in the month, in first-seen order.
  const gridColumns = useMemo(() => {
    if (!effectiveStations) return [] as { id: string; label: string }[]
    const cols: { id: string; label: string }[] = []
    const seen = new Set<string>()
    for (let day = 1; day <= meta.days; day++) {
      for (const st of effectiveStations[day]?.[shiftTab] || []) {
        if (!seen.has(st.id)) {
          seen.add(st.id)
          cols.push({ id: st.id, label: stationDisplayLabel(st) })
        }
      }
    }
    return cols
  }, [effectiveStations, shiftTab, meta.days])

  // Immutable update of a single slot in the roster.
  const updateSlot = (day: number, stationId: string, position: number, newId: string | null) => {
    if (!roster) return
    const arr = [...(roster[day]?.[shiftTab]?.[stationId] || [])]
    if (newId === null) {
      if (position < arr.length) arr.splice(position, 1)
    } else if (position < arr.length) {
      arr[position] = newId
    } else {
      arr.push(newId)
    }
    setRoster({
      ...roster,
      [day]: {
        ...roster[day],
        [shiftTab]: {
          ...roster[day]?.[shiftTab],
          [stationId]: arr,
        },
      },
    })
  }

  const applyPick = (newId: string | null) => {
    if (!editSlot) return
    updateSlot(editSlot.day, editSlot.stationId, editSlot.position, newId)
    setEditSlot(null)
    setPickerSearch('')
  }

  const pickerList = pickableDoctors.filter(
    d => !pickerSearch || d.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Generate & Export
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">Build the month's roster and export it as PDF, Excel, Word, or CSV</p>
      </div>

      {/* Month selector + pre-flight */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={meta.month}
            onChange={e => setMeta({ ...meta, month: parseInt(e.target.value) })}
            className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={meta.year}
            onChange={e => setMeta({ ...meta, year: parseInt(e.target.value) })}
            className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50 sm:ml-auto"
          >
            <Play className="w-4 h-4" />
            {isGenerating ? 'Generating...' : roster ? 'Regenerate Roster' : 'Generate Roster'}
          </button>
        </div>
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

          {/* Interactive editable grid (on-screen only) */}
          {editMode && (
            <div className="bg-white rounded-xl border border-[#c9d8d1] p-4 mb-4 print:hidden">
              <p className="text-xs text-[#5c6f6a] mb-3">
                Tap any doctor or an empty slot to reassign it. Changes apply instantly to the preview,
                summary, and exports below — remember to <b>Save Roster</b> when you're done.
              </p>
              <div className="overflow-x-auto border border-[#c9d8d1] rounded-lg">
                <table className="text-[11px] border-collapse min-w-[900px] w-full">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[#0f6e5c] text-white font-medium px-2 py-1.5 text-left">Day</th>
                      <th className="bg-[#0f6e5c] text-white font-medium px-2 py-1.5">Wk</th>
                      {gridColumns.map(col => (
                        <th key={col.id} className="bg-[#0f6e5c] text-white font-medium px-2 py-1.5 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: meta.days }, (_, i) => i + 1).map(day => {
                      const weekday = new Date(meta.year, meta.month - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
                      const holiday = isHolidayDay(day, meta.year, meta.month, holidays)
                      return (
                        <tr key={day} className={holiday ? 'bg-[#f6e3d3]' : ''}>
                          <td className={`sticky left-0 z-10 font-semibold px-2 py-1 text-left border-t border-[#e2ece7] ${holiday ? 'bg-[#ecd3b8]' : 'bg-[#e2ece7]'}`}>
                            {day}{holiday ? ' ★' : ''}
                          </td>
                          <td className="px-2 py-1 text-center border-t border-[#eef3f0] text-[#5c6f6a]">{weekday}</td>
                          {gridColumns.map(col => {
                            const effStation = effectiveStations[day]?.[shiftTab]?.find(s => s.id === col.id)
                            const assigned = roster[day]?.[shiftTab]?.[col.id] || []
                            return (
                              <td key={col.id} className="px-1.5 py-1 text-center border-t border-l border-[#eef3f0] align-top">
                                {!effStation ? (
                                  <span className="text-[#c9d8d1]">×</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {assigned.map((docId, pos) => (
                                      <button
                                        key={pos}
                                        onClick={() => setEditSlot({ day, stationId: col.id, position: pos, current: docId, label: effStation.label })}
                                        className="px-1.5 py-0.5 rounded border border-[#c9d8d1] bg-white hover:border-[#0f6e5c] whitespace-nowrap"
                                      >
                                        {doctorName(docId)}
                                      </button>
                                    ))}
                                    {Array.from({ length: Math.max(0, effStation.needed - assigned.length) }).map((_, k) => (
                                      <button
                                        key={`e${k}`}
                                        onClick={() => setEditSlot({ day, stationId: col.id, position: assigned.length, current: null, label: effStation.label })}
                                        className="px-1.5 py-0.5 rounded border border-dashed border-[#d99] text-[#a83a2c] hover:bg-[#f7dfd9]"
                                      >
                                        + empty
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

      {/* Reassignment picker */}
      {editSlot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:w-[420px] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[#c9d8d1] px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#16221f]">Reassign slot</h2>
                <p className="text-xs text-[#5c6f6a] mt-0.5">
                  {editSlot.label} · Day {editSlot.day} · {shiftTab}
                </p>
              </div>
              <button onClick={() => { setEditSlot(null); setPickerSearch('') }} className="text-[#5c6f6a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-[#eef3f0]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6f6a]" />
                <input
                  autoFocus
                  type="text"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search doctors..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-2">
              {editSlot.current && (
                <button
                  onClick={() => applyPick(null)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#a83a2c] hover:bg-[#f7dfd9] font-medium"
                >
                  Remove {doctorName(editSlot.current)} (leave empty)
                </button>
              )}
              {pickerList.length === 0 && (
                <p className="text-center text-sm text-[#5c6f6a] py-6">No doctors match.</p>
              )}
              {pickerList.map(d => (
                <button
                  key={d.id}
                  onClick={() => applyPick(d.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-[#eef3f0] flex items-center justify-between ${
                    d.id === editSlot.current ? 'bg-[#dcefe9]' : ''
                  }`}
                >
                  <span className="font-medium text-[#16221f]">{d.name}</span>
                  <span className="text-[10px] text-[#5c6f6a]">{d.categories.join('/')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
