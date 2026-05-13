import { describe, it, expect } from 'vitest';
import { processLeaveRecords } from '@/lib/summaryCalculator';
import { LeaveRecord } from '@/types/leave';

describe('summaryCalculator', () => {
  it('should calculate exactly 1 day for 1 half-day + 3 hours hourly', () => {
    const records: LeaveRecord[] = [
      { id: '1', date: '2026-05-12', type: 'morningHalf', deductedDays: 0.5, deductedMinutes: 210, createdAt: 0, updatedAt: 0 },
      { id: '2', date: '2026-05-12', type: 'hourly', deductedDays: 0, deductedMinutes: 180, createdAt: 0, updatedAt: 0 },
    ];
    expect(processLeaveRecords(records)).toBe(1);
  });

  it('should calculate independently if half-day + 2 hours hourly', () => {
    const records: LeaveRecord[] = [
      { id: '1', date: '2026-05-12', type: 'morningHalf', deductedDays: 0.5, deductedMinutes: 210, createdAt: 0, updatedAt: 0 },
      { id: '2', date: '2026-05-12', type: 'hourly', deductedDays: 0, deductedMinutes: 120, createdAt: 0, updatedAt: 0 },
    ];
    // 0.5 + 0.29 = 0.79
    expect(processLeaveRecords(records)).toBeCloseTo(0.79, 2);
  });

  it('should calculate 0.5 for Friday early leave half-day', () => {
    const records: LeaveRecord[] = [
      { id: '1', date: '2026-05-08', type: 'afternoonHalf', deductedDays: 0.5, deductedMinutes: 210, createdAt: 0, updatedAt: 0 },
    ];
    expect(processLeaveRecords(records)).toBe(0.5);
  });
});
