export type HolidayType = 'public' | 'substitute' | 'temporary' | 'election' | 'company' | 'manual' | 'laborDay' | 'mock';
export type HolidaySource = 'api' | 'manual' | 'mock';
export type OverrideStatus = 'none' | 'added' | 'edited' | 'deleted';

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  isHoliday: boolean;
  isNonWorkingDay: boolean;
  isSubstituteHoliday: boolean;
  holidayType: HolidayType;
  source: HolidaySource;
  overrideStatus: OverrideStatus;
  memo?: string;
  updatedAt: number; // timestamp
}
