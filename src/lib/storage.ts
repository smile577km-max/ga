import { AppData } from '@/types/storage';
import { UserSettings } from '@/types/settings';
import { mockHolidays } from './mockHolidays';

const STORAGE_KEY = 'leave_app_data';
const CURRENT_SCHEMA_VERSION = 1;

export const defaultSettings: UserSettings = {
  name: '',
  employmentStatus: 'regular',
  incomeType: 'earned',
  resetRule: 'janFirst',
  hireDate: '',
  manualLeaveAdjustment: 0,
  monthlyPerfectAttendance: {},
  usedLeaveAdjustment: 0,
  initialUsedDays: 0,
  initialUsedHalfDays: 0,
  initialUsedHours: 0,
  usedConsecutiveLeaveAdjustment: 0,
  onboardingCompleted: false,
  initialLeaveInputCompleted: false,
  initialUsageMode: 'simple',
  initialUsageRecords: [],
};

export const defaultAppData: AppData = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  settings: defaultSettings,
  leaveRecords: [],
  holidays: mockHolidays,
  cachedHolidays: [],
  lastSavedAt: Date.now(),
};

export function loadAppData(): AppData {
  if (typeof window === 'undefined') return defaultAppData;
  
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return defaultAppData;

    const data = JSON.parse(rawData);
    return migrateAppDataIfNeeded(data);
  } catch (error) {
    console.error('Failed to parse app data', error);
    return defaultAppData;
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === 'undefined') return;
  
  try {
    data.lastSavedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save app data', error);
  }
}

export function migrateAppDataIfNeeded(data: unknown): AppData {
  const migratedData = { ...(data as Record<string, unknown>) } as Record<string, unknown>;

  if (!migratedData.schemaVersion) {
    migratedData.schemaVersion = 1;
  }

  const settings = (migratedData.settings || {}) as Record<string, unknown>;
  const today = new Date().toISOString().split('T')[0];
  
  if (!settings.hireDate || (typeof settings.hireDate === 'string' && settings.hireDate.startsWith('0001'))) {
    settings.hireDate = today;
  }

  // Migrate usedLeaveAdjustment to initialUsed fields
  if (typeof settings.usedLeaveAdjustment === 'number' && settings.usedLeaveAdjustment > 0 && 
      settings.initialUsedDays === undefined) {
    const totalDays = settings.usedLeaveAdjustment;
    const days = Math.floor(totalDays);
    let remainder = totalDays - days;
    
    let halfDays = 0;
    let hours = 0;
    
    if (remainder >= 0.5) {
      halfDays = 1;
      remainder -= 0.5;
    }
    
    if (remainder > 0) {
      hours = Math.round(remainder * 7);
    }
    
    settings.initialUsedDays = days;
    settings.initialUsedHalfDays = halfDays;
    settings.initialUsedHours = hours;
  } else {
    if (settings.initialUsedDays === undefined) settings.initialUsedDays = 0;
    if (settings.initialUsedHalfDays === undefined) settings.initialUsedHalfDays = 0;
    if (settings.initialUsedHours === undefined) settings.initialUsedHours = 0;
  }

  if (!settings.initialUsageMode) {
    settings.initialUsageMode = 'simple';
  }
  if (!settings.initialUsageRecords) {
    settings.initialUsageRecords = [];
  }

  migratedData.settings = settings;

  // Move initial records from leaveRecords to settings if needed
  if (migratedData.leaveRecords && Array.isArray(migratedData.leaveRecords)) {
    const records = migratedData.leaveRecords as any[];
    const initials = records.filter(r => r.isInitial);
    if (initials.length > 0) {
      settings.initialUsageRecords = [...(settings.initialUsageRecords as any[]), ...initials];
      migratedData.leaveRecords = records.filter(r => !r.isInitial);
      settings.initialUsageMode = 'detailed';
      migratedData.settings = settings;
    }
  }

  return validateAppData(migratedData) ? (migratedData as unknown as AppData) : defaultAppData;
}

export function validateAppData(data: unknown): boolean {
  // Add validation logic here
  return !!data && typeof data === 'object' && 'schemaVersion' in data;
}

export function resetAppData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
