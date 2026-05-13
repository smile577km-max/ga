import { describe, it, expect } from 'vitest';
import { calculateGrantedDays } from '@/lib/leaveCalculator';
import { UserSettings } from '@/types/settings';

describe('leaveCalculator', () => {
  const baseSettings: UserSettings = {
    name: 'Test',
    employmentStatus: 'regular',
    incomeType: 'earned',
    resetRule: 'hireDate',
    hireDate: '2024-05-12',
    manualLeaveAdjustment: 0,
    monthlyPerfectAttendance: {},
    usedLeaveAdjustment: 0,
    usedConsecutiveLeaveAdjustment: 0,
    onboardingCompleted: true,
    initialLeaveInputCompleted: true,
  };

  it('calculates for business income properly (max 20)', () => {
    // 25 years of service, usually 25 days, but business income is max 20
    const settings = { ...baseSettings, incomeType: 'business' as const, hireDate: '2000-01-01' };
    const result = calculateGrantedDays(settings, '2026-05-12');
    expect(result.total).toBe(20);
  });

  it('calculates 1st year properly with monthly grants', () => {
    // Hired 2026-01-01. Today is 2026-05-12. (less than 1 year)
    // 1st month: Jan (perfect), 2nd: Feb (perfect), 3rd: Mar (perfect), 4th: Apr (perfect)
    const settings = { 
      ...baseSettings, 
      hireDate: '2026-01-01',
      monthlyPerfectAttendance: {
        '2026-01': true,
        '2026-02': true,
        '2026-03': true,
        '2026-04': true,
      }
    };
    const result = calculateGrantedDays(settings, '2026-05-12');
    expect(result.actual).toBe(4);
    // Expected to get 11 days total by Dec 31
    expect(result.projected).toBe(11);
  });

  it('calculates intern properly (max 3)', () => {
    const settings = { 
      ...baseSettings, 
      employmentStatus: 'intern' as const,
      hireDate: '2026-01-01',
      monthlyPerfectAttendance: {
        '2026-01': true,
        '2026-02': true,
      }
    };
    const result = calculateGrantedDays(settings, '2026-03-12');
    expect(result.actual).toBe(2);
    expect(result.projected).toBe(3);
  });
});
