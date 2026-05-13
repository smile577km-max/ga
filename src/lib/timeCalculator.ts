import { parseDateKey } from './dateUtils';

export const WORK_START = '09:50';
export const WORK_END = '17:50';
export const LUNCH_START = '11:50';
export const LUNCH_END = '12:50';

export function getFridayWeekOrder(dateKey: string): number {
  const date = parseDateKey(dateKey);
  if (date.getDay() !== 5) return -1; // Not Friday

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  
  // 첫째 주 판단: 수요일이 포함되어 있으면 그 주가 첫째 주.
  // 1일이 수(3), 화(2), 월(1)이면 해당 주 금요일이 1주차 금요일.
  // 1일이 목(4), 금(5), 토(6), 일(0)이면 다음 주 금요일이 1주차 금요일.
  
  let firstFridayDate = 1 + (5 - firstDayOfWeek + 7) % 7;
  if (firstDayOfWeek === 0 || firstDayOfWeek >= 4) {
    firstFridayDate += 7; // The first week Friday is actually the second Friday of the month
  }
  
  const diff = date.getDate() - firstFridayDate;
  if (diff < 0) return 0; // Not part of the official 1st~4th week system (e.g. earlier Friday)
  
  return Math.floor(diff / 7) + 1; // 1, 2, 3, 4...
}

export function getFridayEarlyLeaveEndTime(dateKey: string): string {
  const date = parseDateKey(dateKey);
  if (date.getDay() !== 5) return WORK_END;
  
  const weekOrder = getFridayWeekOrder(dateKey);
  if (weekOrder === 1 || weekOrder === 3) return '17:00';
  if (weekOrder === 2 || weekOrder === 4) return '17:30';
  
  return WORK_END;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function subtractLunchMinutes(startTime: string, endTime: string): number {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const lunchStart = timeToMinutes(LUNCH_START);
  const lunchEnd = timeToMinutes(LUNCH_END);

  let totalMins = endMins - startMins;

  // Subtract lunch time overlap
  const overlapStart = Math.max(startMins, lunchStart);
  const overlapEnd = Math.min(endMins, lunchEnd);
  
  if (overlapStart < overlapEnd) {
    totalMins -= (overlapEnd - overlapStart);
  }

  return totalMins;
}

export function calculateWorkingMinutes(startTime: string, endTime: string, _dateKey: string): number {
  // For standard hourly computation
  return subtractLunchMinutes(startTime, endTime);
}

export function validateHourlyLeaveUnit(minutes: number): boolean {
  // 실제 차감 시간이 1시간 단위일 때만 허용 (30분 단위 등 불가)
  return minutes > 0 && minutes % 60 === 0;
}

export function validateTimeWithinWorkHours(dateKey: string, startTime: string, endTime: string): boolean {
  const earlyLeaveEnd = getFridayEarlyLeaveEndTime(dateKey);
  return startTime >= WORK_START && endTime <= earlyLeaveEnd && startTime < endTime;
}

export function convertMinutesToLeaveDays(minutes: number): number {
  // 일반 시간연차
  // 연차 1일 = 7시간 = 420분
  return Number((minutes / 420).toFixed(2));
}

export function getHalfDayMinutes(): number {
  return 210; // 3.5 hours
}
