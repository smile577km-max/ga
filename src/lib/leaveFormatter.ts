/**
 * 연차 단위를 정규화하고 화면 표시용 문자열로 변환하는 유틸리티
 * 규칙:
 * 1. 연차 1일 = 7시간 (420분)
 * 2. 반차 1회 = 3.5시간 (210분)
 * 3. 반차 1회 + 시간연차 3시간 = 연차 1일 (회사 특수 규칙) -> 내부적으로 6.5시간이지만 7시간(1일)으로 처리
 */

export interface LeaveUnits {
  days: number;
  hours: number;
}

/**
 * 총 연차 일수(소수점 포함)를 연차/시간 단위로 분리 (1일 = 7시간 기준)
 * @param totalDays 연차 환산 일수 (1.0 = 7시간)
 */
export function normalizeLeaveUnits(totalDays: number): LeaveUnits {
  // 부동 소수점 오차 방지를 위해 총 시간(hours)으로 변환 후 반올림
  const totalHours = Math.round(totalDays * 7);
  
  if (totalHours <= 0) return { days: 0, hours: 0 };

  const days = Math.floor(totalHours / 7);
  const hours = totalHours % 7;

  return { days, hours };
}

/**
 * 정규화된 단위를 문자열로 포맷팅
 */
export function formatLeaveUnits(totalDays: number): string {
  if (totalDays === 0.5) return "반차 1회";
  if (totalDays === 0) return "차감 없음";

  const totalHours = totalDays * 7;
  const days = Math.floor(totalDays);
  const remainingHours = (totalDays - days) * 7;
  
  const parts: string[] = [];
  
  if (days > 0) parts.push(`연차 ${days}일`);
  
  if (remainingHours > 0) {
    if (remainingHours === 3.5) {
      parts.push("반차 1회");
    } else {
      parts.push(`시간연차 ${Math.round(remainingHours)}시간`);
    }
  }
  
  if (parts.length === 0) return "차감 없음";
  
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
