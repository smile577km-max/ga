"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { calculateLeaveSummary } from '@/lib/summaryCalculator';
import { toDateKey, getKoreanDayOfWeek } from '@/lib/dateUtils';
import { getUpcomingWeekdayHolidays, generateMockHolidays } from '@/lib/holidayUtils';
import { formatLeaveUnits } from '@/lib/leaveFormatter';
import { FormattedLeaveUnits } from '@/components/FormattedLeaveUnits';

export default function DashboardPage() {
  const router = useRouter();
  const { appData, isLoaded, updateHolidays } = useAppData();
  const [mounted, setMounted] = useState(false);
  const [showAllHolidays, setShowAllHolidays] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
    if (isLoaded) {
      if (!appData.settings.onboardingCompleted) {
        router.replace('/setup');
      } else if (!appData.settings.initialLeaveInputCompleted) {
        router.replace('/initial-leave');
      }

      // Root fix: Ensure holidays exist for current and next year globally
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const hasCurrentYear = appData.holidays.some(h => h.date.startsWith(`${currentYear}-`));
      const hasNextYear = appData.holidays.some(h => h.date.startsWith(`${nextYear}-`));

      if (!hasCurrentYear || !hasNextYear) {
        const mocks = generateMockHolidays([currentYear, nextYear]);
        const manualHolidays = appData.holidays.filter(h => h.source !== 'mock');
        updateHolidays([...manualHolidays, ...mocks]);
      }
    }
  }, [isLoaded, appData.settings, router, appData.holidays, updateHolidays]);

  if (!isLoaded || !mounted || !appData.settings.initialLeaveInputCompleted) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중...</div>;
  }

  const todayKey = toDateKey(new Date());
  
  const pastRecords = appData.leaveRecords.filter(r => r.date <= todayKey);
  
  const currentSummary = calculateLeaveSummary(appData.settings, pastRecords, appData.holidays, todayKey);
  const expectedSummary = calculateLeaveSummary(appData.settings, appData.leaveRecords, appData.holidays, todayKey);
  
  const upcomingHolidays = getUpcomingWeekdayHolidays({
    holidays: appData.holidays,
    today: todayKey,
    resetDate: expectedSummary.nextResetDate
  });

  const lastSavedDate = new Date(appData.lastSavedAt).toLocaleString('ko-KR');

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-12 font-sans text-[#1d1d1f]">
      <div className="bg-white/80 backdrop-blur-md border-b border-[#e0e0e0] sticky top-0 z-10">
        <div className="max-w-[980px] mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.015em] text-[#1d1d1f]">{appData.settings.name}님의 남은 연차 계산기</h1>
            <p className="text-[14px] text-[#7a7a7a] mt-1 font-normal tracking-tight">계산 기준일: <span className="font-semibold text-[#1d1d1f]">오늘 ({todayKey})</span> | 다음 초기화: <span className="font-semibold text-[#1d1d1f]">{expectedSummary.nextResetDate}</span></p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={() => router.push('/settings')} className="flex-1 md:flex-none px-5 py-2.5 bg-transparent text-[#0066cc] border border-[#0066cc] rounded-full text-[14px] font-normal hover:bg-[#0066cc]/5 transition active:scale-95">내 기준 수정</button>
            <button onClick={() => router.push('/register')} className="flex-1 md:flex-none px-5 py-2.5 bg-[#0066cc] text-white rounded-full text-[14px] font-normal hover:bg-[#0071e3] transition active:scale-95">사용량 반영</button>
          </div>
        </div>
      </div>

      <div className="max-w-[980px] mx-auto mt-10 px-6 space-y-10">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 order-first">
          {/* 남은 연차 카드 */}
          <div className="bg-white p-7 rounded-[18px] border border-[#e0e0e0] flex flex-col relative overflow-hidden group">
            <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-3">
              남은 연차 <span className="text-[14px] font-normal text-[#7a7a7a]">(사용 예정 포함)</span>
            </h2>
            <FormattedLeaveUnits 
              text={formatLeaveUnits(expectedSummary.remainingDays)} 
              colorClass={expectedSummary.remainingDays < 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'} 
              valueClass="text-[40px] tracking-[-0.015em] font-semibold"
            />
            {expectedSummary.remainingDays < 0 && <p className="text-[14px] font-semibold text-[#ff3b30] mt-4">⚠️ 사용할 수 있는 연차를 초과했습니다!</p>}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-[14px] font-normal border-t border-[#e0e0e0] pt-4">
                <span className="text-[#7a7a7a]">현재 사용 완료 기준</span>
                <span className="text-[#1d1d1f] font-semibold">{formatLeaveUnits(currentSummary.remainingDays)}</span>
              </div>
              {appData.settings.hireDate && (new Date(todayKey).getTime() - new Date(appData.settings.hireDate).getTime()) < (365 * 24 * 60 * 60 * 1000) && (
                <div className="text-[14px] text-[#0066cc] font-normal mt-2">
                  1년 미만: 앞으로 추가 발생 가능한 월차 {expectedSummary.projectedGrantedDays}일
                </div>
              )}
            </div>
          </div>

          {/* 총 사용 연차 카드 */}
          <div className="bg-white p-7 rounded-[18px] border border-[#e0e0e0] flex flex-col relative overflow-hidden">
            <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-3">총 사용 연차 <span className="text-[14px] font-normal text-[#7a7a7a]">(예정 포함)</span></h2>
            <FormattedLeaveUnits 
              text={formatLeaveUnits(expectedSummary.totalUsedDays)} 
              colorClass="text-[#1d1d1f]"
              valueClass="text-[40px] tracking-[-0.015em] font-semibold"
            />
            <div className="mt-auto pt-6 border-t border-[#e0e0e0]">
               <div className="flex items-center justify-between text-[14px] font-normal">
                 <span className="text-[#7a7a7a]">현재 사용 완료</span>
                 <span className="text-[#1d1d1f] font-semibold">{formatLeaveUnits(currentSummary.totalUsedDays)}</span>
               </div>
            </div>
          </div>

          {/* 남은 연휴·공휴일 연결 횟수 카드 */}
          <div className="bg-white p-7 rounded-[18px] border border-[#e0e0e0] flex flex-col relative overflow-hidden">
            <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-3">남은 연결 횟수</h2>
            <div className="flex items-baseline gap-1 mt-1">
              <p className={`text-[40px] font-semibold tracking-[-0.015em] ${expectedSummary.remainingConnectedUsageCount < 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>{expectedSummary.remainingConnectedUsageCount}</p>
              <span className={`text-[21px] font-semibold ${expectedSummary.remainingConnectedUsageCount < 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>회</span>
            </div>
            {expectedSummary.remainingConnectedUsageCount < 0 && <p className="text-[14px] font-semibold text-[#ff3b30] mt-4">⚠️ 연결 사용 횟수를 초과했습니다!</p>}
            <div className="mt-auto pt-6 border-t border-[#e0e0e0]">
               <div className="flex items-center justify-between text-[14px] font-normal">
                 <span className="text-[#7a7a7a]">총 보유 연차</span>
                 <span className="text-[#1d1d1f] font-semibold">{formatLeaveUnits(expectedSummary.actualGrantedDays + appData.settings.manualLeaveAdjustment)}</span>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 연휴·공휴일 연결 현황 */}
          <div className="bg-white p-7 rounded-[18px] border border-[#e0e0e0] flex flex-col">
            <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-6">연결 사용 현황</h2>
            
            <div className="bg-[#f5f5f7] p-6 rounded-[11px] mb-6 flex flex-col justify-center items-center">
              <p className="text-[14px] text-[#7a7a7a] font-normal mb-1">총 사용(예정) 횟수</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[40px] font-semibold text-[#1d1d1f] tracking-[-0.015em]">{expectedSummary.totalConnectedUsageCount}</span>
                <span className="text-[#1d1d1f] text-[21px] font-semibold">회</span>
              </div>
            </div>

            <div className="space-y-4 text-[14px] text-[#1d1d1f] border-t border-[#e0e0e0] pt-6 mt-auto">
              <div className="flex justify-between items-center">
                <span className="font-normal text-[#7a7a7a]">직접 입력한 연결 횟수</span>
                <span className="font-semibold text-[#1d1d1f]">{expectedSummary.initialConnectedUsageCount}회</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-normal text-[#7a7a7a]">사용 내역 계산 연결 횟수</span>
                <span className="font-semibold text-[#1d1d1f]">{expectedSummary.recordedConnectedUsageCount}회</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* 상세 연차 기록 */}
            <div className="bg-white p-7 rounded-[18px] border border-[#e0e0e0]">
              <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-5">상세 연차 기록</h2>
              <ul className="space-y-3 text-[14px] text-[#1d1d1f]">
                <li className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#f5f5f7] rounded-[11px] gap-2">
                  <span className="font-normal text-[#7a7a7a]">초기 입력 사용량</span> 
                  <FormattedLeaveUnits text={formatLeaveUnits(expectedSummary.initialUsedDays)} />
                </li>
                <li className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#f5f5f7] rounded-[11px] gap-2">
                  <span className="font-normal text-[#7a7a7a]">이후 입력 사용량</span> 
                  <FormattedLeaveUnits text={formatLeaveUnits(expectedSummary.recordedUsedDays)} />
                </li>
              </ul>
              <button onClick={() => router.push('/history')} className="w-full mt-6 py-3 text-[14px] font-normal text-[#0066cc] bg-transparent border border-[#0066cc] hover:bg-[#0066cc]/5 rounded-full transition">
                전체 연차 기록 보기
              </button>
            </div>

            {/* 다가오는 휴무일 */}
            <div className="bg-white p-7 rounded-[18px] border border-[#e0e0e0]">
              <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-5">다가오는 휴무일 <span className="text-[14px] font-normal text-[#7a7a7a]">(주말 제외)</span></h2>
              
              <div className="space-y-3">
                {appData.holidays.length === 0 ? (
                  <div className="p-5 bg-[#f5f5f7] text-[#7a7a7a] rounded-[11px] text-[14px] text-center">
                    <p className="font-normal">공휴일 데이터가 없어 휴무일을 표시할 수 없습니다.</p>
                  </div>
                ) : upcomingHolidays.length === 0 ? (
                  <div className="p-5 bg-[#f5f5f7] text-[#7a7a7a] rounded-[11px] text-[14px] text-center">
                    <p className="font-normal">다음 초기화일 전까지 표시할 평일 휴무일이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    {(showAllHolidays ? upcomingHolidays : upcomingHolidays.slice(0, 5)).map((h, idx) => {
                      const dt = new Date(h.date);
                      const dayName = getKoreanDayOfWeek(h.date);
                      const dDay = Math.ceil((dt.getTime() - new Date(todayKey).getTime()) / (1000 * 60 * 60 * 24));
                      
                      let typeLabel = '휴무일';
                      if (h.isSubstituteHoliday) typeLabel = '대체공휴일';
                      else if (h.holidayType === 'laborDay') typeLabel = '근로자의 날';
                      else if (h.holidayType === 'company') typeLabel = '회사 휴무일';
                      else if (h.holidayType === 'public') typeLabel = '법정 공휴일';
                      else if (h.holidayType === 'election') typeLabel = '선거일 공휴일';

                      return (
                        <div key={idx} className="p-4 border-b border-[#e0e0e0] last:border-0 bg-transparent flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-normal text-[#7a7a7a] mb-1">
                              {h.date.replace(/-/g, '.')} {dayName}요일
                            </div>
                            <div className="text-[14px] text-[#1d1d1f] font-semibold">{h.name || typeLabel}</div>
                          </div>
                          <div className="text-right">
                            <span className={`text-[12px] font-normal ${dDay <= 7 ? 'text-[#ff3b30]' : 'text-[#7a7a7a]'}`}>
                              D-{dDay === 0 ? 'Day' : dDay}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {upcomingHolidays.length > 5 && (
                      <button 
                        onClick={() => setShowAllHolidays(!showAllHolidays)}
                        className="w-full mt-4 py-3 text-[14px] font-normal text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e0e0e0] rounded-full transition"
                      >
                        {showAllHolidays ? '접기' : `전체 보기 (${upcomingHolidays.length}개)`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 시스템 상태 */}
            <div className="bg-[#272729] p-7 rounded-[18px] text-white">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#ffffff]">System</h2>
                <div className="flex gap-4">
                  <button onClick={() => router.push('/calendar')} className="text-[14px] font-normal text-[#2997ff] hover:underline transition">캘린더</button>
                  <button onClick={() => router.push('/holidays')} className="text-[14px] font-normal text-[#2997ff] hover:underline transition">휴무일 관리</button>
                </div>
              </div>
              <p className="text-[#ffffff] font-normal text-[14px] mb-1">✓ 자동 저장됨</p>
              <p className="text-[#cccccc] text-[12px] font-normal mb-5">마지막 저장: {lastSavedDate}</p>
              
              <p className="text-[12px] text-[#cccccc] leading-relaxed bg-[#333333] p-4 rounded-[11px]">
                이 기기에 저장된 데이터입니다. 다른 기기에서 사용하려면 설정 화면에서 JSON 백업 파일을 내보내세요.
              </p>
              <div className="mt-5 flex gap-3">
                 <button onClick={() => router.push('/settings')} className="flex-1 py-3 bg-[#333333] hover:bg-[#444444] rounded-full text-[14px] font-normal transition text-center text-[#ffffff]">데이터 관리 / 설정</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
