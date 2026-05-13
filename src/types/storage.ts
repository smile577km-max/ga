import { UserSettings } from './settings';
import { LeaveRecord } from './leave';
import { Holiday } from './holiday';

export interface AppData {
  schemaVersion: number;
  settings: UserSettings;
  leaveRecords: LeaveRecord[];
  holidays: Holiday[];
  cachedHolidays: Holiday[];
  lastSavedAt: number;
}
