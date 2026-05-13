import { LeaveRecord } from '@/types/leave';
import { Holiday } from '@/types/holiday';
import { getWeekKeyByMonday, addDaysByDateKey, isWeekend } from './dateUtils';

export function isHolidayOrNonWorkingDay(dateKey: string, holidays: Holiday[]): boolean {
  if (isWeekend(dateKey)) return true;
  const holiday = holidays.find(h => h.date === dateKey && h.overrideStatus !== 'deleted');
  if (holiday && (holiday.isHoliday || holiday.isNonWorkingDay || holiday.isSubstituteHoliday)) {
    return true;
  }
  return false;
}

export function groupLeaveRecordsByWeek(records: LeaveRecord[]): Record<string, LeaveRecord[]> {
  const grouped: Record<string, LeaveRecord[]> = {};
  for (const record of records) {
    const weekKey = getWeekKeyByMonday(record.date);
    if (!grouped[weekKey]) grouped[weekKey] = [];
    grouped[weekKey].push(record);
  }
  return grouped;
}

export function getContinuousBlock(seedDate: string, records: LeaveRecord[], holidays: Holiday[]): Set<string> {
  const block = new Set<string>();
  const queue = [seedDate];
  
  const recordDates = new Set(records.map(r => r.date));
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (block.has(current)) continue;
    
    const isLeave = recordDates.has(current);
    const isNonWorking = isHolidayOrNonWorkingDay(current, holidays);
    
    if (isLeave || isNonWorking) {
      block.add(current);
      const prevDay = addDaysByDateKey(current, -1);
      const nextDay = addDaysByDateKey(current, 1);
      
      if (!block.has(prevDay)) queue.push(prevDay);
      if (!block.has(nextDay)) queue.push(nextDay);
    }
  }
  
  return block;
}

export function isConnectedToNonWorkingDay(dateKey: string, records: LeaveRecord[], holidays: Holiday[]): boolean {
  const block = getContinuousBlock(dateKey, records, holidays);
  return Array.from(block).some(d => isHolidayOrNonWorkingDay(d, holidays));
}

export function findConnectedLeaveBlocks(records: LeaveRecord[], holidays: Holiday[]): Set<string>[] {
  const visited = new Set<string>();
  const blocks: Set<string>[] = [];
  
  for (const r of records) {
    if (!visited.has(r.date)) {
      const block = getContinuousBlock(r.date, records, holidays);
      blocks.push(block);
      for (const d of block) visited.add(d);
    }
  }
  return blocks;
}

export function calculateConnectedLeaveUsageByWeek(
  records: LeaveRecord[],
  holidays: Holiday[],
  period: { start: string; end: string }
): number {
  const validRecords = records.filter(r => r.date >= period.start && r.date <= period.end);
  const weeks = groupLeaveRecordsByWeek(validRecords);
  let totalConnections = 0;
  
  const blocks = findConnectedLeaveBlocks(records, holidays); // Use all records for building connections

  for (const [, weekRecords] of Object.entries(weeks)) {
    let hasConnectionInWeek = false;
    for (const record of weekRecords) {
      const block = blocks.find(b => b.has(record.date));
      if (block) {
        const hasNonWorkingDay = Array.from(block).some(d => isHolidayOrNonWorkingDay(d, holidays));
        if (hasNonWorkingDay) {
          hasConnectionInWeek = true;
          break;
        }
      }
    }
    if (hasConnectionInWeek) {
      totalConnections++;
    }
  }

  return totalConnections;
}
