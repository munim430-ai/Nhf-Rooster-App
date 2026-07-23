export type Category = 'SMO' | 'EMO' | 'MO' | 'First Man';
export type Shift = 'morning' | 'evening' | 'night';
export type DemandKind = 'off' | 'double' | 'single' | 'leave' | 'assign';
export type DemandScope = 'weekly' | 'date' | 'always';
export type WardGroup = 'General' | 'DS' | 'OPD' | 'Cath';

export interface Doctor {
  id: string;
  name: string;
  categories: Category[];
  secret: boolean;
  allowedWards: string[];
  preferredWards: string[];
  cathEligible: boolean;
  cathQuota: number;
  target: number;
  nightTarget: number;
  opdMin: number;
  opdMax: number | null;
  dutyStartDate: string | null;
  dutyEndDate: string | null;
  active: boolean;
  created_at?: string;
}

export interface Ward {
  id: string;
  name: string;
  group: WardGroup;
  active: boolean;
  created_at?: string;
}

export interface Station {
  id: string;
  label: string;
  wards: string[];
  needed: number;
}

export interface ShiftStations {
  morning: Station[];
  evening: Station[];
  night: Station[];
}

export interface Demand {
  id: string;
  doctorId: string;
  kind: DemandKind;
  scope: DemandScope;
  shift: Shift | null;
  pair: 'ME' | 'EN' | null;
  wardName: string | null;
  dayOfWeek: number | null;
  date: number | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  created_at?: string;
}

export interface Holiday {
  id: string;
  date: number;
  label: string;
  year: number;
  month: number;
  created_at?: string;
}

export interface RosterMeta {
  year: number;
  month: number;
  days: number;
  printDensity: number;
  generatedAt: string | null;
}

export interface RosterEntry {
  [day: number]: {
    [shift in Shift]?: {
      [stationId: string]: string[];
    };
  };
}

export interface EffectiveStations {
  [day: number]: {
    [shift in Shift]?: Station[];
  };
}

export interface Settings {
  secretPassword: string;
  hospitalName: string;
  preparedByName: string;
}

export interface MakerPassword {
  id: string;
  password_hash: string;
  label: string;
  expires_at: string | null;
  active: boolean;
  created_by: string;
  created_at?: string;
}

export interface FridayNightHistory {
  [monthKey: string]: {
    [doctorId: string]: number;
  };
}

export interface DutyBankEntry {
  baseTarget: number;
  effectiveTarget: number;
  assigned: number;
  balance: number;
}

export interface DutyBank {
  [monthKey: string]: {
    [doctorId: string]: DutyBankEntry;
  };
}

export interface AppState {
  doctors: Doctor[];
  wards: Ward[];
  stations: ShiftStations;
  demands: Demand[];
  holidays: Holiday[];
  notes: string;
  settings: Settings;
  meta: RosterMeta;
  roster: RosterEntry | null;
  effectiveStations: EffectiveStations | null;
  warnings: string[];
  fridayNightHistory: FridayNightHistory;
  dutyBank: DutyBank;
}

export interface SlotRule {
  cats: Category[];
  fallback?: Category[];
  excludeCats?: Category[];
}

export interface SlotComposition {
  [wardName: string]: {
    [shift in Shift]?: (SlotRule | null)[];
  };
}

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
] as const;

export const SHIFTS: Shift[] = ['morning','evening','night'];

export const SHIFT_LABEL: Record<Shift, string> = {
  morning: 'Morning (08:00–14:30)',
  evening: 'Evening (14:30–21:00)',
  night: 'Night (21:00–08:00)',
};

export const CATEGORY_OPTIONS: Category[] = ['SMO','EMO','MO','First Man'];

export const FIRST_MAN_PRIORITY_WARDS = ['3A','7','OPD A','OPD B','OPD C','HTN','DS 15A'];

export const HOLIDAY_CLOSED_WARDS = ['OPD A','OPD B','OPD C','HTN','Cath'];

export const WARD_DISPLAY_LABEL: Record<string, string> = {
  'Observation':'Observation', '3A':'W-3A', '3B':'W-3B', '5A':'W-5A', '5B':'W-5B',
  '5C':'W-5C', '5D':'W-5D', '7':'W-7(CCU-2)', '9':'W-9', '10':'W-10', '12':'W-12', 'HTN':'HTN',
  'Cabin':'Cabin', 'DS 15A':'DS 15A', 'DS 15B':'DS 15B', 'DS 15C':'DS 15C',
  'DS 9A':'DS W-9A', 'DS 9B':'DS W-9B', 'DS 8':'DS W-8',
  'OPD A':'OPD A', 'OPD B':'OPD B', 'OPD C':'OPD C', 'Cath':'Cath Lab'
};

export const SLOT_COMPOSITION: SlotComposition = {
  'Observation': {
    morning: [{ cats: ['EMO'] }, { cats: ['MO'] }],
    evening: [{ cats: ['EMO'] }, { cats: ['MO'] }],
    night: [{ cats: ['EMO'] }],
  },
  '3A': {
    morning: [{ cats: ['SMO'], fallback: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['SMO','EMO'] }],
    evening: [{ cats: ['SMO'], fallback: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['SMO','EMO'] }],
  },
  'DS 15A': {
    morning: [{ cats: ['SMO'], fallback: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['SMO','EMO'] }],
    evening: [{ cats: ['SMO'], fallback: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['SMO','EMO'] }],
  },
  '7': {
    morning: [{ cats: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['First Man','SMO','EMO'] }],
    evening: [{ cats: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['First Man','SMO','EMO'] }],
    night: [{ cats: ['SMO','First Man'] }, { cats: ['MO'], excludeCats: ['First Man','SMO','EMO'] }],
  },
};

export const WARD_DISPLAY_PRIORITY: Record<string, Category[]> = {
  '3A': ['SMO','First Man'],
  '3B': ['SMO'],
  'DS 15A': ['SMO','First Man'],
  'Observation': ['EMO'],
  '7': ['First Man'],
  'OPD A': ['First Man'],
  'OPD B': ['First Man'],
  'OPD C': ['First Man'],
  'HTN': ['First Man'],
};
