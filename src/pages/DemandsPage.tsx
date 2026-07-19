import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useDemands } from '@/hooks/useData'
import type { Demand, DemandKind, DemandScope, Shift } from '@/types'
import { Plus, Trash2, X, CalendarCheck } from 'lucide-react'

const KIND_OPTIONS: { value: DemandKind; label: string; hint: string }[] = [
  { value: 'off', label: 'Off request', hint: 'Doctor should not be scheduled' },
  { value: 'double', label: 'Double duty', hint: 'Doctor wants two consecutive shifts (M+E or E+N)' },
  { value: 'single', label: 'Single only', hint: 'Overrides a standing double duty for this day/week' },
  { value: 'leave', label: 'Casual leave', hint: 'Doctor unavailable for a date range' },
  { value: 'assign', label: 'Fixed assignment', hint: 'Force doctor onto a specific ward/shift' },
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHIFT_OPTIONS: Shift[] = ['morning', 'evening', 'night']

const KIND_LABEL: Record<DemandKind, string> = {
  off: 'Off', double: 'Double duty', single: 'Single only', leave: 'Leave', assign: 'Fixed assign',
}
const KIND_COLOR: Record<DemandKind, string> = {
  off: 'bg-[#f7dfd9] text-[#a83a2c]',
  double: 'bg-[#dde9f2] text-[#264a72]',
  single: 'bg-[#eef3f0] text-[#5c6f6a]',
  leave: 'bg-[#f4ecd2] text-[#6b4c19]',
  assign: 'bg-[#e3e1f2] text-[#4a3b7a]',
}

export default function DemandsPage() {
  const { doctors, wards } = useAppStore()
  const { demands, createDemand, deleteDemand } = useDemands()

  const [showAdd, setShowAdd] = useState(false)
  const [filterDoctor, setFilterDoctor] = useState('')

  const [doctorId, setDoctorId] = useState('')
  const [kind, setKind] = useState<DemandKind>('off')
  const [scope, setScope] = useState<DemandScope>('weekly')
  const [shift, setShift] = useState<Shift | ''>('')
  const [pair, setPair] = useState<'ME' | 'EN'>('ME')
  const [wardName, setWardName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [date, setDate] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')

  const activeDoctors = doctors.filter(d => d.active)
  const activeWards = wards.filter(w => w.active)

  const visibleDemands = demands
    ? (filterDoctor ? demands.filter(d => d.doctorId === filterDoctor) : demands)
    : []

  const doctorName = (id: string) => doctors.find(d => d.id === id)?.name || 'Unknown doctor'

  const resetForm = () => {
    setDoctorId('')
    setKind('off')
    setScope('weekly')
    setShift('')
    setPair('ME')
    setWardName('')
    setDayOfWeek(1)
    setDate(1)
    setStartDate('')
    setEndDate('')
    setNote('')
  }

  const canSave = () => {
    if (!doctorId) return false
    if (kind === 'leave') return !!startDate && !!endDate && endDate >= startDate
    if (kind === 'assign' && (!shift || !wardName)) return false
    if (scope === 'weekly' && (dayOfWeek < 0 || dayOfWeek > 6)) return false
    if (scope === 'date' && (date < 1 || date > 31)) return false
    return true
  }

  const handleSave = () => {
    if (!canSave()) return
    const payload: Omit<Demand, 'id' | 'created_at'> = {
      doctorId,
      kind,
      scope: kind === 'leave' ? 'date' : scope,
      shift: kind === 'assign' ? (shift as Shift) : (shift || null),
      pair: kind === 'double' ? pair : null,
      wardName: kind === 'assign' ? wardName : null,
      dayOfWeek: scope === 'weekly' && kind !== 'leave' ? dayOfWeek : null,
      date: scope === 'date' && kind !== 'leave' ? date : null,
      startDate: kind === 'leave' ? startDate : null,
      endDate: kind === 'leave' ? endDate : null,
      note: note.trim() || null,
    }
    createDemand.mutate(payload)
    setShowAdd(false)
    resetForm()
  }

  const handleDelete = (d: Demand) => {
    if (confirm(`Delete this demand for ${doctorName(d.doctorId)}?`)) {
      deleteDemand.mutate(d.id)
    }
  }

  const describe = (d: Demand): string => {
    if (d.kind === 'leave') return `Leave: ${d.startDate} to ${d.endDate}`
    const when = d.scope === 'always' ? 'always'
      : d.scope === 'weekly' ? `every ${WEEKDAYS[d.dayOfWeek ?? 0]}`
      : `day ${d.date} of the month`
    const shiftPart = d.shift ? ` (${d.shift})` : ''
    if (d.kind === 'double') return `Double duty ${d.pair === 'EN' ? 'evening+night' : 'morning+evening'}, ${when}`
    if (d.kind === 'single') return `Single shift only, ${when}`
    if (d.kind === 'assign') return `Fixed to "${d.wardName}"${shiftPart}, ${when}`
    return `Off${shiftPart}, ${when}`
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Demands
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">Standing requests the roster generator must respect</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={filterDoctor}
          onChange={e => setFilterDoctor(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
        >
          <option value="">All doctors</option>
          {activeDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button
          onClick={() => { resetForm(); setShowAdd(true) }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] sm:ml-auto"
        >
          <Plus className="w-4 h-4" />
          Add Demand
        </button>
      </div>

      {visibleDemands.length === 0 && (
        <div className="text-center py-12 text-[#5c6f6a]">
          <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No demands yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {visibleDemands.map(d => (
          <div key={d.id} className="bg-white rounded-lg border border-[#c9d8d1] p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#16221f]">{doctorName(d.doctorId)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${KIND_COLOR[d.kind]}`}>
                  {KIND_LABEL[d.kind]}
                </span>
              </div>
              <div className="text-xs text-[#5c6f6a] mt-1">{describe(d)}</div>
              {d.note && <div className="text-xs text-[#5c6f6a] italic mt-0.5">"{d.note}"</div>}
            </div>
            <button onClick={() => handleDelete(d)} className="p-2 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c] flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:w-[480px] sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#c9d8d1] px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#16221f]">Add Demand</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#5c6f6a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Doctor</label>
                <select
                  value={doctorId}
                  onChange={e => setDoctorId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                >
                  <option value="">Select doctor...</option>
                  {activeDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#5c6f6a] mb-2">Kind</label>
                <div className="grid grid-cols-1 gap-2">
                  {KIND_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setKind(opt.value)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        kind === opt.value ? 'border-[#0f6e5c] bg-[#dcefe9]' : 'border-[#c9d8d1] hover:border-[#0f6e5c]'
                      }`}
                    >
                      <div className="font-medium text-[#16221f]">{opt.label}</div>
                      <div className="text-[#5c6f6a] mt-0.5">{opt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {kind === 'leave' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#5c6f6a] mb-1">Leave starts</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5c6f6a] mb-1">Leave ends</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm" />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-[#5c6f6a] mb-2">When</label>
                    <div className="flex gap-2">
                      {(['weekly', 'date'] as DemandScope[]).concat(kind === 'double' || kind === 'single' ? ['always'] : []).map(s => (
                        <button
                          key={s}
                          onClick={() => setScope(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            scope === s ? 'bg-[#0f6e5c] text-white border-[#0f6e5c]' : 'bg-white text-[#5c6f6a] border-[#c9d8d1]'
                          }`}
                        >
                          {s === 'weekly' ? 'Every week' : s === 'date' ? 'Specific date' : 'Always'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {scope === 'weekly' && (
                    <div>
                      <label className="block text-xs text-[#5c6f6a] mb-1">Day of week</label>
                      <select value={dayOfWeek} onChange={e => setDayOfWeek(parseInt(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm">
                        {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                      </select>
                    </div>
                  )}
                  {scope === 'date' && (
                    <div>
                      <label className="block text-xs text-[#5c6f6a] mb-1">Day of month (1-31)</label>
                      <input type="number" min={1} max={31} value={date}
                        onChange={e => setDate(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm" />
                      <p className="text-[11px] text-[#b5602a] mt-1">Applies to this day every month — delete it once the month has passed.</p>
                    </div>
                  )}

                  {(kind === 'off' || kind === 'assign') && (
                    <div>
                      <label className="block text-xs text-[#5c6f6a] mb-1">
                        Shift {kind === 'off' ? '(optional — leave blank for all shifts)' : ''}
                      </label>
                      <select value={shift} onChange={e => setShift(e.target.value as Shift | '')}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm">
                        {kind === 'off' && <option value="">All shifts</option>}
                        {kind === 'assign' && <option value="">Select shift...</option>}
                        {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}

                  {kind === 'double' && (
                    <div>
                      <label className="block text-xs text-[#5c6f6a] mb-2">Pair</label>
                      <div className="flex gap-2">
                        <button onClick={() => setPair('ME')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${pair === 'ME' ? 'bg-[#0f6e5c] text-white border-[#0f6e5c]' : 'bg-white text-[#5c6f6a] border-[#c9d8d1]'}`}>
                          Morning + Evening
                        </button>
                        <button onClick={() => setPair('EN')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${pair === 'EN' ? 'bg-[#0f6e5c] text-white border-[#0f6e5c]' : 'bg-white text-[#5c6f6a] border-[#c9d8d1]'}`}>
                          Evening + Night
                        </button>
                      </div>
                    </div>
                  )}

                  {kind === 'assign' && (
                    <div>
                      <label className="block text-xs text-[#5c6f6a] mb-1">Ward</label>
                      <select value={wardName} onChange={e => setWardName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm">
                        <option value="">Select ward...</option>
                        {activeWards.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Note (optional)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Conference travel"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm" />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!canSave() || createDemand.isPending}
                  className="flex-1 py-3 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
                >
                  {createDemand.isPending ? 'Saving...' : 'Add Demand'}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-3 rounded-lg border border-[#c9d8d1] text-sm hover:bg-[#eef3f0]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
