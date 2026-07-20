import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Doctor, Ward, Demand, Holiday, Shift, ShiftStations, Settings, RosterMeta } from '@/types'
import { SHIFTS } from '@/types'
import { DEFAULT_WARDS, defaultStations } from '@/store/useAppStore'
import type { Json } from '@/types/database'

// ==================== DOCTORS ====================
export function useDoctors() {
  const qc = useQueryClient()

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('name')
      if (error) throw error
      return (data || []).map((d): Doctor => ({
        id: d.id,
        name: d.name,
        categories: d.categories as Doctor['categories'],
        secret: d.secret,
        allowedWards: d.allowed_wards,
        cathEligible: d.cath_eligible,
        cathQuota: d.cath_quota,
        target: d.target,
        nightTarget: d.night_target,
        opdMin: d.opd_min,
        opdMax: d.opd_max,
        dutyStartDate: d.duty_start_date,
        dutyEndDate: d.duty_end_date,
        active: d.active,
      }))
    },
  })

  const createDoctor = useMutation({
    mutationFn: async (doc: Omit<Doctor, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('doctors')
        .insert({
          name: doc.name,
          categories: doc.categories,
          secret: doc.secret,
          allowed_wards: doc.allowedWards,
          cath_eligible: doc.cathEligible,
          cath_quota: doc.cathQuota,
          target: doc.target,
          night_target: doc.nightTarget,
          opd_min: doc.opdMin,
          opd_max: doc.opdMax,
          duty_start_date: doc.dutyStartDate,
          duty_end_date: doc.dutyEndDate,
          active: doc.active,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  const updateDoctor = useMutation({
    mutationFn: async (doc: Doctor) => {
      const { error } = await supabase
        .from('doctors')
        .update({
          name: doc.name,
          categories: doc.categories,
          secret: doc.secret,
          allowed_wards: doc.allowedWards,
          cath_eligible: doc.cathEligible,
          cath_quota: doc.cathQuota,
          target: doc.target,
          night_target: doc.nightTarget,
          opd_min: doc.opdMin,
          opd_max: doc.opdMax,
          duty_start_date: doc.dutyStartDate,
          duty_end_date: doc.dutyEndDate,
          active: doc.active,
        })
        .eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  const deleteDoctor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doctors').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  return { doctors, isLoading, createDoctor, updateDoctor, deleteDoctor }
}

// ==================== WARDS ====================
export function useWards() {
  const qc = useQueryClient()

  const { data: wards, isLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wards').select('*').order('name')
      if (error) throw error
      return (data || []).map((w): Ward => ({
        id: w.id,
        name: w.name,
        group: w.group_name as Ward['group'],
        active: w.active,
      }))
    },
  })

  const createWard = useMutation({
    mutationFn: async (ward: { name: string; group: string }) => {
      const { data, error } = await supabase.from('wards').insert({
        name: ward.name,
        group_name: ward.group,
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wards'] }),
  })

  const toggleWard = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('wards').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wards'] }),
  })

  const deleteWard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wards'] }),
  })

  return { wards, isLoading, createWard, toggleWard, deleteWard }
}

// ==================== DEMANDS ====================
export function useDemands() {
  const qc = useQueryClient()

  const { data: demands, isLoading } = useQuery({
    queryKey: ['demands'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demands').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map((d): Demand => ({
        id: d.id,
        doctorId: d.doctor_id,
        kind: d.kind as Demand['kind'],
        scope: d.scope as Demand['scope'],
        shift: d.shift as Demand['shift'],
        pair: d.pair as Demand['pair'],
        wardName: d.ward_name,
        dayOfWeek: d.day_of_week,
        date: d.date,
        startDate: d.start_date,
        endDate: d.end_date,
        note: d.note,
      }))
    },
  })

  const createDemand = useMutation({
    mutationFn: async (demand: Omit<Demand, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('demands').insert({
        doctor_id: demand.doctorId,
        kind: demand.kind,
        scope: demand.scope,
        shift: demand.shift,
        pair: demand.pair,
        ward_name: demand.wardName,
        day_of_week: demand.dayOfWeek,
        date: demand.date,
        start_date: demand.startDate,
        end_date: demand.endDate,
        note: demand.note,
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demands'] }),
  })

  const deleteDemand = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('demands').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demands'] }),
  })

  return { demands, isLoading, createDemand, deleteDemand }
}

// ==================== HOLIDAYS ====================
export function useHolidays() {
  const qc = useQueryClient()

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').order('date')
      if (error) throw error
      return (data || []).map((h): Holiday => ({
        id: h.id,
        date: h.date,
        label: h.label,
        year: h.year ?? new Date(h.created_at).getFullYear(),
        month: h.month ?? new Date(h.created_at).getMonth() + 1,
      }))
    },
  })

  const createHoliday = useMutation({
    mutationFn: async (holiday: { date: number; label: string; year: number; month: number }) => {
      const { data, error } = await supabase.from('holidays').insert({
        date: holiday.date,
        label: holiday.label,
        year: holiday.year,
        month: holiday.month,
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })

  const deleteHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })

  return { holidays, isLoading, createHoliday, deleteHoliday }
}

// ==================== STATIONS ====================
export function useStations() {
  const qc = useQueryClient()

  const { data: stationRows, isLoading } = useQuery({
    queryKey: ['stations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stations').select('*').order('label')
      if (error) throw error
      return (data || []).map((s) => ({
        id: s.id,
        label: s.label,
        wards: s.wards,
        needed: s.needed,
        shift: s.shift as Shift,
      }))
    },
  })

  const stations: ShiftStations = { morning: [], evening: [], night: [] }
  ;(stationRows || []).forEach((s) => {
    stations[s.shift].push({ id: s.id, label: s.label, wards: s.wards, needed: s.needed })
  })

  const createStation = useMutation({
    mutationFn: async (station: { label: string; wards: string[]; needed: number; shift: Shift }) => {
      const { data, error } = await supabase.from('stations').insert({
        label: station.label,
        wards: station.wards,
        needed: station.needed,
        shift: station.shift,
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stations'] }),
  })

  const updateStation = useMutation({
    mutationFn: async (station: { id: string; label: string; wards: string[]; needed: number }) => {
      const { error } = await supabase.from('stations').update({
        label: station.label,
        wards: station.wards,
        needed: station.needed,
      }).eq('id', station.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stations'] }),
  })

  const deleteStation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stations'] }),
  })

  return { stations, stationRows, isLoading, createStation, updateStation, deleteStation }
}

// ==================== APP SETTINGS (generic key/value) ====================
export function useAppSetting<T>(key: string, defaultValue: T) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['app_settings', key],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('key', key).maybeSingle()
      if (error) throw error
      return (data?.value as T) ?? defaultValue
    },
  })

  const saveSetting = useMutation({
    mutationFn: async (value: T) => {
      const { error } = await supabase.from('app_settings').upsert(
        { key, value: value as Json, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings', key] }),
  })

  return { value: data ?? defaultValue, isLoading, saveSetting }
}

// ==================== ROSTER SNAPSHOTS ====================
export function useRosterSnapshots() {
  const qc = useQueryClient()

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['roster_snapshots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roster_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const saveSnapshot = useMutation({
    mutationFn: async (payload: {
      year: number
      month: number
      days: number
      roster: Json
      effective_stations?: Json | null
      warnings?: string[]
      notes?: string
      generated_by?: string
    }) => {
      const { data, error } = await supabase.from('roster_snapshots').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster_snapshots'] }),
  })

  return { snapshots, isLoading, saveSnapshot }
}

// ==================== DUTY BANK ====================
export interface DutyBankRow {
  id: string
  month_key: string
  doctor_id: string
  base_target: number
  effective_target: number
  assigned: number
  balance: number
}

export function useDutyBankHistory() {
  const qc = useQueryClient()

  const { data: rows, isLoading } = useQuery({
    queryKey: ['duty_bank'],
    queryFn: async () => {
      const { data, error } = await supabase.from('duty_bank').select('*').order('month_key', { ascending: false })
      if (error) throw error
      return (data || []) as DutyBankRow[]
    },
  })

  const upsertMonth = useMutation({
    mutationFn: async (entries: Omit<DutyBankRow, 'id'>[]) => {
      if (entries.length === 0) return
      const { error } = await supabase.from('duty_bank').upsert(entries, { onConflict: 'month_key,doctor_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty_bank'] }),
  })

  return { rows, isLoading, upsertMonth }
}

// ==================== BACKUP RESTORE ====================
export interface BackupData {
  doctors?: Doctor[]
  wards?: Ward[]
  stations?: ShiftStations
  demands?: Demand[]
  holidays?: Holiday[]
  settings?: Settings
  meta?: RosterMeta
}

export interface RestoreResult {
  counts: { doctors: number; wards: number; stations: number; demands: number; holidays: number }
  settings?: Settings
  meta?: RosterMeta
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_SCOPES = new Set(['weekly', 'date', 'always'])

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id' + Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Keep a valid UUID as-is; replace any other id (e.g. the prototype's "id…") with a fresh UUID. */
const asUuid = (id: string | undefined) => (id && UUID_RE.test(id) ? id : newId())

/**
 * Replaces all shared roster data with the contents of a backup file.
 *
 * This is destructive: it deletes the current doctors, wards, stations,
 * demands, and holidays and re-inserts them from the backup. Every insert
 * payload is built (and IDs normalized to valid UUIDs) BEFORE anything is
 * deleted, so a bad file can't wipe the database and then fail on insert.
 * IDs that are already valid UUIDs are preserved; non-UUID IDs from the older
 * prototype format are regenerated, with demand → doctor references remapped.
 */
export function useRestoreBackup() {
  const qc = useQueryClient()

  return useMutation<RestoreResult, Error, BackupData>({
    mutationFn: async (data: BackupData) => {
      const doctors = data.doctors ?? []
      const wards = data.wards ?? []
      const demands = data.demands ?? []
      const holidays = data.holidays ?? []
      const stationsObj = data.stations ?? { morning: [], evening: [], night: [] }

      if (!Array.isArray(doctors) || !Array.isArray(wards)) {
        throw new Error('This file does not look like a roster backup (missing doctors or wards).')
      }

      // --- Build every insert payload first (nothing is deleted yet) ---

      // Remap doctor ids so demand references follow any regenerated ids.
      const doctorIdMap = new Map<string, string>()
      const doctorRows = doctors.map(d => {
        const id = asUuid(d.id)
        if (d.id) doctorIdMap.set(d.id, id)
        return {
          id,
          name: d.name,
          categories: d.categories ?? [],
          secret: !!d.secret,
          allowed_wards: d.allowedWards ?? [],
          cath_eligible: !!d.cathEligible,
          cath_quota: d.cathQuota ?? 0,
          target: d.target ?? 23,
          night_target: d.nightTarget ?? 6,
          opd_min: d.opdMin ?? 0,
          opd_max: d.opdMax ?? null,
          duty_start_date: d.dutyStartDate ?? null,
          duty_end_date: d.dutyEndDate ?? null,
          active: d.active ?? true,
        }
      })

      const wardRows = wards.map(w => ({
        id: asUuid(w.id),
        name: w.name,
        group_name: w.group,
        active: w.active ?? true,
      }))

      const stationRows = SHIFTS.flatMap(shift =>
        (stationsObj[shift] ?? []).map(s => ({
          id: asUuid(s.id),
          label: s.label,
          wards: s.wards ?? [],
          needed: s.needed ?? 1,
          shift,
        }))
      )

      // Prototype holidays have no year/month; fall back to the backup's month.
      const fallbackYear = data.meta?.year ?? new Date().getFullYear()
      const fallbackMonth = data.meta?.month ?? new Date().getMonth() + 1
      const holidayRows = holidays.map(h => ({
        id: asUuid(h.id),
        date: h.date,
        label: h.label,
        year: h.year ?? fallbackYear,
        month: h.month ?? fallbackMonth,
      }))

      // Only keep demands pointing at a doctor in this backup; default a missing
      // scope (prototype leave demands omit it) to the DB-valid 'date'.
      const demandRows = demands
        .map(dm => {
          const doctor_id = dm.doctorId ? doctorIdMap.get(dm.doctorId) : undefined
          if (!doctor_id) return null
          return {
            id: asUuid(dm.id),
            doctor_id,
            kind: dm.kind,
            scope: VALID_SCOPES.has(dm.scope) ? dm.scope : 'date',
            shift: dm.shift ?? null,
            pair: dm.pair ?? null,
            ward_name: dm.wardName ?? null,
            day_of_week: dm.dayOfWeek ?? null,
            date: dm.date ?? null,
            start_date: dm.startDate ?? null,
            end_date: dm.endDate ?? null,
            note: dm.note ?? null,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      // --- Now delete and re-insert (payloads are ready) ---
      // Demands go first (FK to doctors); the filter `.not('id','is',null)`
      // matches every row so the whole table is cleared.
      const wipe = async (table: 'demands' | 'stations' | 'holidays' | 'doctors' | 'wards') => {
        const { error } = await supabase.from(table).delete().not('id', 'is', null)
        if (error) throw error
      }
      await wipe('demands')
      await wipe('stations')
      await wipe('holidays')
      await wipe('doctors')
      await wipe('wards')

      if (wardRows.length) {
        const { error } = await supabase.from('wards').insert(wardRows)
        if (error) throw error
      }
      if (doctorRows.length) {
        const { error } = await supabase.from('doctors').insert(doctorRows)
        if (error) throw error
      }
      if (stationRows.length) {
        const { error } = await supabase.from('stations').insert(stationRows)
        if (error) throw error
      }
      if (holidayRows.length) {
        const { error } = await supabase.from('holidays').insert(holidayRows)
        if (error) throw error
      }
      if (demandRows.length) {
        const { error } = await supabase.from('demands').insert(demandRows)
        if (error) throw error
      }

      // Letterhead is best-effort: if app_settings blocks the write (RLS), the
      // roster data is still restored, so don't fail the whole operation.
      if (data.settings) {
        await supabase.from('app_settings').upsert(
          {
            key: 'hospital_config',
            value: { name: data.settings.hospitalName, preparedBy: data.settings.preparedByName } as Json,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        )
      }

      return {
        counts: {
          doctors: doctorRows.length,
          wards: wardRows.length,
          stations: stationRows.length,
          demands: demandRows.length,
          holidays: holidayRows.length,
        },
        settings: data.settings,
        meta: data.meta,
      }
    },
    onSuccess: () => {
      ;['doctors', 'wards', 'stations', 'demands', 'holidays', 'app_settings'].forEach(key =>
        qc.invalidateQueries({ queryKey: [key] })
      )
    },
  })
}

// ==================== RESET TO DEFAULTS ====================
/**
 * Wipes all shared roster data and reseeds the default wards and stations,
 * returning the app to a clean baseline. Roster maker passwords, the master
 * password, and the letterhead are intentionally left untouched so a reset
 * cannot lock anyone out or erase branding.
 */
export function useResetAll() {
  const qc = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const wipe = async (
        table: 'demands' | 'duty_bank' | 'roster_snapshots' | 'stations' | 'holidays' | 'doctors' | 'wards'
      ) => {
        const { error } = await supabase.from(table).delete().not('id', 'is', null)
        if (error) throw error
      }
      // Demands and duty_bank reference doctors; delete them first.
      await wipe('demands')
      await wipe('duty_bank')
      await wipe('roster_snapshots')
      await wipe('stations')
      await wipe('holidays')
      await wipe('doctors')
      await wipe('wards')

      const { error: wardErr } = await supabase.from('wards').insert(
        DEFAULT_WARDS.map(w => ({ name: w.name, group_name: w.group, active: true }))
      )
      if (wardErr) throw wardErr

      const stationRows = SHIFTS.flatMap(shift =>
        defaultStations[shift].map(s => ({ label: s.label, wards: s.wards, needed: s.needed, shift }))
      )
      const { error: stationErr } = await supabase.from('stations').insert(stationRows)
      if (stationErr) throw stationErr
    },
    onSuccess: () => {
      ;['doctors', 'wards', 'stations', 'demands', 'holidays', 'duty_bank', 'roster_snapshots'].forEach(key =>
        qc.invalidateQueries({ queryKey: [key] })
      )
    },
  })
}
