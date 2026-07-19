import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useStations } from '@/hooks/useData'
import type { Shift, Station } from '@/types'
import { SHIFT_LABEL } from '@/types'
import { stationDisplayLabel } from '@/lib/utils'
import { Plus, Trash2, Edit3, ClipboardList, X } from 'lucide-react'

const SHIFT_TABS: Shift[] = ['morning', 'evening', 'night']

export default function StationsPage() {
  const { stations, wards } = useAppStore()
  const { stationRows, createStation, updateStation, deleteStation } = useStations()

  const [shift, setShift] = useState<Shift>('morning')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [selectedWards, setSelectedWards] = useState<string[]>([])
  const [needed, setNeeded] = useState(1)

  const activeWards = wards.filter(w => w.active)
  const list = stations[shift]

  const resetForm = () => {
    setLabel('')
    setSelectedWards([])
    setNeeded(1)
    setEditingId(null)
  }

  const openAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (s: Station) => {
    setLabel(s.label)
    setSelectedWards([...s.wards])
    setNeeded(s.needed)
    setEditingId(s.id)
    setShowForm(true)
  }

  const handleSave = () => {
    if (!label.trim() || selectedWards.length === 0) return
    if (editingId) {
      updateStation.mutate({ id: editingId, label: label.trim(), wards: selectedWards, needed })
    } else {
      createStation.mutate({ label: label.trim(), wards: selectedWards, needed, shift })
    }
    setShowForm(false)
    resetForm()
  }

  const handleDelete = (s: Station) => {
    if (confirm(`Delete station "${s.label}"? This cannot be undone.`)) {
      deleteStation.mutate(s.id)
    }
  }

  const totalSlots = list.reduce((sum, s) => sum + s.needed, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Shift Requirements
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          How many doctors are needed at each station, per shift
        </p>
      </div>

      {stationRows && stationRows.length === 0 && (
        <div className="bg-[#f6e3d3] text-[#6b4c19] text-xs rounded-lg px-3 py-2 mb-4">
          Loading default station list into the database — this only happens once.
        </div>
      )}

      {/* Shift tabs */}
      <div className="flex gap-2 mb-4 border-b border-[#c9d8d1]">
        {SHIFT_TABS.map(s => (
          <button
            key={s}
            onClick={() => setShift(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              shift === s ? 'border-[#0f6e5c] text-[#0f6e5c]' : 'border-transparent text-[#5c6f6a] hover:text-[#16221f]'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#5c6f6a]">
          {SHIFT_LABEL[shift]} — {list.length} stations, {totalSlots} slots
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0f6e5c] text-white text-xs font-medium hover:bg-[#0a4f42]"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Station
        </button>
      </div>

      {list.length === 0 && (
        <div className="text-center py-12 text-[#5c6f6a]">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No stations for this shift yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {list.map(s => (
          <div key={s.id} className="bg-white rounded-lg border border-[#c9d8d1] p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#16221f]">{s.label}</div>
              <div className="text-xs text-[#5c6f6a] mt-0.5">
                {stationDisplayLabel(s)} &middot; needs {s.needed} doctor{s.needed === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-[#5c6f6a] hover:bg-[#eef3f0] hover:text-[#0f6e5c]">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(s)} className="p-2 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:w-[440px] sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#c9d8d1] px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#16221f]">
                {editingId ? 'Edit Station' : `Add Station — ${shift.charAt(0).toUpperCase() + shift.slice(1)}`}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[#5c6f6a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Station label</label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Ward 9 & Cabin"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-2">Wards covered by this station</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-[#c9d8d1] rounded-lg">
                  {activeWards.map(w => (
                    <label key={w.id} className="flex items-center gap-1.5 text-xs px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedWards.includes(w.name)}
                        onChange={e => {
                          setSelectedWards(e.target.checked
                            ? [...selectedWards, w.name]
                            : selectedWards.filter(x => x !== w.name)
                          )
                        }}
                        className="accent-[#0f6e5c]"
                      />
                      {w.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Doctors needed</label>
                <input
                  type="number"
                  min={1}
                  value={needed}
                  onChange={e => setNeeded(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!label.trim() || selectedWards.length === 0 || createStation.isPending || updateStation.isPending}
                  className="flex-1 py-3 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
                >
                  {editingId ? 'Save Changes' : 'Add Station'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-3 rounded-lg border border-[#c9d8d1] text-sm hover:bg-[#eef3f0]"
                >
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
