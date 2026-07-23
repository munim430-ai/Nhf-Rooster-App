import type {
  Doctor, Ward, ShiftStations, Demand, Holiday, RosterEntry,
  EffectiveStations, Shift, Station, Category
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
  assignedCount: Record<string, number>
  nightCount: Record<string, number>
  cathCount: Record<string, number>
  opdCount: Record<string, number>
  fridayNightCount: Record<string, number>
  leaveOverrides: Array<{ day: number; shift: Shift; doctorId: string }>
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
  dutyBank: Record<string, Record<string, { baseTarget: number; effectiveTarget: number; assigned: number; balance: number }>>
): GenerationResult {
  const activeDoctors = doctors.filter(d => d.active)
  const assignedCount: Record<string, number> = {}
  const nightCount: Record<string, number> = {}
  const cathCount: Record<string, number> = {}
  const opdCount: Record<string, number> = {}
  const fridayNightCount: Record<string, number> = {}
  const obsCount: Record<string, number> = {}
  const threeACount: Record<string, number> = {}
  const ward7Count: Record<string, number> = {}
  const leaveOverrides: Array<{ day: number; shift: Shift; doctorId: string }> = []

  activeDoctors.forEach(d => {
    assignedCount[d.id] = 0
    nightCount[d.id] = 0
    cathCount[d.id] = 0
    opdCount[d.id] = 0
    fridayNightCount[d.id] = 0
    obsCount[d.id] = 0
    threeACount[d.id] = 0
    ward7Count[d.id] = 0
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

  const roster: RosterEntry = {}
  const effectiveStations: EffectiveStations = {}
  const warnings: string[] = []

  // Index demands by doctor
  const demandsByDoctor: Record<string, Demand[]> = {}
  demands.forEach(dem => {
    demandsByDoctor[dem.doctorId] = demandsByDoctor[dem.doctorId] || []
    demandsByDoctor[dem.doctorId].push(dem)
  })
  const doctorById: Record<string, Doctor> = {}
  activeDoctors.forEach(d => { doctorById[d.id] = d })

  const OPD_ABC_WARDS = ['OPD A', 'OPD B', 'OPD C']
  function isOpdStation(station: Station): boolean {
    return station.wards.some(w => OPD_ABC_WARDS.includes(w))
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

  function doubleDutyPair(doctorId: string, day: number, weekday: number): 'ME' | 'EN' | null {
    const list = demandsByDoctor[doctorId]
    if (!list) return null
    const hasSingleOnly = list.some(dem => {
      if (dem.kind !== 'single') return false
      if (dem.scope === 'always') return true
      if (dem.scope === 'weekly') return dem.dayOfWeek === weekday
      if (dem.scope === 'date') return dem.date === day
      return false
    })
    if (hasSingleOnly) return null
    const dem = list.find(dem => {
      if (dem.kind !== 'double') return false
      if (dem.scope === 'always') return true
      if (dem.scope === 'weekly') return dem.dayOfWeek === weekday
      if (dem.scope === 'date') return dem.date === day
      return false
    })
    return dem ? (dem.pair || 'ME') : null
  }

  // Cache static eligible counts
  const staticEligibleCountCache: Record<string, number> = {}
  function staticEligibleCount(station: Station): number {
    const key = [...station.wards].sort().join('|')
    if (staticEligibleCountCache[key] !== undefined) return staticEligibleCountCache[key]
    const count = activeDoctors.filter(d => {
      if (station.wards.includes('Cath') && !d.cathEligible) return false
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

  for (let day = 1; day <= days; day++) {
    const weekday = new Date(year, month - 1, day).getDay()
    const holidayToday = isHolidayDay(day, year, month, holidays)
    roster[day] = {}
    effectiveStations[day] = {}
    const assignedTodayMap: Record<string, Shift[]> = {}

    SHIFTS.forEach(shift => {
      roster[day][shift] = {}
      const usedThisShift = new Set<string>()
      let dayStations = holidayAdjustedStations(shift, holidayToday).filter(s => s.needed > 0)
      effectiveStations[day][shift] = dayStations

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
        if (usedThisShift.has(d.id)) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name} skipped: already assigned elsewhere this shift.`)
          return
        }
        if (lastNightDay[d.id] === day - 1) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name} skipped: mandatory rest after night shift.`)
          return
        }
        const alreadyToday = assignedTodayMap[d.id] || []
        if (alreadyToday.length > 0) {
          const pair = doubleDutyPair(d.id, day, weekday)
          const lastLeg = alreadyToday[alreadyToday.length - 1]
          const patternOk = pair === 'ME' ? (alreadyToday.length === 1 && lastLeg === 'morning' && shift === 'evening')
            : pair === 'EN' ? (alreadyToday.length === 1 && lastLeg === 'evening' && shift === 'night')
            : false
          if (!patternOk) {
            warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name} skipped: no matching double-duty demand.`)
            return
          }
        }
        if (isOff(d.id, day, weekday, shift)) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name} skipped: doctor has off request.`)
          return
        }
        if (isOnLeave(d.id, day)) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name} skipped: doctor on casual leave.`)
          return
        }
        const matchingStation = dayStations.find(s => s.wards.includes(dem.wardName || ''))
        if (!matchingStation) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name}: "${dem.wardName}" not staffed this shift.`)
          return
        }
        if (matchingStation.wards.includes('Cath') && !d.cathEligible) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name}: not Cath-eligible.`)
          return
        }
        if (isFirstMan(d) && !isEMO(d) && !matchingStation.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w))) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name}: First Man restricted to priority wards.`)
          return
        }
        if (d.allowedWards.length > 0 && !matchingStation.wards.some(w => d.allowedWards.includes(w))) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name}: ward-restricted, "${dem.wardName}" not allowed.`)
          return
        }
        if (isOpdStation(matchingStation) && d.opdMax != null && opdCount[d.id] >= d.opdMax) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name}: OPD limit reached.`)
          return
        }
        if (shift === 'night' && weekday === 5 && fridayNightCount[d.id] >= 2) {
          warnings.push(`Day ${day} — ${shift} — fixed assignment for ${d.name}: Friday night cap reached.`)
          return
        }
        usedThisShift.add(d.id)
        assignedCount[d.id]++
        assignedTodayMap[d.id] = [...(assignedTodayMap[d.id] || []), shift]
        if (shift === 'night') { nightCount[d.id]++; lastNightDay[d.id] = day }
        if (matchingStation.wards.includes('Cath')) cathCount[d.id]++
        if (isOpdStation(matchingStation)) opdCount[d.id]++
        if (shift === 'night' && weekday === 5) fridayNightCount[d.id]++
        roster[day][shift]![matchingStation.id] = [...(roster[day][shift]![matchingStation.id] || []), d.id]
      })

      // Priority ordering: Observation first, then Ward 7, then rest shuffled
      const obsStations = dayStations.filter(s => s.wards.includes('Observation'))
      const w7Stations = dayStations.filter(s => s.wards.includes('7'))
      const restStations = dayStations.filter(s => !s.wards.includes('Observation') && !s.wards.includes('7'))
      const shuffledStations = [...obsStations, ...w7Stations, ...restStations.sort(() => Math.random() - 0.5)]

      shuffledStations.forEach(station => {
        const alreadyAssigned = roster[day][shift]![station.id] || []
        const remainingNeeded = Math.max(0, station.needed - alreadyAssigned.length)
        if (remainingNeeded === 0) return

        function baseEligible(extra: boolean): Doctor[] {
          return activeDoctors.filter(d => {
            if (usedThisShift.has(d.id)) return false
            if (lastNightDay[d.id] === day - 1) return false
            const already = assignedTodayMap[d.id] || []
            if (already.length > 0) {
              const pair = doubleDutyPair(d.id, day, weekday)
              if (!pair) return false
              if (already.length >= 2) return false
              const lastLeg = already[already.length - 1]
              if (pair === 'ME' && !(lastLeg === 'morning' && shift === 'evening')) return false
              if (pair === 'EN' && !(lastLeg === 'evening' && shift === 'night')) return false
            }
            if (shift === 'morning') {
              const already2 = assignedTodayMap[d.id] || []
              if (already2.includes('night')) return false
              if (!extra && doubleDutyPair(d.id, day, weekday) === 'EN') return false
            }
            if (station.wards.includes('Cath') && !d.cathEligible) return false
            if (isFirstMan(d) && !isEMO(d) && !station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w))) return false
            if (isFirstMan(d) && isEMO(d) && !station.wards.some(w => FIRST_MAN_PRIORITY_WARDS.includes(w)) && !station.wards.includes('Observation')) return false
            if (d.allowedWards.length > 0 && !station.wards.some(w => d.allowedWards.includes(w))) return false
            if (isOff(d.id, day, weekday, shift)) return false
            if (!extra && isOnLeave(d.id, day)) return false
            if (shift === 'night' && !extra && nightCount[d.id] >= d.nightTarget) return false
            if (station.wards.includes('Cath') && !extra && cathCount[d.id] >= d.cathQuota) return false
            if (isOpdStation(station) && d.opdMax != null && opdCount[d.id] >= d.opdMax) return false
            if (shift === 'night' && weekday === 5 && fridayNightCount[d.id] >= 2) return false
            if (shift === 'night' && weekday === 5 && !extra && exemptFromFriday.has(d.id)) return false
            if (!extra && assignedCount[d.id] >= effectiveTargets[d.id]) return false
            if (!extra && lastShiftWorked[d.id] === shift && (sameShiftStreak[d.id] || 0) >= 3) return false
            if (!extra && station.wards.includes('7') && isSMO(d) && threeACount[d.id] < 4) return false
            if (!extra && lastDayWorked[d.id] !== undefined) {
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
            const aFM = isFirstMan(a) ? 1 : 0, bFM = isFirstMan(b) ? 1 : 0
            if (bFM !== aFM) return bFM - aFM
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
          assignedCount[d.id]++
          assignedTodayMap[d.id] = [...(assignedTodayMap[d.id] || []), shift]
          if (lastShiftWorked[d.id] === shift && lastDayWorked[d.id] !== undefined) {
            sameShiftStreak[d.id] = (sameShiftStreak[d.id] || 1) + 1
          } else {
            sameShiftStreak[d.id] = 1
          }
          lastShiftWorked[d.id] = shift
          lastDayWorked[d.id] = day
          if (shift === 'night') { nightCount[d.id]++; lastNightDay[d.id] = day }
          if (station.wards.includes('Cath')) cathCount[d.id]++
          if (isOpdStation(station)) opdCount[d.id]++
          if (station.wards.includes('Observation')) obsCount[d.id]++
          if (station.wards.includes('3A') || station.wards.includes('DS 15A')) threeACount[d.id]++
          if (station.wards.includes('7')) ward7Count[d.id]++
          if (shift === 'night' && weekday === 5) fridayNightCount[d.id]++
          if (isOnLeave(d.id, day)) leaveOverrides.push({ day, shift, doctorId: d.id })
          roster[day][shift]![station.id] = [...(roster[day][shift]![station.id] || []), d.id]
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
            let picked: Doctor | null = null
            const normalPool = doSort(baseEligible(false).filter(d => meetsSlot(catFilter, d) && !filledIds.includes(d.id)), false)
            const nc = pickAvoidingSeniorConflict(normalPool, 1, [])
            if (nc.length) picked = nc[0]
            else {
              const extraPool = doSort(baseEligible(true).filter(d => meetsSlot(catFilter, d) && !filledIds.includes(d.id) && !normalPool.includes(d)), true)
              const ec = pickAvoidingSeniorConflict(extraPool, 1, [])
              if (ec.length) picked = ec[0]
            }
            if (!picked && fallbackFilter && fallbackFilter !== catFilter) {
              const fbNormal = doSort(baseEligible(false).filter(d => meetsSlot(fallbackFilter, d) && !filledIds.includes(d.id)), false)
              const fnc = pickAvoidingSeniorConflict(fbNormal, 1, [])
              if (fnc.length) picked = fnc[0]
              else {
                const fbExtra = doSort(baseEligible(true).filter(d => meetsSlot(fallbackFilter, d) && !filledIds.includes(d.id) && !fbNormal.includes(d)), true)
                const fec = pickAvoidingSeniorConflict(fbExtra, 1, [])
                if (fec.length) picked = fec[0]
              }
            }
            if (picked) { filledIds.push(picked.id); assignOne(picked) }
            else if (catFilter) {
              warnings.push(`Day ${day} — ${shift} — "${station.label}": slot requiring [${catFilter.join('/')}] left empty.`)
            }
          })
        } else {
          let chosen = pickAvoidingSeniorConflict(doSort(baseEligible(false), false), remainingNeeded, [])
          if (chosen.length < remainingNeeded) {
            const extraPool = doSort(baseEligible(true).filter(d => !chosen.includes(d)), true)
            chosen = pickAvoidingSeniorConflict(extraPool, remainingNeeded, chosen)
          }
          if (chosen.length < remainingNeeded) {
            warnings.push(`Day ${day} — ${shift} — "${station.label}": short by ${remainingNeeded - chosen.length} doctor(s).`)
          }
          chosen.forEach(assignOne)
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
    assignedCount,
    nightCount,
    cathCount,
    opdCount,
    fridayNightCount,
    leaveOverrides,
  }
}
