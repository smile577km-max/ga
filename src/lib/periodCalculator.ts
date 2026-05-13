import { UserSettings } from '@/types/settings';
import { parseDateKey, toDateKey } from './dateUtils';

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
  const hireMonth = hireDate.getMonth();
  const hireDay = hireDate.getDate();

  let startYear = currentYear;
  const anniversaryThisYear = new Date(currentYear, hireMonth, hireDay);
  
  if (today < anniversaryThisYear) {
    startYear = currentYear - 1;
  }

  const startDate = new Date(startYear, hireMonth, hireDay);
  const endDate = new Date(startYear + 1, hireMonth, hireDay);
  endDate.setDate(endDate.getDate() - 1); // Previous day of next anniversary

  return {
    start: toDateKey(startDate),
    end: toDateKey(endDate),
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
