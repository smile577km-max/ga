import { describe, it, expect } from 'vitest';
import { calculateConnectedLeaveUsageByWeek } from '@/lib/connectedUsageCalculator';
import { LeaveRecord } from '@/types/leave';
import { Holiday } from '@/types/holiday';

describe('connectedUsageCalculator', () => {
  const period = { start: '2026-01-01', end: '2026-12-31' };
  const mockHolidays: Holiday[] = [
    {
      id: 'h1', date: '2026-05-01', name: '회사 지정 휴무일',
      isHoliday: false, isNonWorkingDay: true, isSubstituteHoliday: false,
      holidayType: 'company', source: 'manual', overrideStatus: 'none', updatedAt: 0
    },
    {
      id: 'h2', date: '2026-05-05', name: '어린이날',
      isHoliday: true, isNonWorkingDay: true, isSubstituteHoliday: false,
      holidayType: 'public', source: 'api', overrideStatus: 'none', updatedAt: 0
    },
    {
      id: 'h3', date: '2026-05-06', name: '대체공휴일',
      isHoliday: true, isNonWorkingDay: true, isSubstituteHoliday: true,
      holidayType: 'substitute', source: 'api', overrideStatus: 'none', updatedAt: 0
    }
  ];

  it('should calculate 2 counts for 4/30, 5/4, 5/6 usages', () => {
    const records: LeaveRecord[] = [
      { id: '1', date: '2026-04-30', type: 'full', deductedDays: 1, deductedMinutes: 420, createdAt: 0, updatedAt: 0 },
      { id: '2', date: '2026-05-04', type: 'full', deductedDays: 1, deductedMinutes: 420, createdAt: 0, updatedAt: 0 },
      { id: '3', date: '2026-05-06', type: 'full', deductedDays: 1, deductedMinutes: 420, createdAt: 0, updatedAt: 0 },
    ];
    // Week 1 (4/27-5/3): 4/30 connects to 5/1(company), 5/2, 5/3(weekend). -> Count 1
    // Week 2 (5/4-5/10): 5/4 connects to 5/5(public), which connects to 5/6. -> Count 1
    // Total = 2
    expect(calculateConnectedLeaveUsageByWeek(records, mockHolidays, period)).toBe(2);
  });

  it('should not connect if there is a working day in between', () => {
    const records: LeaveRecord[] = [
      { id: '1', date: '2026-05-13', type: 'full', deductedDays: 1, deductedMinutes: 420, createdAt: 0, updatedAt: 0 }
    ];
    // 5/13 is Wed. 5/14, 5/15 are working days. Not connected to weekend.
    expect(calculateConnectedLeaveUsageByWeek(records, mockHolidays, period)).toBe(0);
  });

  it('should calculate 1 for substitute holiday adjacent', () => {
    // 5/6 is substitute holiday
    const records: LeaveRecord[] = [
      { id: '1', date: '2026-05-07', type: 'full', deductedDays: 1, deductedMinutes: 420, createdAt: 0, updatedAt: 0 }
    ];
    // 5/7 is adjacent to 5/6 (substitute holiday). It SHOULD connect!
    expect(calculateConnectedLeaveUsageByWeek(records, mockHolidays, period)).toBe(1);
  });
});
