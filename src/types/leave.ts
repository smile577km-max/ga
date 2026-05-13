export type LeaveRecordType = 'full' | 'morningHalf' | 'afternoonHalf' | 'hourly';

export interface LeaveRecord {
  id: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (연차 범위 지정용)
  type: LeaveRecordType;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  deductedMinutes: number;
  deductedDays: number;
  memo?: string;
  isInitial?: boolean; // 앱 사용 전 이미 사용한 연차(초기 입력) 여부
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}
