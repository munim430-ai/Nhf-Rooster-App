import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useWards } from '@/hooks/useData'
import type { Ward, WardGroup } from '@/types'
import { Plus, Trash2, Building2 } from 'lucide-react'

const GROUP_OPTIONS: WardGroup[] = ['General', 'DS', 'OPD', 'Cath']

// Display labels for ward groups (the stored value stays the same).
const GROUP_LABEL: Record<WardGroup, string> = {
  General: 'Main',
  DS: 'DS',
  OPD: 'OPD',
  Cath: 'Cath',
}

const GROUP_COLORS: Record<WardGroup, string> = {
  General: 'bg-[#dcefe9] text-[#0f6e5c]',
  DS: 'bg-[#dde9f2] text-[#264a72]',
  OPD: 'bg-[#f4ecd2] text-[#6b4c19]',
  Cath: 'bg-[#e3e1f2] text-[#4a3b7a]',
}

export default function WardsPage() {
  const { wards } = useAppStore()
  const { createWard, toggleWard, deleteWard } = useWards()

  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<WardGroup>('General')
  const [filterGroup, setFilterGroup] = useState<WardGroup | ''>('')

  const visibleWards = wards.filter(w => !filterGroup || w.group === filterGroup)
  const grouped = GROUP_OPTIONS.map(g => ({
    group: g,
    items: visibleWards.filter(w => w.group === g),
  })).filter(g => g.items.length > 0)

  const handleAdd = () => {
    if (!name.trim()) return
    createWard.mutate({ name: name.trim(), group })
    setName('')
    setGroup('General')
    setShowAdd(false)
  }

  const handleDelete = (w: Ward) => {
    if (confirm(`Delete ward "${w.name}"? This cannot be undone.`)) {
      deleteWard.mutate(w.id)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Wards
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          {wards.filter(w => w.active).length} active wards
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value as WardGroup | '')}
          className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
        >
          <option value="">All groups</option>
          {GROUP_OPTIONS.map(g => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] sm:ml-auto"
        >
          <Plus className="w-4 h-4" />
          Add Ward
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-[#c9d8d1] p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#5c6f6a] mb-1">Ward name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 6A"
              className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#5c6f6a] mb-1">Group</label>
            <select
              value={group}
              onChange={e => setGroup(e.target.value as WardGroup)}
              className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
            >
              {GROUP_OPTIONS.map(g => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!name.trim() || createWard.isPending}
              className="px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
            >
              {createWard.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2.5 rounded-lg border border-[#c9d8d1] text-sm hover:bg-[#eef3f0]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {visibleWards.length === 0 && (
        <div className="text-center py-12 text-[#5c6f6a]">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No wards yet.</p>
        </div>
      )}

      <div className="space-y-5">
        {grouped.map(({ group: g, items }) => (
          <div key={g}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5c6f6a] mb-2">{GROUP_LABEL[g]}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {items.map(w => (
                <div
                  key={w.id}
                  className={`bg-white rounded-lg border p-3 flex items-center justify-between ${
                    w.active ? 'border-[#c9d8d1]' : 'border-[#e2ece7] opacity-60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${w.active ? 'text-[#16221f]' : 'text-[#5c6f6a] line-through'}`}>
                      {w.name}
                    </div>
                    <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${GROUP_COLORS[w.group]}`}>
                      {GROUP_LABEL[w.group]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => toggleWard.mutate({ id: w.id, active: !w.active })}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium ${
                        w.active ? 'text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]' : 'text-[#0f6e5c] hover:bg-[#dcefe9]'
                      }`}
                    >
                      {w.active ? 'Off' : 'On'}
                    </button>
                    <button
                      onClick={() => handleDelete(w)}
                      className="p-1.5 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
