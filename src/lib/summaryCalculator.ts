import { UserSettings } from '@/types/settings';
import { LeaveRecord } from '@/types/leave';
import { Holiday } from '@/types/holiday';
import { getCurrentLeavePeriod, getNextResetDate, getDaysUntilReset } from './periodCalculator';
import { calculateGrantedDays } from './leaveCalculator';
import { calculateConnectedLeaveUsageByWeek } from './connectedUsageCalculator';
import { convertMinutesToLeaveDays } from './timeCalculator';

export function processLeaveRecords(records: LeaveRecord[]) {
  const byDate: Record<string, LeaveRecord[]> = {};
  for (const r of records) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  }

  let totalDeductedDays = 0;

  for (const date in byDate) {
    const dayRecords = byDate[date];
    let hourlyMins = 0;

    for (const r of dayRecords) {
      if (r.type === 'hourly') {
        hourlyMins += r.deductedMinutes;
      }
    }

    const halfDayCount = dayRecords.filter(r => r.type === 'morningHalf' || r.type === 'afternoonHalf').length;
    const fullDayCount = dayRecords.filter(r => r.type === 'full').length;
    
    if (halfDayCount === 1 && hourlyMins === 180) {
      totalDeductedDays += 1 + fullDayCount;
    } else {
      let dayTotalDays = 0;
      for (const r of dayRecords) {
        if (r.type === 'full') dayTotalDays += 1;
        else if (r.type === 'morningHalf' || r.type === 'afternoonHalf') dayTotalDays += 0.5;
        else if (r.type === 'hourly') dayTotalDays += convertMinutesToLeaveDays(r.deductedMinutes);
      }
      totalDeductedDays += dayTotalDays;
    }
  }

  return totalDeductedDays;
}

export function calculateLeaveSummary(
  settings: UserSettings,
  records: LeaveRecord[],
  holidays: Holiday[],
  todayKey: string
) {
  const period = getCurrentLeavePeriod(settings, todayKey);
  const granted = calculateGrantedDays(settings, todayKey);
  
  const validRecords = records.filter(r => r.date >= period.start && r.date <= period.end);
  
  const recordedUsedDays = processLeaveRecords(validRecords);
  const initialUsedDaysTotal = settings.initialUsedDays + (settings.initialUsedHalfDays * 0.5) + (settings.initialUsedHours / 7);
  const totalUsedDays = initialUsedDaysTotal + recordedUsedDays;
  const remainingDays = granted.actual + settings.manualLeaveAdjustment - totalUsedDays;

  const recordedConnectedUsageCount = calculateConnectedLeaveUsageByWeek(records, holidays, period);
  const totalConnectedUsageCount = settings.usedConsecutiveLeaveAdjustment + recordedConnectedUsageCount;
  const remainingConnectedUsageCount = 10 - totalConnectedUsageCount;

  return {
    totalGrantedDays: granted.total,
    actualGrantedDays: granted.actual,
    projectedGrantedDays: granted.projected,
    initialUsedDays: initialUsedDaysTotal,
    recordedUsedDays,
    totalUsedDays,
    remainingDays,
    initialConnectedUsageCount: settings.usedConsecutiveLeaveAdjustment,
    recordedConnectedUsageCount,
    totalConnectedUsageCount,
    remainingConnectedUsageCount,
    nextResetDate: getNextResetDate(settings, todayKey),
    daysUntilReset: getDaysUntilReset(settings, todayKey),
  };
}
