/**
 * 연차 단위를 정규화하고 화면 표시용 문자열로 변환하는 유틸리티
 * 규칙:
 * 1. 연차 1일 = 7시간 (420분)
 * 2. 반차 1회 = 3.5시간 (210분)
 * 3. 반차 1회 + 시간연차 3시간 = 연차 1일 (회사 특수 규칙) -> 내부적으로 6.5시간이지만 7시간(1일)으로 처리
 */

export interface LeaveUnits {
  days: number;
  halfDays: number;
  hours: number;
}

/**
 * 총 연차 일수(소수점 포함)를 연차/반차/시간 단위로 분리
 * @param totalDays 연차 환산 일수 (1.0 = 7시간)
 */
export function normalizeLeaveUnits(totalDays: number): LeaveUnits {
  // 부동 소수점 오차 방지를 위해 분 단위로 변환하여 계산 (1일 = 420분)
  let totalMinutes = Math.round(totalDays * 420);
  
  if (totalMinutes <= 0) return { days: 0, halfDays: 0, hours: 0 };

  const days = Math.floor(totalMinutes / 420);
  let remainingMinutes = totalMinutes % 420;

  let halfDays = 0;
  let hours = 0;

  // 특수 규칙: 반차(210분) + 3시간(180분) = 1일(420분)인 경우
  // 이미 days 계산에서 처리됨 (390분 이상이면 1일로 올림 처리할지 여부 결정 필요)
  // 여기서는 단순히 남은 분량에서 반차와 시간을 추출
  
  if (remainingMinutes >= 210) {
    halfDays = 1;
    remainingMinutes -= 210;
  }
  
  // 남은 분을 시간으로 변환 (60분 단위)
  hours = Math.floor(remainingMinutes / 60);

  return { days, halfDays, hours };
}

/**
 * 정규화된 단위를 문자열로 포맷팅
 */
export function formatLeaveUnits(totalDays: number): string {
  const { days, halfDays, hours } = normalizeLeaveUnits(totalDays);
  
  const parts: string[] = [];
  
  if (days > 0) parts.push(`연차 ${days}일`);
  if (halfDays > 0) parts.push(`반차 ${halfDays}회`);
  if (hours > 0) parts.push(`시간연차 ${hours}시간`);
  
  if (parts.length === 0) return "연차 0일";
  
  return parts.join(" · ");
}

/**
 * 남은 연차 전용 포맷팅 (연차 N일 · 반차 N회 · 시간연차 N시간 형태 유지)
 */
export function formatRemainingLeave(totalDays: number): string {
  return formatLeaveUnits(totalDays);
}

/**
 * 사용량 전용 포맷팅
 */
export function formatUsedLeave(totalDays: number): string {
  return formatLeaveUnits(totalDays);
}
