import type { RosterEntry, EffectiveStations } from '@/types'

export interface DoctorStats {
  assigned: number
  night: number
  cath: number
  opd: number
}

const OPD_ABC_WARDS = ['OPD A', 'OPD B', 'OPD C']

export function computeRosterStats(
  roster: RosterEntry | null,
  effectiveStations: EffectiveStations | null
): Record<string, DoctorStats> {
  const stats: Record<string, DoctorStats> = {}
  if (!roster || !effectiveStations) return stats

  const ensure = (id: string) => {
    if (!stats[id]) stats[id] = { assigned: 0, night: 0, cath: 0, opd: 0 }
    return stats[id]
  }

  Object.entries(roster).forEach(([day, dayShifts]) => {
    const dayStations = effectiveStations[Number(day)] || {}
    Object.entries(dayShifts).forEach(([shift, stationMap]) => {
      const stationsForShift = dayStations[shift as keyof typeof dayStations] || []
      Object.entries(stationMap || {}).forEach(([stationId, doctorIds]) => {
        const station = stationsForShift.find(s => s.id === stationId)
        ;(doctorIds as string[]).forEach(id => {
          const s = ensure(id)
          s.assigned++
          if (shift === 'night') s.night++
          if (station?.wards.includes('Cath')) s.cath++
          if (station?.wards.some(w => OPD_ABC_WARDS.includes(w))) s.opd++
        })
      })
    })
  })

  return stats
}
