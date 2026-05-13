/**
 * 모든 날짜는 한국 시간 (Asia/Seoul) 기준의 YYYY-MM-DD 문자열로 관리합니다.
 */

export function getTodayDateKeyInKorea(): string {
  const today = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(today.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0];
}

export function toDateKey(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    const today = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(today.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
  }
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0];
}

export function parseDateKey(dateKey: string): Date {
  if (!dateKey || typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateKey)) {
    return new Date(); // Fallback to today
  }
  // YYYY-MM-DDT00:00:00+09:00
  const d = new Date(`${dateKey}T00:00:00+09:00`);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

export function isSameDateKey(a: string, b: string): boolean {
  return a === b;
}

export function addDaysByDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function getKoreanDayOfWeek(dateKey: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = parseDateKey(dateKey);
  return days[date.getDay()];
}

export function getWeekKeyByMonday(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  return toDateKey(monday);
}

export function getWeekRangeMondayToSunday(dateKey: string): { start: string; end: string } {
  const monday = getWeekKeyByMonday(dateKey);
  const sunday = addDaysByDateKey(monday, 6);
  return { start: monday, end: sunday };
}

export function isWeekend(dateKey: string): boolean {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}
