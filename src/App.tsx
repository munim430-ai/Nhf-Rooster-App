import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import LoginScreen from '@/components/LoginScreen'
import BottomNav from '@/components/BottomNav'
import Sidebar from '@/components/Sidebar'
import DashboardPage from '@/pages/DashboardPage'
import DoctorsPage from '@/pages/DoctorsPage'
import WardsPage from '@/pages/WardsPage'
import StationsPage from '@/pages/StationsPage'
import DemandsPage from '@/pages/DemandsPage'
import HolidaysPage from '@/pages/HolidaysPage'
import GeneratePage from '@/pages/GeneratePage'
import SummaryPage from '@/pages/SummaryPage'
import DutyBankPage from '@/pages/DutyBankPage'
import NotesPage from '@/pages/NotesPage'
import SettingsPage from '@/pages/SettingsPage'
import { useEffect } from 'react'

const navMap: Record<string, React.FC> = {
  dashboard: DashboardPage,
  doctors: DoctorsPage,
  wards: WardsPage,
  stations: StationsPage,
  demands: DemandsPage,
  holidays: HolidaysPage,
  generate: GeneratePage,
  summary: SummaryPage,
  dutybank: DutyBankPage,
  notes: NotesPage,
  settings: SettingsPage,
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const { currentNav, setCurrentNav } = useAppStore()

  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  const PageComponent = navMap[currentNav] || DashboardPage

  return (
    <div className="flex min-h-screen bg-[#eef3f0]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="max-w-6xl mx-auto p-4 lg:p-6">
          <PageComponent />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </div>
    </div>
  )
}
