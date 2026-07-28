import type {
  Doctor, Ward, ShiftStations, Demand, Holiday, RosterEntry,
  EffectiveStations, Shift, Station, Category, Shortfall, Improvisation
} from '@/types'
import {
  SHIFTS, HOLIDAY_CLOSED_WARDS, FIRST_MAN_PRIORITY_WARDS,
  SLOT_COMPOSITION, WARD_DISPLAY_PRIORITY
} from '@/types'
import { isHolidayDay, monthKey } from '@/lib/utils'

export interface GenerationResult {
  roster: RosterEntry
  effectiveStations: EffectiveStations
  warnings: string[]
  shortfalls: Shortfall[]
  improvisations: Improvisation[]
  assignedCount: Record<string, number>
  nightCount: Record<string, number>
  cathCount: Record<string, number>
  opdCount: Record<string, number>
  fridayNightCount: Record<string, number>
  leaveOverrides: Array<{ day: number; shift: Shift; doctorId: string }>
  /** Monthly duty cap actually used per doctor (base target minus duty-bank owed minus casual-leave reduction). */
  effectiveTargets: Record<string, number>
  /** Casual-leave days counted this month per doctor. */
  casualLeaveDays: Record<string, number>
}

// Casual leave lowers a doctor's monthly duty cap (nights are NOT reduced):
//   1–2 CL days → −1 duty, 3–4 days → −2 duties, 5+ days → −3 duties.
export function casualLeaveDutyReduction(clDays: number): number {
  if (clDays <= 0) return 0
  if (clDays <= 2) return 1
  if (clDays <= 4) return 2
  return 3
}

export interface GenerateOptions {
  /**
   * When false (default), only place doctors who satisfy every rule, quota and
   * target — leaving slots empty otherwise (recorded as shortfalls). When true,
   * fill the remaining gaps by relaxing soft rules, recording each as an
   * improvisation.
   */
  autoFill?: boolean
  /**
   * First day of the month (inclusive) to generate. Defaults to 1. Days outside
   * [startDay, endDay] are taken from baseRoster (if given) and left untouched.
   */
  startDay?: number
  /** Last day of the month (inclusive) to generate. Defaults to `days`. */
  endDay?: number
  /**
   * An existing (possibly partial) roster to build on. Duties outside the
   * generated day range are always kept. Inside the range they are kept when
   * `preserveExisting` is true, otherwise the range is regenerated from scratch.
   * Either way, every existing duty counts toward monthly targets, quotas, and
   * the night-rest / one-shift-per-day rules.
   */
  baseRoster?: RosterEntry
  /** Effective stations paired with baseRoster — used to read ward info for existing duties. */
  baseEffectiveStations?: EffectiveStations
  /**
   * When true, keep the existing in-range duties and only fill the empty slots
   * ("continue / complete a partial roster"). When false (default), regenerate
   * the in-range days from scratch.
   */
  preserveExisting?: boolean
  /**
   * When true, build only the effective-stations scaffold and an empty roster —
   * no automatic assignment at all — so the roster can be filled entirely by
   * hand (manual entry).
   */
  scaffoldOnly?: boolean
  /**
   * Doctors whose schedule is user-entered and considered complete: the
   * generator never adds a new duty to them (their existing duties are still
   * kept via baseRoster, and never removed). Used so "Complete"/"Auto-fill"
   * leaves hand-entered doctors untouched.
   */
  frozenDoctorIds?: string[]
  /**
   * Wards reserved for manual entry: a station whose wards are ALL in this set
   * is never auto-filled (existing/user duties there are still kept). Used to
   * leave e.g. Observation / 3A / OPD / HTN empty for hand-entered EMO/SMO/
   * First-Man duties.
   */
  reservedWards?: string[]
  /**
   * When true, the generator only auto-assigns plain MO doctors (no SMO / EMO /
   * First Man), except a Cath station may take any Cath-eligible doctor.
   * Existing/user duties are unaffected.
   */
  autoAssignMoOnly?: boolean
  /**
   * Order in which the three shifts are filled each day (default night →
   * morning → evening). E.g. ['night','evening','morning'] fills night
   * requirements first, then evening, then morning.
   */
  shiftFillOrder?: Shift[]
}

export function generateRoster(
  doctors: Doctor[],
  stations: ShiftStations,
  demands: Demand[],
  holidays: Holiday[],
  year: number,
  month: number,
  days: number,
  fridayNightHistory: Record<string, Record<string, number>>,
  dutyBank: Record<string, Record<string, { baseTarget: number; effectiveTarget: number; assigned: number; balance: number }>>,
  options: GenerateOptions = {}
): GenerationResult {
  const autoFill = options.autoFill ?? false
  const scaffoldOnly = options.scaffoldOnly ?? false
  const preserveExisting = options.preserveExisting ?? false
  const baseRoster = options.baseRoster
  const baseEffectiveStations = options.baseEffectiveStations
  const startDay = Math.max(1, options.startDay ?? 1)
  const endDay = Math.min(days, options.endDay ?? days)
  // User-entered doctors that must never receive a new duty (their input is complete).
  const frozenDoctorIds = new Set(options.frozenDoctorIds || [])
  const reservedWards = new Set(options.reservedWards || [])
  const autoAssignMoOnly = options.autoAssignMoOnly ?? false
  // Night is placed first, then the day shifts (see the main loop). The same
  // order is used when replaying existing duties so streak/rest state matches.
  const SHIFT_ORDER: Shift[] = ['night', 'morning', 'evening']
  // Order the shifts are FILLED each day (may differ from the accounting order).
  const shiftFillOrder: Shift[] = options.shiftFillOrder && options.shiftFillOrder.length === 3
    ? options.shiftFillOrder
    : SHIFT_ORDER
  const activeDoctors = doctors.filter(d => d.active)
  const assignedCount: Record<string, number> = {}
  const nightCount: Record<string, number> = {}
  const cathCount: Record<string, number> = {}
  const opdCount: Record<string, number> = {}
  const fridayNightCount: Record<string, number> = {}
  const obsCount: Record<string, number> = {}
  const threeACount: Record<string, number> = {}
  const ward7Count: Record<string, number> = {}
  // Per-doctor count of each shift type, used to spread morning/evening/night
  // evenly among EMOs.
  const shiftTypeCount: Record<string, Record<Shift, number>> = {}
  const leaveOverrides: Array<{ day: number; shift: Shift; doctorId: string }> = []

  // Wards an SMO may be placed at (hard restriction). SMO is prioritised to 3A.
  const SMO_WARDS = ['3A', '7', 'OPD A', 'OPD B', 'OPD C', 'DS 15A']

  activeDoctors.forEach(d => {
    assignedCount[d.id] = 0
    nightCount[d.id] = 0
    cathCount[d.id] = 0
    opdCount[d.id] = 0
    fridayNightCount[d.id] = 0
    obsCount[d.id] = 0
    threeACount[d.id] = 0
    ward7Count[d.id] = 0
    shiftTypeCount[d.id] = { morning: 0, evening: 0, night: 0 }
  })

  // Duty bank: reduce targets for doctors who worked overtime last month
  const prevM = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const prevMonthBank = dutyBank[monthKey(prevM.y, prevM.m)] || {}
  const effectiveTargets: Record<string, number> = {}
  activeDoctors.forEach(d => {
    const prevBalance = prevMonthBank[d.id]?.balance || 0
    const owedReduction = prevBalance > 0 ? prevBalance : 0
    effectiveTargets[d.id] = Math.max(0, d.target - owedReduction)
  })

  // Friday night exemption from last month
  const prevMonthFridayCounts = fridayNightHistory[monthKey(prevM.y, prevM.m)] || {}
  const exemptFromFriday = new Set(
    Object.keys(prevMonthFridayCounts).filter(id => prevMonthFridayCounts[id] > 0)
  )

  const lastNightDay: Record<string, number> = {}
  const lastDayWorked: Record<string, number> = {}
  const lastShiftWorked: Record<string, Shift | undefined> = {}
  const sameShiftStreak: Record<string, number> = {}
  // Last day each doctor worked a given ward, used to spread a ward across
  // doctors and stop anyone doing the same ward day after day.
  const wardLastDay: Record<string, Record<string, number>> = {}
  function markWard(id: string, day: number, station: Station) {
    const m = wardLastDay[id] || (wardLastDay[id] = {})
    station.wards.forEach(w => { m[w] = day })
  }
  // Days since a doctor last worked any of this station's wards (large = long
  // ago / never). Bigger is preferred so recent repeats are pushed down.
  function wardRecencyGap(id: string, station: Station, day: number): number {
    const m = wardLastDay[id]
    if (!m) return 999
    let last = -999
    station.wards.forEach(w => { if (m[w] !== undefined && m[w] > last) last = m[w] })
    return last < 0 ? 999 : day - last
  }

  const roster: RosterEntry = {}
  const effectiveStations: EffectiveStations = {}
  const warnings: string[] = []
  const shortfalls: Shortfall[] = []
  const improvisations: Improvisation[] = []

  // Index demands by doctor
  const demandsByDoctor: Record<string, Demand[]> = {}
  demands.forEach(dem => {
    demandsByDoctor[dem.doctorId] = demandsByDoctor[dem.doctorId] || []
    demandsByDoctor[dem.doctorId].push(dem)
  })
  const doctorById: Record<string, Doctor> = {}
  activeDoctors.forEach(d => { doctorById[d.id] = d })

  // Casual leave: count each doctor's leave days this month and lower their
  // monthly duty cap accordingly (HARD — the cap is never exceeded; nights are
  // left unchanged).
  const casualLeaveDays: Record<string, number> = {}
  activeDoctors.forEach(d => {
    const leaves = (demandsByDoctor[d.id] || []).filter(dem => dem.kind === 'leave')
    let n = 0
    if (leaves.length) {
      for (let day = 1; day <= days; day++) {
        const isoDay = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (leaves.some(dem => isoDay >= (dem.startDate || '') && isoDay <= (dem.endDate || ''))) n++
      }
    }
    casualLeaveDays[d.id] = n
    effectiveTargets[d.id] = Math.max(0, effectiveTargets[d.id] - casualLeaveDutyReduction(n))
  })

  const OPD_ABC_WARDS = ['OPD A', 'OPD B', 'OPD C']
  function isOpdStation(station: Station): boolean {
    return station.wards.some(w => OPD_ABC_WARDS.includes(w))
  }

  // HARD: the combined Ward 9 + Cabin NIGHT duty is male-only — female doctors
  // are never placed there at night. (Doctors with no gender set are treated as
  // unspecified and remain eligible until marked.) The caller also checks the
  // shift is night; this only identifies the 9+Cabin station.
  function is9CabinStation(station: Station): boolean {
    return station.wards.includes('9') && station.wards.includes('Cabin')
  }

  // HARD: Observation is male-only — female doctors are never placed there (any
  // shift). Doctors with no gender set are treated as unspecified and stay
  // eligible until marked.
  function isObservationStation(station: Station): boolean {
    return station.wards.includes('Observation')
  }

  function isFirstMan(d: Doctor): boolean {
    return d.categories.includes('First Man')
  }
  function isSMO(d: Doctor): boolean {
    return d.categories.includes('SMO')
  }
  function isEMO(d: Doctor): boolean {
    return d.categories.includes('EMO')
  }
  function isResident(d: Doctor): boolean {
    return d.categories.includes('Resident')
  }
  // A plain MO — not SMO/EMO/First Man.
  function isPureMO(d: Doctor): boolean {
    return d.categories.includes('MO') && !isSMO(d) && !isEMO(d) && !isFirstMan(d)
  }
  // A station reserved for manual entry — all its wards are in reservedWards.
  function isReservedStation(station: Station): boolean {
    return reservedWards.size > 0 && station.wards.length > 0 && station.wards.every(w => reservedWards.has(w))
  }
  // May this doctor be AUTO-assigned to this station under the MO-only policy?
  function autoAssignable(d: Doctor, station: Station): boolean {
    if (!autoAssignMoOnly) return true
    if (station.wards.includes('Cath') && d.cathEligible) return true
    return isPureMO(d)
  }

  // Accounting helpers, shared between fresh placement (assignOne), the replay
  // of existing duties (continue/complete), and the out-of-range seed pass.
  // `accountCumulative` updates the month-total counters that drive targets,
  // quotas and balancing; `accountSequential` updates the day-ordered state that
  // drives night-rest, pacing and same-shift streaks.
  function accountCumulative(d: Doctor, shift: Shift, station: Station, weekday: number) {
    assignedCount[d.id]++
    shiftTypeCount[d.id][shift]++
    if (shift === 'night') nightCount[d.id]++
    if (station.wards.includes('Cath')) cathCount[d.id]++
    if (isOpdStation(station)) opdCount[d.id]++
    if (station.wards.includes('Observation')) obsCount[d.id]++
    if (station.wards.includes('3A') || station.wards.includes('DS 15A')) threeACount[d.id]++
    if (station.wards.includes('7')) ward7Count[d.id]++
    if (shift === 'night' && weekday === 5) fridayNightCount[d.id]++
  }
  function accountSequential(d: Doctor, day: number, shift: Shift) {
    if (lastShiftWorked[d.id] === shift && lastDayWorked[d.id] !== undefined) {
      sameShiftStreak[d.id] = (sameShiftStreak[d.id] || 1) + 1
    } else {
      sameShiftStreak[d.id] = 1
    }
    lastShiftWorked[d.id] = shift
    lastDayWorked[d.id] = day
    if (shift === 'night') lastNightDay[d.id] = day
  }

  function seniorConflict(d: Doctor, chosenSoFar: Doctor[]): boolean {
    const dFM = isFirstMan(d), dSMO = isSMO(d)
    if (!dFM && !dSMO) return false
    return chosenSoFar.some(c => {
      const cFM = isFirstMan(c), cSMO = isSMO(c)
      if (dFM && cFM) return true
      if (dFM && cSMO) return true
      if (dSMO && cFM) return true
      return false
    })
  }

  function pickAvoidingSeniorConflict(pool: Doctor[], needed: number, startingChosen: Doctor[] = []): Doctor[] {
    const chosen = [...startingChosen]
    const remaining = [...pool]
    while (chosen.length < needed && remaining.length) {
      const idx = remaining.findIndex(d => !seniorConflict(d, chosen))
      if (idx === -1) break
      chosen.push(remaining[idx])
      remaining.splice(idx, 1)
    }
    return chosen
  }

  function isOff(doctorId: string, day: number, weekday: number, shift: Shift): boolean {
    const isoDay = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const doc = doctorById[doctorId]
    if (doc) {
      if (doc.dutyStartDate && isoDay < doc.dutyStartDate) return true
      if (doc.dutyEndDate && isoDay > doc.dutyEndDate) return true
    }
    const list = demandsByDoctor[doctorId]
    if (!list) return false
    return list.some(dem => {
      if (dem.kind === 'double' || dem.kind === 'assign' || dem.kind === 'single' || dem.kind === 'leave') return false
      if (dem.shift && dem.shift !== shift) return false
      if (dem.scope === 'weekly') return dem.dayOfWeek === weekday
      if (dem.scope === 'date') return dem.date === day
      return false
    })
  }

  function isOnLeave(doctorId: string, day: number): boolean {
    const list = demandsByDoctor[doctorId]
    if (!list) return false
    const isoDay = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return list.some(dem => dem.kind === 'leave' && isoDay >= (dem.startDate || '') && isoDay <= (dem.endDate || ''))
  }

  // Which double-duty pairings a doctor has requested for a day. A doctor may
  // demand both morning+evening AND evening+night — then either double is
  // honoured (M+E on some days, E+N on others), so both `me` and `en` are true.
  function doublePairFlags(doctorId: string, day: number, weekday: number): { me: boolean; en: boolean } {
    const list = demandsByDoctor[doctorId]
    if (!list) return { me: false, en: false }
    const scopeMatch = (dem: Demand) =>
      dem.scope === 'always' ? true : dem.scope === 'weekly' ? dem.dayOfWeek === weekday : dem.scope === 'date' ? dem.date === day : false
    // A single-duty demand overrides: no double duty at all that day.
    if (list.some(dem => dem.kind === 'single' && scopeMatch(dem))) return { me: false, en: false }
    let me = false, en = false
    list.forEach(dem => {
      if (dem.kind !== 'double' || !scopeMatch(dem)) return
      if ((dem.pair || 'ME') === 'EN') en = true
      else me = true
    })
    return { me, en }
  }

  // Representative single pair, for the ordering heuristic (truthy = has a double).
  function doubleDutyPair(doctorId: string, day: number, weekday: number): 'ME' | 'EN' | null {
    const { me, en } = doublePairFlags(doctorId, day, weekday)
    return me ? 'ME' : en ? 'EN' : null
  }

  // Which soft rule(s) had to be relaxed to place this doctor here (for the
  // Shortfalls log). Evaluated against the doctor's state before assignment.
  function relaxReasons(d: Doctor, station: Station, shift: Shift, day: number, weekday: number): string[] {
    const r: string[] = []
    // Note: monthly target, night target, OPD cap and ward restrictions are HARD
    // rules and are never relaxed, so they never appear here.
    if (station.wards.includes('Cath') && cathCount[d.id] >= d.cathQuota) r.push('over Cath quota')
    if (isOnLeave(d.id, day)) r.push('covering casual leave')
    if (shift === 'night' && weekday === 5 && exemptFromFriday.has(d.id)) r.push('repeat Friday night (rotation)')
    if (lastShiftWorked[d.id] === shift && (sameShiftStreak[d.id] || 0) >= 3) r.push('4th+ same shift in a row')
    if (station.wards.includes('7') && isSMO(d) && threeACount[d.id] < 4) r.push('reserve SMO used on Ward 7')
    if (lastDayWorked[d.id] !== undefined) {
      const effTarget = effectiveTargets[d.id] || d.target
      const pace = days / Math.max(1, effTarget)
      const minGap = Math.max(1, Math.floor(pace) - 1)
      if (day - lastDayWorked[d.id] < minGap) r.push('scheduled tighter than pacing')
    }
    const rDbl = doublePairFlags(d.id, day, weekday)
    if (shift === 'morning' && rDbl.en && !rDbl.me) r.push('morning despite evening+night request')
    if (shift === 'night' && rDbl.me && !rDbl.en) r.push('night despite morning+evening request')
    if (isObservationStation(station) && isEMO(d)) {
      const here = roster[day]?.[shift]?.[station.id] || []
      if (here.some(id => doctorById[id] && isEMO(doctorById[id]))) r.push('two EMOs together in Observation')
    }
    if (r.length === 0) r.push('relaxed a soft placement rule')
    return r
  }

  // Cache static eligible counts
  const staticEligibleCountCache: Record<string, number> = {}
  function staticEligibleCount(station: Station): number {
    const key = [...station.wards].sort().join('|')
    if (staticEligibleCountCache[key] !== undefined) return staticEligibleCountCache[key]
    const count = activeDoctors.filter(d => {
      if (station.wards.includes('Cath') && !d.cathEligible) return false
      if (isObservationStation(station) && d.gender === 'female') return false
      if (isSMO(d) && !station.wards.some(w => SMO_WARDS.includes(w))) return false
      if (isFirstMan(d) && !isEMO(d) && !station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w))) return false
      if (isFirstMan(d) && isEMO(d) && !station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w)) && !station.wards.includes('Observation')) return false
      if (d.allowedWards.length > 0 && !station.wards.some(w => d.allowedWards.includes(w))) return false
      return true
    }).length
    staticEligibleCountCache[key] = count
    return count
  }

  function holidayAdjustedStations(shift: Shift, isHoliday: boolean): Station[] {
    const shiftStations = stations[shift]
    if (!isHoliday) return shiftStations.map(s => ({ ...s }))
    const list: Station[] = []
    shiftStations.forEach(s => {
      const remaining = s.wards.filter(w => !HOLIDAY_CLOSED_WARDS.includes(w))
      if (remaining.length === 0) return
      let needed = s.needed
      if (shift !== 'night') {
        if (remaining.includes('3A')) needed = Math.min(needed, 1)
        if (remaining.includes('DS 15A')) needed = Math.min(needed, 1)
      }
      list.push({ ...s, wards: remaining, needed })
    })
    if (shift === 'morning') {
      const hasSeparate9 = list.some(s => s.wards.length === 1 && s.wards[0] === '9')
      const hasSeparateCabin = list.some(s => s.wards.length === 1 && s.wards[0] === 'Cabin')
      if (hasSeparate9 && hasSeparateCabin) {
        const filtered = list.filter(s => !(s.wards.length === 1 && ['9', 'Cabin'].includes(s.wards[0])))
        filtered.push({ id: 'holiday-merge-9-cabin-morning', label: 'Ward 9 & Cabin (Holiday)', wards: ['9', 'Cabin'], needed: 1 })
        return filtered
      }
    }
    return list
  }

  // Carry existing duties (and their stations) into this generation. Days
  // outside the generated range are left exactly as they were; in-range days
  // are re-inserted per shift below when preserveExisting is set.
  if (baseRoster) {
    Object.keys(baseRoster).forEach(dk => {
      const dayNum = Number(dk)
      roster[dayNum] = {}
      SHIFTS.forEach(sh => {
        const cell = baseRoster[dayNum]?.[sh]
        if (!cell) return
        const copy: Record<string, string[]> = {}
        Object.keys(cell).forEach(st => { copy[st] = [...cell[st]] })
        roster[dayNum][sh] = copy
      })
    })
  }
  if (baseEffectiveStations) {
    Object.keys(baseEffectiveStations).forEach(dk => {
      const dayNum = Number(dk)
      effectiveStations[dayNum] = {}
      SHIFTS.forEach(sh => {
        const list = baseEffectiveStations[dayNum]?.[sh]
        if (list) effectiveStations[dayNum][sh] = list.map(s => ({ ...s, wards: [...s.wards] }))
      })
    })
  }

  // In preserve/complete mode the shifts of a day are filled in night→morning→
  // evening order, so when filling one shift the generator can't yet "see" the
  // preserved duties of the day's other shifts (or the neighbouring days). Index
  // every preserved duty up front so eligibility can honour the hard rest and
  // one-shift-per-day rules against them regardless of processing order.
  const preservedDayShifts: Record<string, Record<number, Shift[]>> = {}
  if (preserveExisting && baseRoster) {
    activeDoctors.forEach(d => { preservedDayShifts[d.id] = {} })
    Object.keys(baseRoster).forEach(dk => {
      const day = Number(dk)
      SHIFTS.forEach(sh => {
        const cell = baseRoster[day]?.[sh]
        if (!cell) return
        Object.values(cell).forEach(ids => ids.forEach(id => {
          if (!preservedDayShifts[id]) return
          ;(preservedDayShifts[id][day] = preservedDayShifts[id][day] || []).push(sh)
        }))
      })
    })
  }

  // Seed the CUMULATIVE counters from EVERY existing duty up front — the whole
  // month, in-range and out — so the hard caps (monthly duty, night, OPD, Cath)
  // see a doctor's full preserved load before any new duty is added. (Without
  // this, a duty added on an early day wouldn't yet "see" the doctor's later
  // preserved nights and could push them over the cap.) The per-day replay below
  // then only updates the day-ordered state, never the cumulative counters again.
  if (baseRoster) {
    for (let day = 1; day <= days; day++) {
      const weekday = new Date(year, month - 1, day).getDay()
      SHIFT_ORDER.forEach(shift => {
        const cell = baseRoster[day]?.[shift]
        if (!cell) return
        const effList = baseEffectiveStations?.[day]?.[shift] || []
        Object.keys(cell).forEach(stId => {
          const station = effList.find(s => s.id === stId) || { id: stId, label: stId, wards: [] as string[], needed: 0 }
          cell[stId].forEach(docId => {
            const d = doctorById[docId]
            if (d) accountCumulative(d, shift, station, weekday)
          })
        })
      })
    }
    // Sequential (night-rest / pacing / streak) state for the fixed prefix — the
    // days before the generated window, which are never re-processed.
    for (let day = 1; day < startDay; day++) {
      const weekday = new Date(year, month - 1, day).getDay()
      SHIFT_ORDER.forEach(shift => {
        const cell = baseRoster[day]?.[shift]
        if (!cell) return
        Object.keys(cell).forEach(stId => {
          cell[stId].forEach(docId => { const d = doctorById[docId]; if (d) accountSequential(d, day, shift) })
        })
      })
    }
  }

  for (let day = startDay; day <= endDay; day++) {
    const weekday = new Date(year, month - 1, day).getDay()
    const holidayToday = isHolidayDay(day, year, month, holidays)
    roster[day] = {}
    effectiveStations[day] = {}
    const assignedTodayMap: Record<string, Shift[]> = {}

    // Which shifts a doctor is pinned to today by a fixed assignment. Night is
    // filled first, so the general fill must not grab a doctor away from a
    // later-shift fixed assignment (their assigned shift is reserved).
    const fixedShiftsToday: Record<string, Set<Shift>> = {}
    demands.forEach(dem => {
      if (dem.kind !== 'assign' || !dem.shift) return
      const matches = dem.scope === 'weekly' ? dem.dayOfWeek === weekday : dem.scope === 'date' ? dem.date === day : false
      if (!matches) return
      ;(fixedShiftsToday[dem.doctorId] = fixedShiftsToday[dem.doctorId] || new Set()).add(dem.shift)
    })

    // HARD priority: fill shifts in the configured order (night first by
    // default). OPD stations are prioritised within each shift (below).
    shiftFillOrder.forEach(shift => {
      roster[day][shift] = {}
      const usedThisShift = new Set<string>()
      let dayStations = holidayAdjustedStations(shift, holidayToday).filter(s => s.needed > 0)
      // Display order: the Observation ward always comes first in the chart
      // (all views and exports read this order); the rest keep their order.
      dayStations = [
        ...dayStations.filter(s => s.wards.includes('Observation')),
        ...dayStations.filter(s => !s.wards.includes('Observation')),
      ]
      effectiveStations[day][shift] = dayStations

      // Manual scaffold: expose the stations but assign nobody.
      if (scaffoldOnly) return

      // Continue / complete: keep the existing in-range duties for this shift and
      // only fill the empty slots below. Account them so targets, rest and
      // double-duty rules see them.
      if (preserveExisting && baseRoster) {
        const baseCell = baseRoster[day]?.[shift] || {}
        dayStations.forEach(st => {
          const existing = baseCell[st.id]
          if (!existing || existing.length === 0) return
          existing.forEach(docId => {
            const d = doctorById[docId]
            if (!d || usedThisShift.has(d.id)) return
            roster[day][shift]![st.id] = [...(roster[day][shift]![st.id] || []), d.id]
            usedThisShift.add(d.id)
            assignedTodayMap[d.id] = [...(assignedTodayMap[d.id] || []), shift]
            // Cumulative counters are already seeded up front; here only update the
            // day-ordered state (rest/pacing/streak/recency).
            accountSequential(d, day, shift)
            markWard(d.id, day, st)
            if (isOnLeave(d.id, day)) leaveOverrides.push({ day, shift, doctorId: d.id })
          })
        })
      }

      dayStations = [...dayStations].sort((a, b) => staticEligibleCount(a) - staticEligibleCount(b))

      // Handle fixed assignments first
      const fixedAssignDemands = demands.filter(dem => {
        if (dem.kind !== 'assign' || dem.shift !== shift) return false
        if (dem.scope === 'weekly') return dem.dayOfWeek === weekday
        if (dem.scope === 'date') return dem.date === day
        return false
      })

      fixedAssignDemands.forEach(dem => {
        const d = doctorById[dem.doctorId]
        if (!d) return
        // Frozen (user-entered) doctors keep exactly their hand-entered duties.
        if (frozenDoctorIds.has(d.id)) return
        // A fixed assignment is an explicit demand; if it can't be honoured,
        // record it as an unmet-demand shortfall (never improvised away).
        const skip = (why: string) => {
          const msg = `Day ${day} — ${shift} — fixed assignment for ${d.name}: ${why}`
          warnings.push(msg)
          shortfalls.push({
            day, shift, stationId: '', stationLabel: dem.wardName || '—',
            needed: 1, filled: 0, missing: 1, kind: 'demand', reason: msg,
          })
        }
        // In continue/complete mode the doctor may already hold a preserved duty
        // this shift (possibly this very fixed assignment) — treat as satisfied.
        if (usedThisShift.has(d.id)) return preserveExisting ? undefined : skip('already assigned elsewhere this shift.')
        if (lastNightDay[d.id] === day - 1) return skip('mandatory rest after night shift.')
        const alreadyToday = assignedTodayMap[d.id] || []
        if (alreadyToday.length > 0) {
          const dbl = doublePairFlags(d.id, day, weekday)
          const lastLeg = alreadyToday[alreadyToday.length - 1]
          const patternOk = alreadyToday.length === 1 && (
            (dbl.me && ((lastLeg === 'morning' && shift === 'evening') || (lastLeg === 'evening' && shift === 'morning')))
            || (dbl.en && ((lastLeg === 'evening' && shift === 'night') || (lastLeg === 'night' && shift === 'evening')))
          )
          if (!patternOk) return skip('no matching double-duty demand.')
        }
        if (isOff(d.id, day, weekday, shift)) return skip('doctor has off request.')
        if (isOnLeave(d.id, day)) return skip('doctor on casual leave.')
        const matchingStation = dayStations.find(s => s.wards.includes(dem.wardName || ''))
        if (!matchingStation) return skip(`"${dem.wardName}" not staffed this shift.`)
        // Reserved wards / MO-only policy also apply to fixed assignments.
        if (isReservedStation(matchingStation)) return
        if (!autoAssignable(d, matchingStation)) return
        if (matchingStation.wards.includes('Cath') && !d.cathEligible) return skip('not Cath-eligible.')
        if (shift === 'night' && is9CabinStation(matchingStation) && d.gender === 'female') return skip('Ward 9 + Cabin night duty is male-only.')
        if (isObservationStation(matchingStation) && d.gender === 'female') return skip('Observation is male-only.')
        if (shift === 'morning' && isResident(d)) return skip('Residents do not do morning duty.')
        if (isSMO(d) && !matchingStation.wards.some(w => SMO_WARDS.includes(w))) return skip('SMO restricted to 3A / 7 / OPD / DS 15A.')
        if (isFirstMan(d) && !isEMO(d) && !matchingStation.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w))) return skip('First Man restricted to priority wards.')
        if (d.allowedWards.length > 0 && !matchingStation.wards.some(w => d.allowedWards.includes(w))) return skip(`ward-restricted, "${dem.wardName}" not allowed.`)
        if (isOpdStation(matchingStation) && d.opdMax != null && opdCount[d.id] >= d.opdMax) return skip('OPD limit reached.')
        // HARD: never exceed the monthly duty cap, even for a fixed assignment.
        if (assignedCount[d.id] >= effectiveTargets[d.id]) return skip('monthly duty cap reached.')
        // HARD: never exceed the night-duty cap.
        if (shift === 'night' && nightCount[d.id] >= d.nightTarget) return skip('night duty cap reached.')
        if (shift === 'night' && weekday === 5 && fridayNightCount[d.id] >= 2) return skip('Friday night cap reached.')
        usedThisShift.add(d.id)
        assignedCount[d.id]++
        shiftTypeCount[d.id][shift]++
        assignedTodayMap[d.id] = [...(assignedTodayMap[d.id] || []), shift]
        if (shift === 'night') { nightCount[d.id]++; lastNightDay[d.id] = day }
        if (matchingStation.wards.includes('Cath')) cathCount[d.id]++
        if (isOpdStation(matchingStation)) opdCount[d.id]++
        if (shift === 'night' && weekday === 5) fridayNightCount[d.id]++
        markWard(d.id, day, matchingStation)
        roster[day][shift]![matchingStation.id] = [...(roster[day][shift]![matchingStation.id] || []), d.id]
      })

      // Priority ordering: Observation, then OPD requirements, then Ward 7,
      // then the rest (shuffled). Combined with night-first shift order, this
      // fills the night and OPD requirements ahead of ordinary day duties.
      const obsStations = dayStations.filter(s => s.wards.includes('Observation'))
      const opdStations = dayStations.filter(s => !s.wards.includes('Observation') && isOpdStation(s))
      const w7Stations = dayStations.filter(s => !s.wards.includes('Observation') && !isOpdStation(s) && s.wards.includes('7'))
      const restStations = dayStations.filter(s => !s.wards.includes('Observation') && !isOpdStation(s) && !s.wards.includes('7'))
      const shuffledStations = [...obsStations, ...opdStations, ...w7Stations, ...restStations.sort(() => Math.random() - 0.5)]

      shuffledStations.forEach(station => {
        // Reserved wards are left for manual entry — never auto-filled (any
        // existing/user duties there were already kept above).
        if (isReservedStation(station)) return
        const alreadyAssigned = roster[day][shift]![station.id] || []
        const remainingNeeded = Math.max(0, station.needed - alreadyAssigned.length)
        if (remainingNeeded === 0) return

        function baseEligible(extra: boolean): Doctor[] {
          return activeDoctors.filter(d => {
            // Frozen (user-entered) doctors never get a new duty added.
            if (frozenDoctorIds.has(d.id)) return false
            // HARD: Residents never do morning duty.
            if (shift === 'morning' && isResident(d)) return false
            // MO-only policy: auto-assign plain MOs (Cath allows any Cath-eligible).
            if (!autoAssignable(d, station)) return false
            if (usedThisShift.has(d.id)) return false
            if (lastNightDay[d.id] === day - 1) return false
            const dbl = doublePairFlags(d.id, day, weekday)
            const already = assignedTodayMap[d.id] || []
            if (already.length > 0) {
              if (!dbl.me && !dbl.en) return false
              if (already.length >= 2) return false
              const lastLeg = already[already.length - 1]
              // A double-duty doctor works exactly the two paired shifts, in
              // whichever order they're processed (the fill order is configurable).
              const meOk = dbl.me && ((lastLeg === 'morning' && shift === 'evening') || (lastLeg === 'evening' && shift === 'morning'))
              const enOk = dbl.en && ((lastLeg === 'evening' && shift === 'night') || (lastLeg === 'night' && shift === 'evening'))
              if (!meOk && !enOk) return false
            }
            // Preserve/complete: honour the hard rest and one-shift-per-day rules
            // against existing duties the shift-by-shift order hasn't surfaced yet
            // (this day's other shifts, and the neighbouring days).
            if (preserveExisting) {
              const ps = preservedDayShifts[d.id]
              if (ps) {
                for (const psh of ps[day] || []) {
                  if (psh === shift || already.includes(psh)) continue
                  const okDouble = (dbl.me && ((psh === 'morning' && shift === 'evening') || (psh === 'evening' && shift === 'morning')))
                    || (dbl.en && ((psh === 'evening' && shift === 'night') || (psh === 'night' && shift === 'evening')))
                  if (!okDouble) return false
                }
                // Rest after night, both directions: no night today if a duty is
                // kept tomorrow; no duty today if a night is kept yesterday.
                if (shift === 'night' && (ps[day + 1] || []).length > 0) return false
                if ((ps[day - 1] || []).includes('night')) return false
              }
            }
            if (shift === 'morning') {
              const already2 = assignedTodayMap[d.id] || []
              if (already2.includes('night')) return false
              // Pure evening+night doctors don't do mornings; a both-pairs doctor may.
              if (!extra && dbl.en && !dbl.me) return false
            }
            // Pure morning+evening doctors work only day shifts — keep them off
            // nights (symmetric to the EN → no-morning rule); a both-pairs doctor
            // may take a night as the E+N leg. Soft: relaxed in the auto-fill pass.
            if (shift === 'night' && !extra && dbl.me && !dbl.en) return false
            // Reserve a doctor for their fixed-assignment shift today: the general
            // fill of any other shift skips them (unless the two shifts form a
            // valid double), so a night fill can't block an evening assignment.
            const fx = fixedShiftsToday[d.id]
            if (!extra && fx && !fx.has(shift)) {
              const okPair = (dbl.me && ((fx.has('evening') && shift === 'morning') || (fx.has('morning') && shift === 'evening')))
                || (dbl.en && ((fx.has('night') && shift === 'evening') || (fx.has('evening') && shift === 'night')))
              if (!okPair) return false
            }
            if (station.wards.includes('Cath') && !d.cathEligible) return false
            // HARD: Ward 9 + Cabin NIGHT duty is male-only.
            if (shift === 'night' && is9CabinStation(station) && d.gender === 'female') return false
            // HARD: Observation is male-only (all shifts).
            if (isObservationStation(station) && d.gender === 'female') return false
            // SOFT: avoid two EMOs together in Observation on the same shift —
            // relaxed in the auto-fill pass if that's the only way to staff it.
            if (!extra && isObservationStation(station) && isEMO(d)) {
              const here = roster[day][shift]![station.id] || []
              if (here.some(id => doctorById[id] && isEMO(doctorById[id]))) return false
            }
            // HARD: SMO only at 3A / 7 / OPD A-C / DS 15A.
            if (isSMO(d) && !station.wards.some(w => SMO_WARDS.includes(w))) return false
            if (isFirstMan(d) && !isEMO(d) && !station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w))) return false
            if (isFirstMan(d) && isEMO(d) && !station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w)) && !station.wards.includes('Observation')) return false
            // HARD: ward check-marks (allowed wards).
            if (d.allowedWards.length > 0 && !station.wards.some(w => d.allowedWards.includes(w))) return false
            if (isOff(d.id, day, weekday, shift)) return false
            if (!extra && isOnLeave(d.id, day)) return false
            // HARD: night-duty target is a cap — never exceeded, even by auto-fill.
            if (shift === 'night' && nightCount[d.id] >= d.nightTarget) return false
            if (station.wards.includes('Cath') && !extra && cathCount[d.id] >= d.cathQuota) return false
            // HARD: OPD ward cap — never exceeded, even by auto-fill.
            if (isOpdStation(station) && d.opdMax != null && opdCount[d.id] >= d.opdMax) return false
            if (shift === 'night' && weekday === 5 && fridayNightCount[d.id] >= 2) return false
            if (shift === 'night' && weekday === 5 && !extra && exemptFromFriday.has(d.id)) return false
            // HARD: total duty count (monthly target) — never exceeded, even by auto-fill.
            if (assignedCount[d.id] >= effectiveTargets[d.id]) return false
            if (!extra && lastShiftWorked[d.id] === shift && (sameShiftStreak[d.id] || 0) >= 3) return false
            if (!extra && station.wards.includes('7') && isSMO(d) && threeACount[d.id] < 4) return false
            // Pacing gaps between days apply only to a doctor's FIRST duty of the
            // day — never block a legitimate same-day double-duty second leg.
            if (!extra && already.length === 0 && lastDayWorked[d.id] !== undefined) {
              const effTarget = effectiveTargets[d.id] || d.target
              const pace = days / Math.max(1, effTarget)
              const minGap = Math.max(1, Math.floor(pace) - 1)
              if (day - lastDayWorked[d.id] < minGap) return false
            }
            return true
          })
        }

        function doSort(pool: Doctor[], extra: boolean): Doctor[] {
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
          }
          pool.sort((a, b) => {
            if (extra) {
              const aL = isOnLeave(a.id, day) ? 1 : 0
              const bL = isOnLeave(b.id, day) ? 1 : 0
              if (aL !== bL) return aL - bL
            }
            // First Man priority applies only at their priority wards — elsewhere
            // (e.g. Observation) they shouldn't be preferred, or they hog the ward.
            if (station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w))) {
              const aFM = isFirstMan(a) ? 1 : 0, bFM = isFirstMan(b) ? 1 : 0
              if (bFM !== aFM) return bFM - aFM
            }
            // Spread a ward across doctors: strongly prefer whoever worked this
            // ward longest ago (or never), so nobody is stuck on the same ward day
            // after day (e.g. 8 Observation duties in a row). This ranks above the
            // double-duty and preferred-ward biases so neither can hog a ward.
            const aGap = wardRecencyGap(a.id, station, day)
            const bGap = wardRecencyGap(b.id, station, day)
            if (aGap !== bGap) return bGap - aGap
            const aPair = doubleDutyPair(a.id, day, weekday) ? 1 : 0
            const bPair = doubleDutyPair(b.id, day, weekday) ? 1 : 0
            if (bPair !== aPair) return bPair - aPair
            // Soft placement bias: a doctor who prefers one of this station's
            // wards gets first pick here, so they pick up more duties at it —
            // but eligibility is unchanged, so a station is never left short.
            const aPref = a.preferredWards?.some(w => station.wards.includes(w)) ? 1 : 0
            const bPref = b.preferredWards?.some(w => station.wards.includes(w)) ? 1 : 0
            if (aPref !== bPref) return bPref - aPref
            if (station.wards.includes('Cath')) {
              if (cathCount[a.id] !== cathCount[b.id]) return cathCount[a.id] - cathCount[b.id]
              return Math.random() - 0.5
            }
            if (station.wards.includes('Observation')) {
              if (obsCount[a.id] !== obsCount[b.id]) return obsCount[a.id] - obsCount[b.id]
            }
            if (station.wards.includes('3A')) {
              const aS = isSMO(a) ? 0 : 1, bS = isSMO(b) ? 0 : 1
              if (aS !== bS) return aS - bS
              if (threeACount[a.id] !== threeACount[b.id]) return threeACount[a.id] - threeACount[b.id]
            }
            if (station.wards.includes('DS 15A')) {
              const aS = isSMO(a) ? 0 : 1, bS = isSMO(b) ? 0 : 1
              if (aS !== bS) return aS - bS
              if (threeACount[a.id] !== threeACount[b.id]) return threeACount[a.id] - threeACount[b.id]
            }
            if (station.wards.includes('7')) {
              const aReserve = isSMO(a) && threeACount[a.id] < 3 ? 1 : 0
              const bReserve = isSMO(b) && threeACount[b.id] < 3 ? 1 : 0
              if (aReserve !== bReserve) return aReserve - bReserve
              if (ward7Count[a.id] !== ward7Count[b.id]) return ward7Count[a.id] - ward7Count[b.id]
            }
            if (isOpdStation(station)) {
              const na = Math.max(0, (a.opdMin || 0) - opdCount[a.id])
              const nb = Math.max(0, (b.opdMin || 0) - opdCount[b.id])
              if (nb !== na) return nb - na
            }
            if (shift === 'night') {
              if (weekday === 5) {
                if (extra) {
                  const aEx = exemptFromFriday.has(a.id) ? 1 : 0
                  const bEx = exemptFromFriday.has(b.id) ? 1 : 0
                  if (aEx !== bEx) return aEx - bEx
                }
                if (fridayNightCount[a.id] !== fridayNightCount[b.id]) return fridayNightCount[a.id] - fridayNightCount[b.id]
              }
              const na = a.nightTarget - nightCount[a.id]
              const nb = b.nightTarget - nightCount[b.id]
              if (nb !== na) return nb - na
            }
            // Spread morning/evening/night evenly among EMOs: prefer the EMO
            // with the fewest duties of this shift type so far.
            if (isEMO(a) && isEMO(b)) {
              const as = shiftTypeCount[a.id][shift], bs = shiftTypeCount[b.id][shift]
              if (as !== bs) return as - bs
            }
            const aLast = lastDayWorked[a.id] !== undefined ? lastDayWorked[a.id] : -999
            const bLast = lastDayWorked[b.id] !== undefined ? lastDayWorked[b.id] : -999
            if (aLast !== bLast) return aLast - bLast
            const aStreak = lastShiftWorked[a.id] === shift ? (sameShiftStreak[a.id] || 0) : 0
            const bStreak = lastShiftWorked[b.id] === shift ? (sameShiftStreak[b.id] || 0) : 0
            if (aStreak !== bStreak) return aStreak - bStreak
            const na = effectiveTargets[a.id] - assignedCount[a.id]
            const nb = effectiveTargets[b.id] - assignedCount[b.id]
            if (nb !== na) return nb - na
            return Math.random() - 0.5
          })
          return pool
        }

        function assignOne(d: Doctor) {
          usedThisShift.add(d.id)
          assignedTodayMap[d.id] = [...(assignedTodayMap[d.id] || []), shift]
          accountCumulative(d, shift, station, weekday)
          accountSequential(d, day, shift)
          markWard(d.id, day, station)
          if (isOnLeave(d.id, day)) leaveOverrides.push({ day, shift, doctorId: d.id })
          roster[day][shift]![station.id] = [...(roster[day][shift]![station.id] || []), d.id]
        }

        // Log an auto-fill placement. Call BEFORE assignOne so the reasons
        // reflect the doctor's state at the moment they were picked.
        function recordImprov(d: Doctor) {
          improvisations.push({
            day, shift, stationId: station.id, stationLabel: station.label,
            doctorId: d.id, doctorName: d.name,
            reasons: relaxReasons(d, station, shift, day, weekday),
          })
        }

        const wardForComposition = station.wards.find(w => SLOT_COMPOSITION[w])
        const slots = wardForComposition ? SLOT_COMPOSITION[wardForComposition][shift] : undefined

        if (slots && alreadyAssigned.length === 0) {
          const filledIds: string[] = []
          slots.slice(0, station.needed).forEach(slotRule => {
            const catFilter = slotRule?.cats || null
            const fallbackFilter = slotRule?.fallback || null
            const excludeCats = slotRule?.excludeCats || null
            const meetsSlot = (cats: Category[] | null, doc: Doctor) => {
              if (cats && !doc.categories.some(c => cats.includes(c))) return false
              if (excludeCats && doc.categories.some(c => excludeCats.includes(c))) return false
              return true
            }
            // Strict pass: required category, then the fallback category.
            let picked: Doctor | null = null
            let improvised = false
            const normalPool = doSort(baseEligible(false).filter(d => meetsSlot(catFilter, d) && !filledIds.includes(d.id)), false)
            const nc = pickAvoidingSeniorConflict(normalPool, 1, [])
            if (nc.length) picked = nc[0]
            if (!picked && fallbackFilter && fallbackFilter !== catFilter) {
              const fbNormal = doSort(baseEligible(false).filter(d => meetsSlot(fallbackFilter, d) && !filledIds.includes(d.id)), false)
              const fnc = pickAvoidingSeniorConflict(fbNormal, 1, [])
              if (fnc.length) picked = fnc[0]
            }
            // Auto-fill pass: same order but relaxing soft rules.
            if (!picked && autoFill) {
              const extraPool = doSort(baseEligible(true).filter(d => meetsSlot(catFilter, d) && !filledIds.includes(d.id)), true)
              const ec = pickAvoidingSeniorConflict(extraPool, 1, [])
              if (ec.length) { picked = ec[0]; improvised = true }
              else if (fallbackFilter && fallbackFilter !== catFilter) {
                const fbExtra = doSort(baseEligible(true).filter(d => meetsSlot(fallbackFilter, d) && !filledIds.includes(d.id)), true)
                const fec = pickAvoidingSeniorConflict(fbExtra, 1, [])
                if (fec.length) { picked = fec[0]; improvised = true }
              }
            }
            if (picked) {
              filledIds.push(picked.id)
              if (improvised) recordImprov(picked)
              assignOne(picked)
            } else if (catFilter) {
              const canExtra = baseEligible(true).some(d => meetsSlot(catFilter, d) && !filledIds.includes(d.id))
              shortfalls.push({
                day, shift, stationId: station.id, stationLabel: station.label,
                needed: station.needed, filled: filledIds.length, missing: 1, kind: 'slot',
                reason: canExtra
                  ? `no [${catFilter.join('/')}] available without bending a rule`
                  : `no eligible [${catFilter.join('/')}] doctor for this slot`,
              })
            }
          })
        } else {
          // Strict pass: only doctors who satisfy every rule, quota and target.
          const strictChosen = pickAvoidingSeniorConflict(doSort(baseEligible(false), false), remainingNeeded, [])
          strictChosen.forEach(assignOne)
          let filled = strictChosen.length
          // Auto-fill pass: relax soft rules to fill the remaining slots.
          if (filled < remainingNeeded && autoFill) {
            const extraPool = doSort(baseEligible(true), true)
            const combined = pickAvoidingSeniorConflict(extraPool, remainingNeeded, strictChosen)
            const extraOnly = combined.filter(d => !strictChosen.includes(d))
            extraOnly.forEach(d => { recordImprov(d); assignOne(d) })
            filled += extraOnly.length
          }
          if (filled < remainingNeeded) {
            const canExtra = baseEligible(true).length > 0
            shortfalls.push({
              day, shift, stationId: station.id, stationLabel: station.label,
              needed: station.needed, filled: alreadyAssigned.length + filled,
              missing: remainingNeeded - filled, kind: 'understaffed',
              reason: canExtra
                ? 'no doctor available without exceeding a target/quota or covering leave'
                : 'no eligible doctor (ward / category / rest restrictions)',
            })
          }
        }
      })
    })
  }

  // Post-generation warnings
  const zeroFridayNightDoctors = activeDoctors.filter(d => fridayNightCount[d.id] === 0)
  if (zeroFridayNightDoctors.length > 0) {
    warnings.push(`${zeroFridayNightDoctors.length} doctor(s) did not get a Friday night duty: ${zeroFridayNightDoctors.slice(0, 15).map(d => d.name).join(', ')}${zeroFridayNightDoctors.length > 15 ? `, and ${zeroFridayNightDoctors.length - 15} more` : ''}.`)
  }
  if (leaveOverrides.length > 0) {
    const names = Array.from(new Set(leaveOverrides.map(o => doctorById[o.doctorId]?.name).filter(Boolean)))
    warnings.push(`${leaveOverrides.length} shift(s) covered by doctor on casual leave (affected ${names.length} doctor(s): ${names.slice(0, 15).join(', ')}${names.length > 15 ? `, and ${names.length - 15} more` : ''}).`)
  }

  return {
    roster,
    effectiveStations,
    warnings,
    shortfalls,
    improvisations,
    assignedCount,
    nightCount,
    cathCount,
    opdCount,
    fridayNightCount,
    leaveOverrides,
    effectiveTargets,
    casualLeaveDays,
  }
}
