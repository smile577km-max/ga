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
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{appData.settings.name}님의 남은 연차 계산기</h1>
            <p className="text-sm text-gray-500 mt-0.5">계산 기준일: <span className="font-medium text-gray-700">오늘 ({todayKey})</span> | 다음 초기화: <span className="font-medium text-gray-700">{expectedSummary.nextResetDate}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/register')} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition active:scale-95">사용량 반영</button>
            <button onClick={() => router.push('/settings')} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition active:scale-95">내 기준 수정</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-8 px-6 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 order-first">
          <div className={`bg-white p-6 rounded-2xl shadow-sm border flex flex-col relative overflow-hidden group ${expectedSummary.remainingDays < 0 ? 'border-red-500 bg-red-50/50' : 'border-gray-100'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${expectedSummary.remainingDays < 0 ? 'bg-red-500' : 'bg-blue-500'}`}></div>
            <h2 className={`text-sm font-semibold mb-2 ${expectedSummary.remainingDays < 0 ? 'text-red-700' : 'text-gray-500'}`}>
              남은 연차 <span className="text-xs font-normal">(사용 예정 포함)</span>
            </h2>
            <FormattedLeaveUnits 
              text={formatLeaveUnits(expectedSummary.remainingDays)} 
              colorClass={expectedSummary.remainingDays < 0 ? 'text-red-600' : 'text-blue-600'} 
              valueClass="text-2xl"
            />
            {expectedSummary.remainingDays < 0 && <p className="text-xs font-bold text-red-600 mt-3">⚠️ 사용할 수 있는 연차를 초과했습니다!</p>}
            <div className="mt-4 space-y-1">
              <p className="text-xs text-gray-400 font-medium">현재 사용 완료 기준: {formatLeaveUnits(currentSummary.remainingDays)}</p>
              {appData.settings.hireDate && (new Date(todayKey).getTime() - new Date(appData.settings.hireDate).getTime()) < (365 * 24 * 60 * 60 * 1000) && (
                <p className="text-xs text-blue-500 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded">
                  참고: 앞으로 추가 발생 가능한 월차 {expectedSummary.projectedGrantedDays}일
                </p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gray-300"></div>
            <h2 className="text-gray-500 text-sm font-semibold mb-2">총 사용 (예정) 연차</h2>
            <FormattedLeaveUnits 
              text={formatLeaveUnits(expectedSummary.totalUsedDays)} 
              colorClass="text-gray-800" 
            />
            <p className="text-xs text-gray-400 mt-4 font-medium">현재 사용 완료: {formatLeaveUnits(currentSummary.totalUsedDays)}</p>
          </div>

          <div className={`bg-white p-6 rounded-2xl shadow-sm border flex flex-col relative overflow-hidden ${expectedSummary.remainingConnectedUsageCount < 0 ? 'border-red-500 bg-red-50/50' : 'border-gray-100'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${expectedSummary.remainingConnectedUsageCount < 0 ? 'bg-red-500' : 'bg-purple-400'}`}></div>
            <h2 className={`text-sm font-semibold mb-1 ${expectedSummary.remainingConnectedUsageCount < 0 ? 'text-red-700' : 'text-gray-500'}`}>남은 연휴·공휴일 연결 횟수</h2>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-black tracking-tight ${expectedSummary.remainingConnectedUsageCount < 0 ? 'text-red-600' : 'text-purple-700'}`}>{expectedSummary.remainingConnectedUsageCount}</p>
              <span className={`font-medium ${expectedSummary.remainingConnectedUsageCount < 0 ? 'text-red-500' : 'text-purple-600'}`}>회</span>
            </div>
            {expectedSummary.remainingConnectedUsageCount < 0 && <p className="text-xs font-bold text-red-600 mt-2">⚠️ 연휴·공휴일 연결 사용 횟수를 초과했습니다!</p>}
            <p className="text-xs text-gray-400 mt-3 font-medium">총 보유 연차: {formatLeaveUnits(expectedSummary.actualGrantedDays + appData.settings.manualLeaveAdjustment)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800">연휴·공휴일 연결 현황</h2>
              <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Rule</span>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
              <p className="text-xs text-gray-500 font-semibold mb-1">총 사용(예정) 횟수</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-700">{expectedSummary.totalConnectedUsageCount}</span>
                <span className="text-gray-500 text-sm font-medium">회</span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600 border-t border-gray-100 pt-5">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span> 직접 입력한 앱 사용 전 연결 횟수</span>
                <span className="font-semibold text-gray-800">{expectedSummary.initialConnectedUsageCount}회</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> 사용 내역에서 계산된 연결 횟수</span>
                <span className="font-semibold text-gray-800">{expectedSummary.recordedConnectedUsageCount}회</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-5">상세 연차 기록</h2>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                  <span className="font-medium text-gray-700">초기 입력 사용량</span> 
                  <FormattedLeaveUnits text={formatLeaveUnits(expectedSummary.initialUsedDays)} />
                </li>
                <li className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                  <span className="font-medium text-gray-700">이후 입력 사용량</span> 
                  <FormattedLeaveUnits text={formatLeaveUnits(expectedSummary.recordedUsedDays)} />
                </li>
              </ul>
              <button onClick={() => router.push('/history')} className="w-full mt-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-100">
                전체 연차 기록 보기 &rarr;
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold text-gray-800">다가오는 휴무일</h2>
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">주말 제외</span>
              </div>
              
              <div className="space-y-4">
                {appData.holidays.length === 0 ? (
                  <div className="p-4 bg-gray-50 text-gray-500 rounded-lg text-sm text-center border border-gray-100">
                    <p className="font-semibold text-gray-700 mb-1">공휴일 데이터가 없어 휴무일을 표시할 수 없습니다.</p>
                  </div>
                ) : upcomingHolidays.length === 0 ? (
                  <div className="p-4 bg-gray-50 text-gray-500 rounded-lg text-sm text-center border border-gray-100">
                    <p className="font-semibold text-gray-700 mb-1">다음 초기화일 전까지 표시할 평일 휴무일이 없습니다.</p>
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
                        <div key={idx} className="p-4 border border-gray-100 bg-white shadow-sm rounded-xl flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold text-gray-900 mb-0.5">
                              {h.date.replace(/-/g, '.')} {dayName}요일
                            </div>
                            <div className="text-sm text-blue-700 font-semibold">{h.name || typeLabel}</div>
                            <div className="text-xs text-gray-500 mt-1">{typeLabel}</div>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-black px-2 py-1 rounded-lg ${dDay <= 7 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'}`}>
                              D-{dDay === 0 ? 'Day' : dDay}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {upcomingHolidays.length > 5 && (
                      <button 
                        onClick={() => setShowAllHolidays(!showAllHolidays)}
                        className="w-full py-2.5 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition border border-gray-200 mt-2"
                      >
                        {showAllHolidays ? '접기 ▲' : `전체 보기 (${upcomingHolidays.length}개) ▼`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-md text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <h2 className="text-sm font-bold text-gray-100 tracking-wide">시스템 상태</h2>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => router.push('/calendar')} className="text-xs font-bold text-blue-300 hover:text-white underline">캘린더</button>
                  <button onClick={() => router.push('/holidays')} className="text-xs font-bold text-blue-300 hover:text-white underline">휴무일 관리</button>
                </div>
              </div>
              <p className="text-green-400 font-medium text-sm mb-1">✓ 자동 저장됨</p>
              <p className="text-gray-400 text-xs mb-4">마지막 저장: {lastSavedDate}</p>
              
              <p className="text-xs text-gray-300 leading-relaxed bg-white/10 p-3 rounded-lg border border-white/5">
                이 기기에 저장된 데이터입니다. 다른 기기에서 사용하려면 설정 화면에서 JSON 백업 파일을 내보내세요.
              </p>
              <div className="mt-4 flex gap-3">
                 <button onClick={() => router.push('/settings')} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition border border-white/10">데이터 관리 / 설정</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
