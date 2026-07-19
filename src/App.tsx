import React, { useEffect, useRef } from 'react'
import { useAppStore, defaultStations } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import { useDoctors, useWards, useDemands, useHolidays, useStations } from '@/hooks/useData'
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
  const { currentNav, setCurrentNav, setDoctors, setWards, setDemands, setHolidays, setStations } = useAppStore()

  // Load all data from Supabase when authenticated
  const { doctors: dbDoctors } = useDoctors()
  const { wards: dbWards } = useWards()
  const { demands: dbDemands } = useDemands()
  const { holidays: dbHolidays } = useHolidays()
  const { stations: dbStations, stationRows, isLoading: stationsLoading, createStation } = useStations()
  const seededStations = useRef(false)

  useEffect(() => {
    if (dbDoctors) setDoctors(dbDoctors)
  }, [dbDoctors, setDoctors])

  useEffect(() => {
    if (dbWards) setWards(dbWards)
  }, [dbWards, setWards])

  useEffect(() => {
    if (dbDemands) setDemands(dbDemands)
  }, [dbDemands, setDemands])

  useEffect(() => {
    if (dbHolidays) setHolidays(dbHolidays)
  }, [dbHolidays, setHolidays])

  useEffect(() => {
    if (stationRows && stationRows.length > 0) setStations(dbStations)
  }, [stationRows, setStations])

  // One-time seed: if the stations table is empty, populate it from the built-in defaults
  useEffect(() => {
    if (stationsLoading || seededStations.current) return
    if (stationRows && stationRows.length === 0) {
      seededStations.current = true
      const all = [
        ...defaultStations.morning.map(s => ({ ...s, shift: 'morning' as const })),
        ...defaultStations.evening.map(s => ({ ...s, shift: 'evening' as const })),
        ...defaultStations.night.map(s => ({ ...s, shift: 'night' as const })),
      ]
      all.forEach(s => {
        createStation.mutate({ label: s.label, wards: s.wards, needed: s.needed, shift: s.shift })
      })
    }
  }, [stationsLoading, stationRows, createStation])

  useEffect(() => {
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
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="max-w-6xl mx-auto p-4 lg:p-6">
          <PageComponent />
        </div>
      </main>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </div>
    </div>
  )
}
