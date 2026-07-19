import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useHolidays } from '@/hooks/useData'
import { MONTHS } from '@/types'
import { Plus, Trash2, CalendarX } from 'lucide-react'

export default function HolidaysPage() {
  const { holidays, meta, setMeta } = useAppStore()
  const { createHoliday, deleteHoliday } = useHolidays()

  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState(1)
  const [label, setLabel] = useState('')

  const daysInMonth = new Date(meta.year, meta.month, 0).getDate()
  const monthHolidays = holidays
    .filter(h => h.year === meta.year && h.month === meta.month)
    .sort((a, b) => a.date - b.date)

  const years = Array.from({ length: 5 }, (_, i) => meta.year - 2 + i)

  const handleAdd = () => {
    if (!label.trim()) return
    createHoliday.mutate({ date, label: label.trim(), year: meta.year, month: meta.month })
    setLabel('')
    setDate(1)
    setShowAdd(false)
  }

  const handleDelete = (id: string, lbl: string) => {
    if (confirm(`Delete holiday "${lbl}"?`)) deleteHoliday.mutate(id)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Holidays & Events
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          Government holidays close OPD/HTN/Cath for the day — every Friday is already treated as a holiday automatically.
        </p>
      </div>

      {/* Month selector */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={meta.month}
          onChange={e => setMeta({ ...meta, month: parseInt(e.target.value) })}
          className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={meta.year}
          onChange={e => setMeta({ ...meta, year: parseInt(e.target.value) })}
          className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] sm:ml-auto"
        >
          <Plus className="w-4 h-4" />
          Add Holiday
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-[#c9d8d1] p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div>
            <label className="block text-xs text-[#5c6f6a] mb-1">Day of {MONTHS[meta.month - 1]}</label>
            <select
              value={date}
              onChange={e => setDate(parseInt(e.target.value))}
              className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#5c6f6a] mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Independence Day"
              className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!label.trim() || createHoliday.isPending}
              className="px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
            >
              {createHoliday.isPending ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-lg border border-[#c9d8d1] text-sm hover:bg-[#eef3f0]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {monthHolidays.length === 0 && (
        <div className="text-center py-12 text-[#5c6f6a]">
          <CalendarX className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No holidays marked for {MONTHS[meta.month - 1]} {meta.year}.</p>
        </div>
      )}

      <div className="space-y-2">
        {monthHolidays.map(h => (
          <div key={h.id} className="bg-white rounded-lg border border-[#c9d8d1] p-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#16221f]">{h.label}</span>
              <span className="text-xs text-[#5c6f6a] ml-2">
                {MONTHS[meta.month - 1]} {h.date}, {meta.year}
              </span>
            </div>
            <button onClick={() => handleDelete(h.id, h.label)} className="p-2 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
