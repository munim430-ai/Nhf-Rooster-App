import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Doctor, Ward, Demand, Holiday, Shift, ShiftStations } from '@/types'
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
