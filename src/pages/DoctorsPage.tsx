import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import { useDoctors } from '@/hooks/useData'
import type { Doctor, Category } from '@/types'
import {
  Plus, Search, Edit3, Trash2, ChevronDown, ChevronUp,
  Stethoscope, Moon, HeartPulse, Eye, EyeOff
} from 'lucide-react'

const CATEGORY_OPTIONS: Category[] = ['SMO', 'EMO', 'MO', 'First Man']

const defaultOpdRange = (categories: Category[]) => {
  if (categories.includes('SMO')) return { opdMin: 4, opdMax: 6 }
  if (categories.includes('EMO')) return { opdMin: 0, opdMax: 4 }
  return { opdMin: 0, opdMax: null as number | null }
}

const defaultTarget = (categories: Category[]) => {
  if (categories.includes('SMO')) return 18
  if (categories.includes('EMO')) return 22
  return 23
}

export default function DoctorsPage() {
  const { doctors, wards, secretUnlocked, setSecretUnlocked } = useAppStore()
  const { isMaster } = useAuth()
  const { createDoctor, updateDoctor, deleteDoctor: deleteDoctorMutation } = useDoctors()

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<Category | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formCats, setFormCats] = useState<Category[]>(['MO'])
  const [formTarget, setFormTarget] = useState(23)
  const [formNightTarget, setFormNightTarget] = useState(6)
  const [formCath, setFormCath] = useState(false)
  const [formCathQuota, setFormCathQuota] = useState(10)
  const [formWards, setFormWards] = useState<string[]>([])
  const [formPreferredWards, setFormPreferredWards] = useState<string[]>([])
  const [formSecret, setFormSecret] = useState(false)
  const [formOpdMin, setFormOpdMin] = useState(0)
  const [formOpdMax, setFormOpdMax] = useState<number | null>(null)
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')

  const activeWards = wards.filter(w => w.active)
  const visibleDoctors = doctors.filter(d => {
    if (d.secret && !secretUnlocked) return false
    if (filterCat && !d.categories.includes(filterCat)) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const resetForm = () => {
    setFormName('')
    setFormCats(['MO'])
    setFormTarget(23)
    setFormNightTarget(6)
    setFormCath(false)
    setFormCathQuota(10)
    setFormWards([])
    setFormPreferredWards([])
    setFormSecret(false)
    setFormOpdMin(0)
    setFormOpdMax(null)
    setFormStart('')
    setFormEnd('')
  }

  const openAdd = () => {
    resetForm()
    setEditingId(null)
    setShowAdd(true)
  }

  const openEdit = (doc: Doctor) => {
    setFormName(doc.name)
    setFormCats([...doc.categories])
    setFormTarget(doc.target)
    setFormNightTarget(doc.nightTarget)
    setFormCath(doc.cathEligible)
    setFormCathQuota(doc.cathQuota)
    setFormWards([...doc.allowedWards])
    setFormPreferredWards([...(doc.preferredWards ?? [])])
    setFormSecret(doc.secret)
    setFormOpdMin(doc.opdMin)
    setFormOpdMax(doc.opdMax)
    setFormStart(doc.dutyStartDate || '')
    setFormEnd(doc.dutyEndDate || '')
    setEditingId(doc.id)
    setShowAdd(true)
  }

  const handleSave = () => {
    if (!formName.trim()) return
    if (formCats.length === 0) return
    if (formStart && formEnd && formEnd < formStart) return

    const base = {
      name: formName.trim(),
      categories: [...formCats],
      secret: formSecret,
      allowedWards: [...formWards],
      preferredWards: [...formPreferredWards],
      cathEligible: formCath,
      cathQuota: formCathQuota,
      target: formTarget,
      nightTarget: formNightTarget,
      opdMin: formOpdMin,
      opdMax: formOpdMax,
      dutyStartDate: formStart || null,
      dutyEndDate: formEnd || null,
    }

    if (editingId) {
      const existing = doctors.find(d => d.id === editingId)
      updateDoctor.mutate({ id: editingId, active: existing?.active ?? true, ...base })
    } else {
      createDoctor.mutate({ ...base, active: true })
    }
    setShowAdd(false)
    resetForm()
  }

  const toggleActive = (doc: Doctor) => {
    updateDoctor.mutate({ ...doc, active: !doc.active })
  }

  const deleteDoctor = (id: string) => {
    if (confirm('Delete this doctor? This cannot be undone.')) {
      deleteDoctorMutation.mutate(id)
    }
  }

  const categoryBadge = (cat: Category) => {
    const colors: Record<Category, string> = {
      SMO: 'bg-[#e6d9c3] text-[#6b4c19]',
      EMO: 'bg-[#dde9f2] text-[#264a72]',
      MO: 'bg-[#dcefe9] text-[#0f6e5c]',
      'First Man': 'bg-[#f4d9df] text-[#7a2c42]',
    }
    return (
      <span key={cat} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[cat]}`}>
        {cat}
      </span>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Doctors
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          {doctors.filter(d => d.active && !d.secret).length} active doctors
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6f6a]" />
          <input
            type="text"
            placeholder="Search doctors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value as Category | '')}
          className="px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42]"
        >
          <Plus className="w-4 h-4" />
          Add Doctor
        </button>
      </div>

      {/* Secret team toggle */}
      {isMaster && (
        <button
          onClick={() => setSecretUnlocked(!secretUnlocked)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 ${
            secretUnlocked ? 'bg-[#2c2c2c] text-[#f4d35e]' : 'bg-[#eef3f0] text-[#5c6f6a]'
          }`}
        >
          {secretUnlocked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {secretUnlocked ? 'Secret Team Visible' : 'Show Secret Team'}
        </button>
      )}

      {/* Doctor cards (mobile-friendly) */}
      <div className="space-y-3">
        {visibleDoctors.length === 0 && (
          <div className="text-center py-12 text-[#5c6f6a]">
            <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No doctors match your search.</p>
          </div>
        )}

        {visibleDoctors.map(doc => (
          <div
            key={doc.id}
            className={`bg-white rounded-xl border p-4 ${
              doc.active ? 'border-[#c9d8d1]' : 'border-[#e2ece7] opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm ${doc.active ? 'text-[#16221f]' : 'text-[#5c6f6a] line-through'}`}>
                    {doc.name}
                  </span>
                  {doc.secret && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2c2c2c] text-[#f4d35e] font-medium">
                      SECRET
                    </span>
                  )}
                  {doc.cathEligible && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e3e1f2] text-[#4a3b7a] font-medium">
                      Cath
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {doc.categories.map(categoryBadge)}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#5c6f6a]">
                  <span className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" />
                    Target: {doc.target}
                  </span>
                  <span className="flex items-center gap-1">
                    <Moon className="w-3 h-3" />
                    Nights: {doc.nightTarget}
                  </span>
                  {doc.allowedWards.length > 0 && (
                    <span className="text-[10px] bg-[#eef3f0] px-1.5 py-0.5 rounded">
                      {doc.allowedWards.length} wards
                    </span>
                  )}
                </div>
                {(doc.dutyStartDate || doc.dutyEndDate) && (
                  <div className="text-xs text-[#b5602a] mt-1">
                    {doc.dutyStartDate ? `From ${doc.dutyStartDate}` : ''}
                    {doc.dutyStartDate && doc.dutyEndDate ? ' – ' : ''}
                    {doc.dutyEndDate ? `Until ${doc.dutyEndDate}` : ''}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => openEdit(doc)}
                  className="p-2 rounded-lg text-[#5c6f6a] hover:bg-[#eef3f0] hover:text-[#0f6e5c]"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(doc)}
                  className={`p-2 rounded-lg text-xs font-medium ${
                    doc.active ? 'text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]' : 'text-[#0f6e5c] hover:bg-[#dcefe9]'
                  }`}
                >
                  {doc.active ? 'Off' : 'On'}
                </button>
                <button
                  onClick={() => deleteDoctor(doc.id)}
                  className="p-2 rounded-lg text-[#5c6f6a] hover:bg-[#f7dfd9] hover:text-[#a83a2c]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:w-[480px] sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#c9d8d1] px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#16221f]">
                {editingId ? 'Edit Doctor' : 'Add Doctor'}
              </h2>
              <button onClick={() => setShowAdd(false)} className="text-[#5c6f6a]">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Dr. Adan"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                />
              </div>

              {/* Categories */}
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-2">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        const next = formCats.includes(cat)
                          ? formCats.filter(c => c !== cat)
                          : [...formCats, cat]
                        setFormCats(next)
                        if (!editingId) {
                          setFormTarget(defaultTarget(next))
                          const range = defaultOpdRange(next)
                          setFormOpdMin(range.opdMin)
                          setFormOpdMax(range.opdMax)
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formCats.includes(cat)
                          ? 'bg-[#0f6e5c] text-white border-[#0f6e5c]'
                          : 'bg-white text-[#5c6f6a] border-[#c9d8d1] hover:border-[#0f6e5c]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#5c6f6a] mb-1">Monthly Target</label>
                  <input
                    type="number"
                    value={formTarget}
                    onChange={e => setFormTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5c6f6a] mb-1">Night Target</label>
                  <input
                    type="number"
                    value={formNightTarget}
                    onChange={e => setFormNightTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                  />
                </div>
              </div>

              {/* Cath */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formCath}
                    onChange={e => setFormCath(e.target.checked)}
                    className="w-4 h-4 accent-[#0f6e5c]"
                  />
                  Cath-eligible
                </label>
                {formCath && (
                  <input
                    type="number"
                    value={formCathQuota}
                    onChange={e => setFormCathQuota(parseInt(e.target.value) || 0)}
                    placeholder="Quota"
                    className="w-20 px-2 py-1.5 rounded-lg border border-[#c9d8d1] text-sm"
                  />
                )}
              </div>

              {/* Ward restrictions */}
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-2">Ward Restrictions (optional)</label>
                <p className="text-[11px] text-[#5c6f6a] -mt-1 mb-2">Hard limit — the doctor is only ever placed at these wards.</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-[#c9d8d1] rounded-lg">
                  {activeWards.map(w => (
                    <label key={w.id} className="flex items-center gap-1.5 text-xs px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formWards.includes(w.name)}
                        onChange={e => {
                          setFormWards(e.target.checked
                            ? [...formWards, w.name]
                            : formWards.filter(x => x !== w.name)
                          )
                        }}
                        className="accent-[#0f6e5c]"
                      />
                      {w.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred wards (soft placement bias) */}
              <div>
                <label className="block text-xs text-[#5c6f6a] mb-2">Preferred Wards (bias, optional)</label>
                <p className="text-[11px] text-[#5c6f6a] -mt-1 mb-2">Soft — the generator gives this doctor more duties at these wards when possible, but can still place them elsewhere.</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-[#c9d8d1] rounded-lg">
                  {activeWards.map(w => (
                    <label key={w.id} className="flex items-center gap-1.5 text-xs px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formPreferredWards.includes(w.name)}
                        onChange={e => {
                          setFormPreferredWards(e.target.checked
                            ? [...formPreferredWards, w.name]
                            : formPreferredWards.filter(x => x !== w.name)
                          )
                        }}
                        className="accent-[#0f6e5c]"
                      />
                      {w.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* OPD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#5c6f6a] mb-1">OPD Min</label>
                  <input
                    type="number"
                    value={formOpdMin}
                    onChange={e => setFormOpdMin(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5c6f6a] mb-1">OPD Max (blank = no cap)</label>
                  <input
                    type="number"
                    value={formOpdMax ?? ''}
                    onChange={e => setFormOpdMax(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="No cap"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
                  />
                </div>
              </div>

              {/* Duty dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#5c6f6a] mb-1">Duty Starts</label>
                  <input
                    type="date"
                    value={formStart}
                    onChange={e => setFormStart(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5c6f6a] mb-1">Duty Ends</label>
                  <input
                    type="date"
                    value={formEnd}
                    onChange={e => setFormEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm"
                  />
                </div>
              </div>

              {/* Secret */}
              {isMaster && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formSecret}
                    onChange={e => setFormSecret(e.target.checked)}
                    className="w-4 h-4 accent-[#0f6e5c]"
                  />
                  Add to secret duty team
                </label>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!formName.trim() || formCats.length === 0}
                  className="flex-1 py-3 rounded-lg bg-[#0f6e5c] text-white text-sm font-medium hover:bg-[#0a4f42] disabled:opacity-50"
                >
                  {editingId ? 'Save Changes' : 'Add Doctor'}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
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
