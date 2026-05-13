import { Holiday } from '@/types/holiday';
import { LeaveRecord } from '@/types/leave';
import { UserSettings } from '@/types/settings';
import { getCurrentLeavePeriod } from './periodCalculator';
import { toDateKey, addDaysByDateKey, parseDateKey } from './dateUtils';
import { isHolidayOrNonWorkingDay } from './connectedUsageCalculator';
import { calculateLeaveSummary } from './summaryCalculator';

export interface LeaveRecommendation {
  date: string; // "YYYY-MM-DD" or "YYYY-MM-DD ~ YYYY-MM-DD"
  reason: string;
  recommendedType: 'full';
  expectedDeductionDays: number;
  expectedRestDays: number;
  consumesConnection: boolean;
  connectedHolidayName: string;
  score: number;
  disabledReason?: string;
  startDateKey: string;
}

export function generateRecommendations(
  settings: UserSettings,
  records: LeaveRecord[],
  holidays: Holiday[],
  todayKey: string
): LeaveRecommendation[] {
  const period = getCurrentLeavePeriod(settings, todayKey);
  const summary = calculateLeaveSummary(settings, records, holidays, todayKey);
  
  const recommendations: LeaveRecommendation[] = [];
  
  const start = new Date(Math.max(parseDateKey(period.start).getTime(), parseDateKey(todayKey).getTime()));
  const actualEnd = parseDateKey(period.end);

  const recordDates = new Set(records.map(r => r.date));
  const isOffDay = (dateKey: string) => isHolidayOrNonWorkingDay(dateKey, holidays) || recordDates.has(dateKey);

  // 1. Find all non-weekend holidays in the lookahead period
  const anchorHolidays: Holiday[] = [];
  for (const h of holidays) {
    if (h.date < toDateKey(start) || h.date > toDateKey(actualEnd)) continue;
    const dt = parseDateKey(h.date);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    if (!isWeekend) {
      anchorHolidays.push(h);
    }
  }

  console.log('--- Recommend Debug ---');
  console.log(`Found anchor holidays: ${anchorHolidays.length}`);

  let proposalCount = 0;

  // 2. For each anchor, generate proposals looking BACK and FORWARD
  for (const anchor of anchorHolidays) {
    // Check BACK 1-3 days
    for (let len = 1; len <= 3; len++) {
      const seqKeys: string[] = [];
      let tempD = addDaysByDateKey(anchor.date, -1);
      let isValidSeq = true;
      
      // Collect `len` working days backwards
      for (let i = 0; i < len; i++) {
        // Skip existing off-days
        while (isOffDay(tempD)) {
          // If we hit an off-day, we just include it as part of the continuous block, but it doesn't count towards the `len` requested days
          // Wait, the prompt says "공휴일 전 평일 1~3일 사용". So we just need to find continuous working days.
          // If it's already an off day, we can just skip it, but actually, it's better to just check exactly the immediate `len` days before.
          tempD = addDaysByDateKey(tempD, -1);
        }
        seqKeys.unshift(tempD); // add to front to maintain chronological order
        tempD = addDaysByDateKey(tempD, -1);
      }
      
      // Actually, a simpler way: just take the exact N days before the anchor.
      // If any of those days is already an off day, this sequence is invalid (we shouldn't recommend taking leave on an off day).
      let seqValid = true;
      let checkStr = addDaysByDateKey(anchor.date, -1);
      const exactSeqKeys: string[] = [];
      for (let i = 0; i < len; i++) {
        if (isOffDay(checkStr)) {
          seqValid = false;
          break;
        }
        exactSeqKeys.unshift(checkStr);
        checkStr = addDaysByDateKey(checkStr, -1);
      }

      if (seqValid && exactSeqKeys.length > 0 && exactSeqKeys[0] >= toDateKey(start)) {
        proposalCount++;
        evaluateProposal(exactSeqKeys, anchor, 'before', len);
      }
    }

    // Check FORWARD 1-3 days
    for (let len = 1; len <= 3; len++) {
      let seqValid = true;
      let checkStr = addDaysByDateKey(anchor.date, 1);
      const exactSeqKeys: string[] = [];
      for (let i = 0; i < len; i++) {
        if (isOffDay(checkStr)) {
          seqValid = false;
          break;
        }
        exactSeqKeys.push(checkStr);
        checkStr = addDaysByDateKey(checkStr, 1);
      }

      if (seqValid && exactSeqKeys.length > 0 && exactSeqKeys[exactSeqKeys.length - 1] <= toDateKey(actualEnd)) {
        proposalCount++;
        evaluateProposal(exactSeqKeys, anchor, 'after', len);
      }
    }
  }

  console.log(`Generated proposals: ${proposalCount}`);

  function evaluateProposal(seqKeys: string[], anchor: Holiday, direction: 'before' | 'after', len: number) {
    const seqStartKey = seqKeys[0];
    const seqEndKey = seqKeys[seqKeys.length - 1];

    let expectedRestDays = len;
    let checkDate = addDaysByDateKey(seqStartKey, -1);
    
    // Look back from start
    while (isOffDay(checkDate)) {
      expectedRestDays++;
      checkDate = addDaysByDateKey(checkDate, -1);
    }
    
    // Look forward from end
    checkDate = addDaysByDateKey(seqEndKey, 1);
    while (isOffDay(checkDate)) {
      expectedRestDays++;
      checkDate = addDaysByDateKey(checkDate, 1);
    }

    if (expectedRestDays < 3) return; // Not a long weekend
    
    const holidayName = anchor.name || '공휴일';
    
    let reason = '';
    if (direction === 'before') {
      reason = `${holidayName} 전 평일을 사용하면 주말부터 공휴일까지 길게 쉴 수 있습니다.`;
    } else {
      reason = `${holidayName} 후 평일을 사용하면 주말까지 이어서 쉴 수 있습니다.`;
    }

    let score = expectedRestDays * 10 - (len * 5);
    let disabledReason = undefined;

    const consumesConnection = true;

    if (summary.remainingDays < len) {
      disabledReason = '남은 연차가 부족합니다.';
      score -= 1000;
    }
    
    if (consumesConnection && summary.remainingConnectedUsageCount <= 0) {
      disabledReason = '연휴·공휴일 연결 횟수가 부족합니다.';
      score -= 1000;
    }

    const dateStr = len === 1 ? seqStartKey : `${seqStartKey} ~ ${seqEndKey}`;

    recommendations.push({
      date: dateStr,
      startDateKey: seqStartKey,
      reason,
      recommendedType: 'full',
      expectedDeductionDays: len,
      expectedRestDays,
      consumesConnection,
      connectedHolidayName: holidayName,
      score,
      disabledReason
    });
  }

  console.log(`Valid filtered recommendations before dedup: ${recommendations.length}`);

  // Deduplicate by startDateKey
  const bestByStart = new Map<string, LeaveRecommendation>();
  for (const r of recommendations) {
    const existing = bestByStart.get(r.startDateKey);
    if (!existing || r.score > existing.score) {
      bestByStart.set(r.startDateKey, r);
    }
  }

  const finalRecs = Array.from(bestByStart.values())
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score; // Highest score first
      if (a.startDateKey !== b.startDateKey) return a.startDateKey.localeCompare(b.startDateKey); // Earliest date first
      return a.expectedDeductionDays - b.expectedDeductionDays; // Less usage first
    })
    .slice(0, 3);
    
  console.log(`Final recommendations returned: ${finalRecs.length}`);
  console.log('-------------------------');

  return finalRecs;
}
