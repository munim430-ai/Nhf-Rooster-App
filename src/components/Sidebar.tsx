import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Users, HeartPulse, Building2, ClipboardList, CalendarCheck,
  CalendarX, FileSpreadsheet, BarChart3, PiggyBank, StickyNote,
  Settings, LogOut, Heart
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'doctors', label: 'Doctors', icon: Users },
  { id: 'cathlab', label: 'Cath Lab', icon: HeartPulse },
  { id: 'wards', label: 'Wards', icon: Building2 },
  { id: 'stations', label: 'Shift Requirements', icon: ClipboardList },
  { id: 'demands', label: 'Demands', icon: CalendarCheck },
  { id: 'holidays', label: 'Holidays', icon: CalendarX },
  { id: 'generate', label: 'Generate & Export', icon: FileSpreadsheet },
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'dutybank', label: 'Duty Bank', icon: PiggyBank },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { currentNav, setCurrentNav } = useAppStore()
  const { logout, isMaster, makerLabel } = useAuth()

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col bg-[#0a4f42] text-[#eaf3ef]">
      {/* Brand */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-white" />
          <div>
            <div className="font-semibold text-sm text-white leading-tight">NHF&RI Duty Roster</div>
            <div className="text-[10px] text-[#a9c9bf] mt-0.5">Developed by Dr. Alif</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          const active = currentNav === item.id
          return (
            <button
              key={item.id}
              onClick={() => setCurrentNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#0f6e5c] text-white font-medium'
                  : 'text-[#dcece5] hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-[#7fa89b] mb-2">
          {isMaster ? 'Master Access' : makerLabel || 'Roster Maker'}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-[#dcece5] hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
