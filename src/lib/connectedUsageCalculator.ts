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

export function calculateConnectedLeaveUsageByBlock(
  records: LeaveRecord[],
  holidays: Holiday[],
  period: { start: string; end: string }
): number {
  const validRecords = records.filter(r => r.date >= period.start && r.date <= period.end);
  if (validRecords.length === 0) return 0;
  
  const blocks = findConnectedLeaveBlocks(records, holidays);
  let totalConnections = 0;
  
  const validRecordDates = new Set(validRecords.map(r => r.date));
  
  for (const block of blocks) {
    // 1. 해당 구간 안에 현재 연차 기간(period)의 사용 내역이 1개 이상 있는지
    const hasValidLeave = Array.from(block).some(d => validRecordDates.has(d));
    
    // 2. 해당 구간 안에 휴무일이 1개 이상 있는지
    const hasNonWorkingDay = Array.from(block).some(d => isHolidayOrNonWorkingDay(d, holidays));
    
    if (hasValidLeave && hasNonWorkingDay) {
      totalConnections++;
    }
  }

  return totalConnections;
}
