import { useAppStore } from '@/store/useAppStore'
import { MONTHS, SHIFT_LABEL } from '@/types'
import type { Shift } from '@/types'
import { AlertTriangle, Wand2, CheckCircle2, CalendarClock } from 'lucide-react'

const SHIFT_ORDER: Record<Shift, number> = { morning: 0, evening: 1, night: 2 }

export default function ShortfallsPage() {
  const { roster, shortfalls, improvisations, meta } = useAppStore()

  if (!roster) {
    return (
      <div>
        <Header />
        <div className="text-center py-16 text-[#5c6f6a]">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No roster generated yet. Build one in Generate &amp; Export first.</p>
        </div>
      </div>
    )
  }

  const understaffed = shortfalls.filter(s => s.kind !== 'demand')
  const demandGaps = shortfalls.filter(s => s.kind === 'demand')

  const sortSf = <T extends { day: number; shift: Shift }>(a: T, b: T) =>
    a.day - b.day || SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]

  const clean = shortfalls.length === 0 && improvisations.length === 0

  return (
    <div>
      <Header />

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Empty slots" value={understaffed.reduce((n, s) => n + s.missing, 0)} tone="danger" />
        <Stat label="Unmet demands" value={demandGaps.length} tone="danger" />
        <Stat label="Auto-fill improvisations" value={improvisations.length} tone="warm" />
      </div>

      {clean && (
        <div className="bg-[#dcefe9] border border-[#0f6e5c] rounded-xl p-4 flex items-center gap-2 mb-6">
          <CheckCircle2 className="w-5 h-5 text-[#0f6e5c]" />
          <span className="text-sm text-[#0a4f42]">
            The roster meets every rule and demand — no slots were left empty and nothing was improvised.
          </span>
        </div>
      )}

      {/* Unmet demands */}
      {demandGaps.length > 0 && (
        <Section title="Unmet demands" hint="Fixed assignments that couldn't be honoured without breaking a hard rule.">
          <ul className="space-y-1.5">
            {demandGaps.map((s, i) => (
              <li key={i} className="text-xs text-[#7a2c21] bg-[#f7dfd9] border border-[#e0b4ab] rounded-lg px-3 py-2">
                {s.reason}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Empty slots */}
      {understaffed.length > 0 && (
        <Section
          title="Slots left empty (strict)"
          hint="Kept empty on purpose — no doctor could take them without exceeding a target/quota, covering leave, or breaking a rule. Use Auto-fill on the roster to staff them."
        >
          <div className="bg-white rounded-xl border border-[#c9d8d1] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#eef3f0] text-[#5c6f6a] text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-medium">Day</th>
                    <th className="text-left px-4 py-2.5 font-medium">Shift</th>
                    <th className="text-left px-4 py-2.5 font-medium">Station</th>
                    <th className="text-right px-4 py-2.5 font-medium">Missing</th>
                    <th className="text-left px-4 py-2.5 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {[...understaffed].sort(sortSf).map((s, i) => (
                    <tr key={i} className="border-t border-[#eef3f0]">
                      <td className="px-4 py-2.5 font-medium text-[#16221f]">{s.day}</td>
                      <td className="px-4 py-2.5 text-[#5c6f6a]">{SHIFT_LABEL[s.shift].split(' ')[0]}</td>
                      <td className="px-4 py-2.5 text-[#16221f]">{s.stationLabel}</td>
                      <td className="px-4 py-2.5 text-right text-[#a83a2c] font-semibold">{s.missing}</td>
                      <td className="px-4 py-2.5 text-[#5c6f6a]">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {/* Improvisations */}
      {improvisations.length > 0 && (
        <Section
          title="Auto-fill improvisations"
          hint="Placements the app made by bending soft rules when you pressed Auto-fill."
          icon={<Wand2 className="w-4 h-4 text-[#b5602a]" />}
        >
          <div className="bg-white rounded-xl border border-[#c9d8d1] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#eef3f0] text-[#5c6f6a] text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-medium">Day</th>
                    <th className="text-left px-4 py-2.5 font-medium">Shift</th>
                    <th className="text-left px-4 py-2.5 font-medium">Station</th>
                    <th className="text-left px-4 py-2.5 font-medium">Doctor</th>
                    <th className="text-left px-4 py-2.5 font-medium">Rule(s) relaxed</th>
                  </tr>
                </thead>
                <tbody>
                  {[...improvisations].sort(sortSf).map((im, i) => (
                    <tr key={i} className="border-t border-[#eef3f0]">
                      <td className="px-4 py-2.5 font-medium text-[#16221f]">{im.day}</td>
                      <td className="px-4 py-2.5 text-[#5c6f6a]">{SHIFT_LABEL[im.shift].split(' ')[0]}</td>
                      <td className="px-4 py-2.5 text-[#16221f]">{im.stationLabel}</td>
                      <td className="px-4 py-2.5 font-medium text-[#16221f]">{im.doctorName}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {im.reasons.map((r, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f4ecd2] text-[#6b4c19] font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}
    </div>
  )

  function Header() {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Shortfalls
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">
          {roster
            ? `${MONTHS[meta.month - 1]} ${meta.year} — what the strict roster couldn't fill, and any auto-fill improvisations`
            : 'What the roster could not fill under the rules'}
        </p>
      </div>
    )
  }
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warm' }) {
  const color = value === 0 ? 'text-[#16221f]' : tone === 'danger' ? 'text-[#a83a2c]' : 'text-[#b5602a]'
  return (
    <div className="bg-white rounded-xl border border-[#c9d8d1] p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-[#5c6f6a] mt-0.5">{label}</div>
    </div>
  )
}

function Section({ title, hint, icon, children }: { title: string; hint: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        {icon ?? <AlertTriangle className="w-4 h-4 text-[#a83a2c]" />}
        <h2 className="text-sm font-semibold text-[#16221f]">{title}</h2>
      </div>
      <p className="text-xs text-[#5c6f6a] mb-3">{hint}</p>
      {children}
    </div>
  )
}
