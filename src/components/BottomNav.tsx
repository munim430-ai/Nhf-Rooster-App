import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import {
  LayoutDashboard, Users, HeartPulse, Building2, ClipboardList, CalendarCheck,
  CalendarX, FileSpreadsheet, AlertTriangle, BarChart3, PiggyBank, StickyNote,
  Settings, MoreHorizontal, X,
} from 'lucide-react'

// Full section list (mirrors the desktop sidebar) shown in the "More" sheet.
const allNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'doctors', label: 'Doctors', icon: Users },
  { id: 'cathlab', label: 'Cath Lab', icon: HeartPulse },
  { id: 'wards', label: 'Wards', icon: Building2 },
  { id: 'stations', label: 'Shift Requirements', icon: ClipboardList },
  { id: 'demands', label: 'Demands', icon: CalendarCheck },
  { id: 'holidays', label: 'Holidays', icon: CalendarX },
  { id: 'generate', label: 'Generate & Export', icon: FileSpreadsheet },
  { id: 'shortfalls', label: 'Shortfalls', icon: AlertTriangle },
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'dutybank', label: 'Duty Bank', icon: PiggyBank },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// The four quick-access tabs always visible in the bottom bar.
const primaryIds = ['dashboard', 'doctors', 'generate', 'summary']
const bottomBar = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'doctors', label: 'Doctors', icon: Users },
  { id: 'generate', label: 'Roster', icon: FileSpreadsheet },
  { id: 'summary', label: 'Summary', icon: BarChart3 },
]

export default function BottomNav() {
  const { currentNav, setCurrentNav } = useAppStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const moreActive = !primaryIds.includes(currentNav)

  const go = (id: string) => {
    setCurrentNav(id)
    setMenuOpen(false)
  }

  return (
    <>
      {/* Full-section sheet opened from "More" */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-6 safe-area-pb"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#16221f]">All sections</span>
              <button onClick={() => setMenuOpen(false)} className="text-[#5c6f6a] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {allNav.map(item => {
                const Icon = item.icon
                const active = currentNav === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 border ${
                      active
                        ? 'bg-[#dcefe9] border-[#0f6e5c] text-[#0f6e5c]'
                        : 'bg-[#eef3f0] border-transparent text-[#5c6f6a]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white border-t border-[#c9d8d1] safe-area-pb">
        <div className="flex items-center justify-around">
          {bottomBar.map(item => {
            const Icon = item.icon
            const active = currentNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`flex flex-col items-center justify-center py-2 px-3 min-w-[60px] ${
                  active ? 'text-[#0f6e5c]' : 'text-[#5c6f6a]'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
              </button>
            )
          })}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={`flex flex-col items-center justify-center py-2 px-3 min-w-[60px] ${
              moreActive || menuOpen ? 'text-[#0f6e5c]' : 'text-[#5c6f6a]'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={moreActive || menuOpen ? 2.5 : 1.5} />
            <span className="text-[10px] mt-0.5 font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
