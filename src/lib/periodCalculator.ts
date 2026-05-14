import { UserSettings } from '@/types/settings';
import { parseDateKey, toDateKey, addDaysByDateKey } from './dateUtils';

export function getCurrentLeavePeriod(settings: UserSettings, todayKey: string): { start: string; end: string } {
  const today = parseDateKey(todayKey);
  const currentYear = today.getFullYear();

  if (settings.resetRule === 'janFirst') {
    return {
      start: `${currentYear}-01-01`,
      end: `${currentYear}-12-31`,
    };
  }

  // hireDate basis
  if (!settings.hireDate) {
    // Fallback if no hire date
    return {
      start: `${currentYear}-01-01`,
      end: `${currentYear}-12-31`,
    };
  }

  const hireDate = parseDateKey(settings.hireDate);
  const hireMonth = hireDate.getMonth() + 1; // 1-based
  const hireDay = hireDate.getDate();

  let startYear = currentYear;
  // Use parseDateKey format to ensure KST
  const anniversaryThisYearStr = `${currentYear}-${hireMonth.toString().padStart(2, '0')}-${hireDay.toString().padStart(2, '0')}`;
  const anniversaryThisYear = parseDateKey(anniversaryThisYearStr);
  
  if (today < anniversaryThisYear) {
    startYear = currentYear - 1;
  }

  const cycleStartDate = `${startYear}-${hireMonth.toString().padStart(2, '0')}-${hireDay.toString().padStart(2, '0')}`;
  const cycleEndDate = `${startYear + 1}-${hireMonth.toString().padStart(2, '0')}-${hireDay.toString().padStart(2, '0')}`;

  return {
    start: cycleStartDate,
    end: addDaysByDateKey(cycleEndDate, -1),
  };
}

export function getNextResetDate(settings: UserSettings, todayKey: string): string {
  const period = getCurrentLeavePeriod(settings, todayKey);
  const endDate = parseDateKey(period.end);
  endDate.setDate(endDate.getDate() + 1);
  return toDateKey(endDate);
}

export function getDaysUntilReset(settings: UserSettings, todayKey: string): number {
  const nextReset = getNextResetDate(settings, todayKey);
  const nextResetDate = parseDateKey(nextReset);
  const today = parseDateKey(todayKey);
  
  const diffTime = nextResetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isDateInCurrentPeriod(dateKey: string, period: { start: string; end: string }): boolean {
  return dateKey >= period.start && dateKey <= period.end;
}

export function getCurrentLeaveCycle(settings: UserSettings, todayKey: string): { cycleStartDate: string; cycleEndDate: string } {
  const period = getCurrentLeavePeriod(settings, todayKey);
  const cycleStartDate = period.start;
  // cycleEndDate is inclusive in my logic (12-31), but user asked for exclusive (01-01)
  // I will return the next reset date as the exclusive end date.
  const cycleEndDate = getNextResetDate(settings, todayKey);
  return { cycleStartDate, cycleEndDate };
}

export function getConnectedUsageCycle(todayKey: string): { cycleStartDate: string; cycleEndDate: string } {
  const today = parseDateKey(todayKey);
  const currentYear = today.getFullYear();
  return {
    cycleStartDate: `${currentYear}-01-01`,
    cycleEndDate: `${currentYear + 1}-01-01`,
  };
}
