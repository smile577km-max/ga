import { describe, it, expect } from 'vitest';
import { 
  subtractLunchMinutes, 
  validateHourlyLeaveUnit, 
  validateTimeWithinWorkHours,
  convertMinutesToLeaveDays,
  getFridayEarlyLeaveEndTime,
  getFridayWeekOrder
} from '@/lib/timeCalculator';

describe('timeCalculator', () => {
  it('subtractLunchMinutes: should subtract lunch time if overlapping', () => {
    // 09:50 ~ 11:50
    expect(subtractLunchMinutes('09:50', '11:50')).toBe(120);
    // 11:00 ~ 13:00 (120 mins - 60 mins lunch = 60 mins)
    expect(subtractLunchMinutes('11:00', '13:00')).toBe(60);
    // 16:30 ~ 17:30
    expect(subtractLunchMinutes('16:30', '17:30')).toBe(60);
  });

  it('validateHourlyLeaveUnit: should only allow 1-hour units', () => {
    expect(validateHourlyLeaveUnit(60)).toBe(true);
    expect(validateHourlyLeaveUnit(120)).toBe(true);
    expect(validateHourlyLeaveUnit(30)).toBe(false);
    expect(validateHourlyLeaveUnit(90)).toBe(false);
  });

  it('convertMinutesToLeaveDays: should convert to days', () => {
    // 2 hours = 120 mins -> 120 / 420 = 0.2857 -> 0.29
    expect(convertMinutesToLeaveDays(120)).toBe(0.29);
    // 1 day = 420 mins -> 1
    expect(convertMinutesToLeaveDays(420)).toBe(1);
  });

  it('getFridayWeekOrder & getFridayEarlyLeaveEndTime: should calculate friday exits correctly', () => {
    // 2026-05-01 is Friday. May 1 is Friday. 
    // Is it first week? Wednesday was April 29. 
    // First day of May is Friday (5). Thus next week is 1st week Friday.
    // So 2026-05-01 is 0th week (not early leave).
    expect(getFridayWeekOrder('2026-05-01')).toBe(0);
    expect(getFridayEarlyLeaveEndTime('2026-05-01')).toBe('17:50');
    
    // 2026-05-08 is Friday. It's the 1st week.
    expect(getFridayWeekOrder('2026-05-08')).toBe(1);
    expect(getFridayEarlyLeaveEndTime('2026-05-08')).toBe('17:00');

    // 2026-05-15 is 2nd week Friday
    expect(getFridayWeekOrder('2026-05-15')).toBe(2);
    expect(getFridayEarlyLeaveEndTime('2026-05-15')).toBe('17:30');
    
    // Test a month where 1st is Wednesday: 2025-01-01 is Wed.
    // 2025-01-03 is Friday. It should be 1st week.
    expect(getFridayWeekOrder('2025-01-03')).toBe(1);
    expect(getFridayEarlyLeaveEndTime('2025-01-03')).toBe('17:00');
  });

  it('validateTimeWithinWorkHours: should validate considering early exit', () => {
    expect(validateTimeWithinWorkHours('2026-05-08', '09:50', '17:00')).toBe(true);
    // Over the limit for 1st week friday
    expect(validateTimeWithinWorkHours('2026-05-08', '09:50', '17:30')).toBe(false);
  });
});
