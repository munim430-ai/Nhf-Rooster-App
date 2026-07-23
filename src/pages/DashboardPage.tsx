import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import {
  Users, Building2, CalendarCheck, CalendarX, FileSpreadsheet,
  AlertTriangle, Shield
} from 'lucide-react'

export default function DashboardPage() {
  const { doctors, wards, demands, holidays, roster, shortfalls, improvisations, meta } = useAppStore()
  const { isMaster, makerLabel } = useAuth()

  const activeDocs = doctors.filter(d => d.active && !d.secret).length
  const secretDocs = doctors.filter(d => d.secret).length
  const activeWards = wards.filter(w => w.active).length

  const cards = [
    { title: 'Doctors', value: activeDocs, sub: secretDocs > 0 ? `${secretDocs} in secret team` : 'active doctors', icon: Users },
    { title: 'Wards', value: activeWards, sub: 'active wards', icon: Building2 },
    { title: 'Demands', value: demands.length, sub: 'standing requests', icon: CalendarCheck },
    { title: 'Holidays', value: holidays.length, sub: 'marked this month', icon: CalendarX },
    { title: 'Roster', value: roster ? `${meta.days} days` : '—', sub: roster ? `Generated ${meta.month}/${meta.year}` : 'Not generated', icon: FileSpreadsheet },
    { title: 'Shortfalls', value: shortfalls.length, sub: shortfalls.length === 0 ? 'All clear' : `${improvisations.length} auto-filled`, icon: AlertTriangle },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
          Dashboard
        </h1>
        <p className="text-sm text-[#5c6f6a] mt-1">Snapshot of your roster setup</p>
      </div>

      {/* Role badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 ${
        isMaster ? 'bg-[#dcefe9] text-[#0f6e5c]' : 'bg-[#f4ecd2] text-[#6b4c19]'
      }`}>
        <Shield className="w-3.5 h-3.5" />
        {isMaster ? 'Master Access — Dr. Alif' : `Roster Maker — ${makerLabel || 'Active'}`}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.title} className="bg-white rounded-xl border border-[#c9d8d1] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-[#5c6f6a] font-medium">{card.title}</span>
                <Icon className="w-4 h-4 text-[#5c6f6a]" />
              </div>
              <div className="text-3xl font-semibold text-[#0a4f42]" style={{ fontFamily: 'var(--font-serif)' }}>
                {card.value}
              </div>
              <div className="text-xs text-[#5c6f6a] mt-1">{card.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Getting started */}
      <div className="bg-white rounded-xl border border-[#c9d8d1] p-5">
        <h2 className="text-sm font-semibold text-[#16221f] mb-4">Getting Started</h2>
        <ol className="space-y-3 text-sm text-[#16221f]">
          {[
            "Add/review your Doctors and their categories (SMO, EMO, MO), and tick who can cover Cath evening duty.",
            "Confirm the Wards list.",
            "Set how many doctors each ward needs per shift in Shift Requirements.",
            "Enter any standing Doctor Demands (days off, specific shift off).",
            "Mark Holidays & Events on the calendar.",
            "Go to Generate & Export to build the month roster and print it as a PDF.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0f6e5c] text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
