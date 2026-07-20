import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { computeRosterStats } from '@/lib/rosterStats'
import { monthKey } from '@/lib/utils'
import { MONTHS } from '@/types'
import { BarChart3, FileSpreadsheet } from 'lucide-react'

const diffColor = (diff: number) =>
  diff < 0 ? 'text-[#a83a2c]' : diff > 0 ? 'text-[#b5602a]' : 'text-[#5c6f6a]'

export default function SummaryPage() {
  const { doctors, roster, effectiveStations, meta, fridayNightHistory } = useAppStore()
  const [search, setSearch] = useState('')

  const stats = computeRosterStats(roster, effectiveStations)
  const fridayCounts = fridayNightHistory[monthKey(meta.year, meta.month)] || {}
  const activeDoctors = doctors
    .filter(d => d.active)
    .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (!roster) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
            Summary
          </h1>
          <p className="text-sm text-[#5c6f6a] mt-1">Per-doctor totals for the generated roster</p>
        </div>
        <div className="text-center py-16 text-[#5c6f6a]">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No roster generated yet. Go to Generate & Export to build one first.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Summary
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          {MONTHS[meta.month - 1]} {meta.year} — per-doctor totals against target
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search doctors..."
        className="w-full sm:w-72 px-3 py-2.5 rounded-lg border border-[#c9d8d1] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#0f6e5c]"
      />

      <div className="bg-white rounded-xl border border-[#c9d8d1] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-[#eef3f0] text-[#5c6f6a] text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-[#eef3f0]">Doctor</th>
                <th className="text-left px-3 py-2.5 font-medium">Category</th>
                <th className="text-right px-3 py-2.5 font-medium">Assigned</th>
                <th className="text-right px-3 py-2.5 font-medium">Target</th>
                <th className="text-right px-3 py-2.5 font-medium">Diff</th>
                <th className="text-right px-3 py-2.5 font-medium">Nights</th>
                <th className="text-right px-3 py-2.5 font-medium">N-Diff</th>
                <th className="text-right px-3 py-2.5 font-medium">Cath</th>
                <th className="text-right px-3 py-2.5 font-medium">C-Diff</th>
                <th className="text-right px-3 py-2.5 font-medium">OPD</th>
                <th className="text-right px-3 py-2.5 font-medium">OPD range</th>
                <th className="text-right px-3 py-2.5 font-medium">Fri nights</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map(d => {
                const s = stats[d.id] || { assigned: 0, night: 0, cath: 0, opd: 0 }
                const diff = s.assigned - d.target
                const nightDiff = s.night - d.nightTarget
                const cathDiff = s.cath - d.cathQuota
                const opdRange = d.opdMax != null ? `${d.opdMin}–${d.opdMax}` : d.opdMin > 0 ? `${d.opdMin}+` : '—'
                const opdOut = d.opdMax != null ? (s.opd < d.opdMin || s.opd > d.opdMax) : s.opd < d.opdMin
                const friday = fridayCounts[d.id] ?? 0
                return (
                  <tr key={d.id} className="border-t border-[#eef3f0]">
                    <td className="px-3 py-2.5 font-medium text-[#16221f] sticky left-0 bg-white">{d.name}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#5c6f6a]">{d.categories.join('/')}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#16221f]">{s.assigned}</td>
                    <td className="px-3 py-2.5 text-right text-[#5c6f6a]">{d.target}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${diffColor(diff)}`}>{diff > 0 ? '+' : ''}{diff}</td>
                    <td className="px-3 py-2.5 text-right text-[#16221f]">{s.night}<span className="text-[10px] text-[#5c6f6a]"> / {d.nightTarget}</span></td>
                    <td className={`px-3 py-2.5 text-right ${diffColor(nightDiff)}`}>{nightDiff > 0 ? '+' : ''}{nightDiff}</td>
                    <td className="px-3 py-2.5 text-right text-[#5c6f6a]">{d.cathEligible ? `${s.cath} / ${d.cathQuota}` : '—'}</td>
                    <td className={`px-3 py-2.5 text-right ${d.cathEligible ? diffColor(cathDiff) : 'text-[#5c6f6a]'}`}>
                      {d.cathEligible ? `${cathDiff > 0 ? '+' : ''}${cathDiff}` : '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${opdOut ? 'text-[#a83a2c] font-medium' : 'text-[#16221f]'}`}>{s.opd}</td>
                    <td className="px-3 py-2.5 text-right text-[#5c6f6a]">{opdRange}</td>
                    <td className={`px-3 py-2.5 text-right ${friday === 0 ? 'text-[#b5602a] font-medium' : 'text-[#5c6f6a]'}`}>
                      {Object.keys(fridayCounts).length ? friday : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeDoctors.length === 0 && (
        <div className="text-center py-12 text-[#5c6f6a]">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No doctors match your search.</p>
        </div>
      )}

      <p className="text-[11px] text-[#5c6f6a] mt-3">
        Diff columns compare assigned to each target — <span className="text-[#a83a2c]">red</span> = under,
        <span className="text-[#b5602a]"> orange</span> = over. OPD turns red when outside the doctor's range.
        “Fri nights” shows Friday-night duties from the last saved roster (orange when zero); it appears once a roster has been saved.
      </p>
    </div>
  )
}
