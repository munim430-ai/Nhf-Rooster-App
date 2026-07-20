import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useDoctors } from '@/hooks/useData'
import { computeRosterStats } from '@/lib/rosterStats'
import type { Doctor, Category } from '@/types'
import { HeartPulse, Search } from 'lucide-react'

const categoryBadge = (cat: Category) => {
  const colors: Record<Category, string> = {
    SMO: 'bg-[#e6d9c3] text-[#6b4c19]',
    EMO: 'bg-[#dde9f2] text-[#264a72]',
    MO: 'bg-[#dcefe9] text-[#0f6e5c]',
    'First Man': 'bg-[#f4d9df] text-[#7a2c42]',
  }
  return (
    <span key={cat} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${colors[cat]}`}>
      {cat}
    </span>
  )
}

export default function CathLabPage() {
  const { doctors, roster, effectiveStations, secretUnlocked } = useAppStore()
  const { updateDoctor } = useDoctors()

  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const stats = computeRosterStats(roster, effectiveStations)
  const canSee = (d: Doctor) => d.active && (!d.secret || secretUnlocked)

  const eligible = doctors.filter(d => canSee(d) && d.cathEligible)
  const visible = doctors
    .filter(canSee)
    .filter(d => showAll || d.cathEligible)
    .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.cathEligible) - Number(a.cathEligible) || a.name.localeCompare(b.name))

  const toggleEligible = (d: Doctor) => updateDoctor.mutate({ ...d, cathEligible: !d.cathEligible })
  const setQuota = (d: Doctor, q: number) => updateDoctor.mutate({ ...d, cathQuota: Math.max(0, q) })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Cath Lab
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          Doctors eligible for Cath Lab duty — only these are scheduled to the Cath Lab station
        </p>
      </div>

      {/* Count card */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-4 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#e3e1f2] flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-[#4a3b7a]" />
        </div>
        <div>
          <div className="text-xl font-semibold text-[#16221f]">{eligible.length}</div>
          <div className="text-xs text-[#5c6f6a]">Cath-eligible doctor{eligible.length === 1 ? '' : 's'}</div>
        </div>
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
        <button
          onClick={() => setShowAll(v => !v)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${
            showAll
              ? 'bg-[#0f6e5c] text-white border-[#0f6e5c]'
              : 'bg-white text-[#5c6f6a] border-[#c9d8d1] hover:border-[#0f6e5c]'
          }`}
        >
          {showAll ? 'Showing all doctors' : 'Eligible only'}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-[#5c6f6a]">
          <HeartPulse className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {showAll ? 'No doctors match your search.' : 'No Cath-eligible doctors yet. Tap “Eligible only” off to add some.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#c9d8d1] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#eef3f0] text-[#5c6f6a] text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-medium">Eligible</th>
                  <th className="text-left px-4 py-2.5 font-medium">Doctor</th>
                  <th className="text-right px-4 py-2.5 font-medium">Monthly quota</th>
                  {roster && <th className="text-right px-4 py-2.5 font-medium">Assigned</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(d => {
                  const cath = stats[d.id]?.cath ?? 0
                  const over = d.cathEligible && cath > d.cathQuota
                  return (
                    <tr key={d.id} className={`border-t border-[#eef3f0] ${d.cathEligible ? '' : 'opacity-70'}`}>
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={d.cathEligible}
                          onChange={() => toggleEligible(d)}
                          className="w-4 h-4 accent-[#0f6e5c]"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-[#16221f]">{d.name}</span>
                        {d.secret && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#2c2c2c] text-[#f4d35e] font-medium">SECRET</span>
                        )}
                        <span className="ml-2 inline-flex gap-1 align-middle">{d.categories.map(categoryBadge)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={d.cathQuota}
                          disabled={!d.cathEligible}
                          onChange={e => setQuota(d, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded-lg border border-[#c9d8d1] text-sm text-right disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
                        />
                      </td>
                      {roster && (
                        <td className="px-4 py-2.5 text-right">
                          {d.cathEligible ? (
                            <span className={over ? 'text-[#a83a2c] font-semibold' : 'text-[#16221f]'}>
                              {cath}<span className="text-[10px] text-[#5c6f6a]"> / {d.cathQuota}</span>
                            </span>
                          ) : (
                            <span className="text-[#5c6f6a]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#5c6f6a] mt-3">
        Tick a doctor to add them to the Cath Lab team; the monthly quota caps how many Cath duties the
        generator gives them. {roster && 'Assigned turns red when it exceeds the quota.'}
      </p>
    </div>
  )
}
