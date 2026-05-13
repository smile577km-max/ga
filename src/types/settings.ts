import { LeaveRecord } from './leave';

export type EmploymentStatus = 'regular' | 'intern';
export type IncomeType = 'earned' | 'business'; // 근로소득자 | 사업소득자
export type ResetRule = 'janFirst' | 'hireDate';

export interface UserSettings {
  name: string;
  employmentStatus: EmploymentStatus;
  incomeType: IncomeType;
  resetRule: ResetRule;
  hireDate: string; // YYYY-MM-DD
  manualLeaveAdjustment: number; // 수동 연차 조정값
  monthlyPerfectAttendance: Record<string, boolean>; // YYYY-MM: true/false
  usedLeaveAdjustment: number; // [DEPRECATED] use initialUsed fields instead
  initialUsedDays: number;
  initialUsedHalfDays: number;
  initialUsedHours: number;
  usedConsecutiveLeaveAdjustment: number;
  onboardingCompleted: boolean;
  initialLeaveInputCompleted: boolean;
  initialUsageMode?: 'simple' | 'detailed';
  initialUsageRecords?: LeaveRecord[];
}
