import { useAppStore } from '@/store/useAppStore'
import {
  LayoutDashboard, Users, FileSpreadsheet, BarChart3, Settings
} from 'lucide-react'

const mobileNavItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'doctors', label: 'Doctors', icon: Users },
  { id: 'generate', label: 'Roster', icon: FileSpreadsheet },
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'settings', label: 'More', icon: Settings },
]

export default function BottomNav() {
  const { currentNav, setCurrentNav } = useAppStore()

  return (
    <nav className="bg-white border-t border-[#c9d8d1] safe-area-pb">
      <div className="flex items-center justify-around">
        {mobileNavItems.map(item => {
          const Icon = item.icon
          const active = currentNav === item.id
          return (
            <button
              key={item.id}
              onClick={() => setCurrentNav(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 min-w-[64px] ${
                active ? 'text-[#0f6e5c]' : 'text-[#5c6f6a]'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
