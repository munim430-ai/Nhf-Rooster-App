import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Doctor, Ward, WardGroup, ShiftStations, Demand, Holiday,
  Settings, RosterMeta, RosterEntry, EffectiveStations,
  FridayNightHistory, DutyBank, Shortfall, Improvisation
} from '@/types'

export interface AppState {
  doctors: Doctor[]
  wards: Ward[]
  stations: ShiftStations
  demands: Demand[]
  holidays: Holiday[]
  notes: string
  settings: Settings
  meta: RosterMeta
  roster: RosterEntry | null
  effectiveStations: EffectiveStations | null
  warnings: string[]
  shortfalls: Shortfall[]
  improvisations: Improvisation[]
  fridayNightHistory: FridayNightHistory
  dutyBank: DutyBank
  secretUnlocked: boolean
  currentNav: string
  isLoading: boolean
  isAuthenticated: boolean
  authRole: 'master' | 'maker' | null
  makerLabel: string | null
  isOnline: boolean
}

export interface AppActions {
  setDoctors: (doctors: Doctor[]) => void
  setWards: (wards: Ward[]) => void
  setStations: (stations: ShiftStations) => void
  setDemands: (demands: Demand[]) => void
  setHolidays: (holidays: Holiday[]) => void
  setNotes: (notes: string) => void
  setSettings: (settings: Settings) => void
  setMeta: (meta: RosterMeta) => void
  setRoster: (roster: RosterEntry | null) => void
  setEffectiveStations: (es: EffectiveStations | null) => void
  setWarnings: (warnings: string[]) => void
  setShortfalls: (s: Shortfall[]) => void
  setImprovisations: (i: Improvisation[]) => void
  setFridayNightHistory: (h: FridayNightHistory) => void
  setDutyBank: (b: DutyBank) => void
  setSecretUnlocked: (v: boolean) => void
  setCurrentNav: (nav: string) => void
  setIsLoading: (v: boolean) => void
  setAuthenticated: (v: boolean, role?: 'master' | 'maker', label?: string | null) => void
  setIsOnline: (v: boolean) => void
  resetAll: () => void
}

const defaultSettings: Settings = {
  secretPassword: 'MediCat15@',
  hospitalName: 'National Heart Foundation Hospital and Research Institute',
  preparedByName: '',
}

const now = new Date()
const defaultMeta: RosterMeta = {
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  days: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  printDensity: 7,
  generatedAt: null,
}

function uid(): string {
  return 'id' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const defaultStations: ShiftStations = {
  morning: [
    { id: uid(), label: 'Observation', wards: ['Observation'], needed: 2 },
    { id: uid(), label: '3A', wards: ['3A'], needed: 2 },
    { id: uid(), label: '3B', wards: ['3B'], needed: 1 },
    { id: uid(), label: '5A', wards: ['5A'], needed: 1 },
    { id: uid(), label: '5B', wards: ['5B'], needed: 1 },
    { id: uid(), label: '5C', wards: ['5C'], needed: 1 },
    { id: uid(), label: '5D', wards: ['5D'], needed: 1 },
    { id: uid(), label: 'Ward 7', wards: ['7'], needed: 2 },
    { id: uid(), label: 'Ward 9', wards: ['9'], needed: 1 },
    { id: uid(), label: 'Ward 10', wards: ['10'], needed: 1 },
    { id: uid(), label: 'Ward 12', wards: ['12'], needed: 1 },
    { id: uid(), label: 'Cabin', wards: ['Cabin'], needed: 1 },
    { id: uid(), label: 'OPD A', wards: ['OPD A'], needed: 1 },
    { id: uid(), label: 'OPD B', wards: ['OPD B'], needed: 1 },
    { id: uid(), label: 'OPD C', wards: ['OPD C'], needed: 1 },
    { id: uid(), label: 'HTN', wards: ['HTN'], needed: 1 },
    { id: uid(), label: 'DS 15A', wards: ['DS 15A'], needed: 2 },
    { id: uid(), label: 'DS 15B', wards: ['DS 15B'], needed: 1 },
    { id: uid(), label: 'DS 15C', wards: ['DS 15C'], needed: 1 },
    { id: uid(), label: 'DS 9A', wards: ['DS 9A'], needed: 1 },
    { id: uid(), label: 'DS 9B', wards: ['DS 9B'], needed: 1 },
    { id: uid(), label: 'DS 8', wards: ['DS 8'], needed: 1 },
  ],
  evening: [
    { id: uid(), label: 'Observation', wards: ['Observation'], needed: 2 },
    { id: uid(), label: '3A', wards: ['3A'], needed: 2 },
    { id: uid(), label: '3B', wards: ['3B'], needed: 1 },
    { id: uid(), label: '5A & 5C', wards: ['5A','5C'], needed: 1 },
    { id: uid(), label: '5B', wards: ['5B'], needed: 1 },
    { id: uid(), label: '5D', wards: ['5D'], needed: 1 },
    { id: uid(), label: 'Ward 7', wards: ['7'], needed: 2 },
    { id: uid(), label: 'Ward 9 & Cabin', wards: ['9','Cabin'], needed: 1 },
    { id: uid(), label: 'Ward 10', wards: ['10'], needed: 1 },
    { id: uid(), label: 'Ward 12', wards: ['12'], needed: 1 },
    { id: uid(), label: 'OPD A', wards: ['OPD A'], needed: 1 },
    { id: uid(), label: 'OPD B', wards: ['OPD B'], needed: 1 },
    { id: uid(), label: 'OPD C', wards: ['OPD C'], needed: 1 },
    { id: uid(), label: 'OPD (HTN)', wards: ['HTN'], needed: 1 },
    { id: uid(), label: 'DS 15A', wards: ['DS 15A'], needed: 2 },
    { id: uid(), label: 'DS 15B', wards: ['DS 15B'], needed: 1 },
    { id: uid(), label: 'DS 15C', wards: ['DS 15C'], needed: 1 },
    { id: uid(), label: 'DS 9A', wards: ['DS 9A'], needed: 1 },
    { id: uid(), label: 'DS 9B', wards: ['DS 9B'], needed: 1 },
    { id: uid(), label: 'DS 8', wards: ['DS 8'], needed: 1 },
    { id: uid(), label: 'Cath', wards: ['Cath'], needed: 1 },
  ],
  night: [
    { id: uid(), label: 'Observation', wards: ['Observation'], needed: 1 },
    { id: uid(), label: '3A', wards: ['3A'], needed: 1 },
    { id: uid(), label: '3B', wards: ['3B'], needed: 1 },
    { id: uid(), label: '5A & 5B', wards: ['5A','5B'], needed: 1 },
    { id: uid(), label: '5C & 5D', wards: ['5C','5D'], needed: 1 },
    { id: uid(), label: 'Ward 7', wards: ['7'], needed: 2 },
    { id: uid(), label: 'Ward 9 & Cabin', wards: ['9','Cabin'], needed: 1 },
    { id: uid(), label: 'Ward 10 & 12', wards: ['10','12'], needed: 1 },
    { id: uid(), label: 'OPD A', wards: ['OPD A'], needed: 1 },
    { id: uid(), label: 'OPD B', wards: ['OPD B'], needed: 1 },
    { id: uid(), label: 'OPD C', wards: ['OPD C'], needed: 1 },
    { id: uid(), label: 'DS 15A', wards: ['DS 15A'], needed: 1 },
    { id: uid(), label: 'DS 15B', wards: ['DS 15B'], needed: 1 },
    { id: uid(), label: 'DS 15C', wards: ['DS 15C'], needed: 1 },
    { id: uid(), label: 'DS 9A & 9B', wards: ['DS 9A','DS 9B'], needed: 1 },
    { id: uid(), label: 'DS 8', wards: ['DS 8'], needed: 1 },
  ],
}

export const DEFAULT_WARDS: { name: string; group: WardGroup }[] = [
  { name: 'Observation', group: 'General' },
  { name: '3A', group: 'General' },
  { name: '3B', group: 'General' },
  { name: '5A', group: 'General' },
  { name: '5B', group: 'General' },
  { name: '5C', group: 'General' },
  { name: '5D', group: 'General' },
  { name: '7', group: 'General' },
  { name: '9', group: 'General' },
  { name: '10', group: 'General' },
  { name: '12', group: 'General' },
  { name: 'HTN', group: 'General' },
  { name: 'Cabin', group: 'General' },
  { name: 'DS 15A', group: 'DS' },
  { name: 'DS 15B', group: 'DS' },
  { name: 'DS 15C', group: 'DS' },
  { name: 'DS 9A', group: 'DS' },
  { name: 'DS 9B', group: 'DS' },
  { name: 'DS 8', group: 'DS' },
  { name: 'OPD A', group: 'OPD' },
  { name: 'OPD B', group: 'OPD' },
  { name: 'OPD C', group: 'OPD' },
  { name: 'Cath', group: 'Cath' },
]

const initialState: Omit<AppState, keyof AppActions> = {
  doctors: [],
  wards: DEFAULT_WARDS.map(w => ({ id: uid(), name: w.name, group: w.group, active: true })),
  stations: defaultStations,
  demands: [],
  holidays: [],
  notes: '',
  settings: defaultSettings,
  meta: defaultMeta,
  roster: null,
  effectiveStations: null,
  warnings: [],
  shortfalls: [],
  improvisations: [],
  fridayNightHistory: {},
  dutyBank: {},
  secretUnlocked: false,
  currentNav: 'dashboard',
  isLoading: false,
  isAuthenticated: false,
  authRole: null,
  makerLabel: null,
  isOnline: true,
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      ...initialState,
      setDoctors: (doctors) => set({ doctors }),
      setWards: (wards) => set({ wards }),
      setStations: (stations) => set({ stations }),
      setDemands: (demands) => set({ demands }),
      setHolidays: (holidays) => set({ holidays }),
      setNotes: (notes) => set({ notes }),
      setSettings: (settings) => set({ settings }),
      setMeta: (meta) => set({ meta }),
      setRoster: (roster) => set({ roster }),
      setEffectiveStations: (effectiveStations) => set({ effectiveStations }),
      setWarnings: (warnings) => set({ warnings }),
      setShortfalls: (shortfalls) => set({ shortfalls }),
      setImprovisations: (improvisations) => set({ improvisations }),
      setFridayNightHistory: (fridayNightHistory) => set({ fridayNightHistory }),
      setDutyBank: (dutyBank) => set({ dutyBank }),
      setSecretUnlocked: (secretUnlocked) => set({ secretUnlocked }),
      setCurrentNav: (currentNav) => set({ currentNav }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setAuthenticated: (isAuthenticated, authRole, makerLabel) =>
        set({ isAuthenticated, authRole: authRole ?? null, makerLabel: makerLabel ?? null }),
      setIsOnline: (isOnline) => set({ isOnline }),
      resetAll: () => set({ ...initialState, isAuthenticated: false, authRole: null, makerLabel: null }),
    }),
    {
      name: 'nhf-roster-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        meta: state.meta,
        roster: state.roster,
        effectiveStations: state.effectiveStations,
        warnings: state.warnings,
        shortfalls: state.shortfalls,
        improvisations: state.improvisations,
        fridayNightHistory: state.fridayNightHistory,
        dutyBank: state.dutyBank,
        secretUnlocked: state.secretUnlocked,
        currentNav: state.currentNav,
        notes: state.notes,
      }),
    }
  )
)
