"use client";

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { LeaveRecord, LeaveRecordType } from '@/types/leave';
import { calculateWorkingMinutes, validateHourlyLeaveUnit, validateTimeWithinWorkHours, convertMinutesToLeaveDays, getFridayEarlyLeaveEndTime, WORK_START } from '@/lib/timeCalculator';
import { isHolidayOrNonWorkingDay } from '@/lib/connectedUsageCalculator';
import { calculateLeaveSummary } from '@/lib/summaryCalculator';
import { toDateKey, getKoreanDayOfWeek } from '@/lib/dateUtils';
import { formatLeaveUnits } from '@/lib/leaveFormatter';
import { FormattedLeaveUnits } from '@/components/FormattedLeaveUnits';
import { DatePicker } from '@/components/DatePicker';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appData, isLoaded, updateLeaveRecords } = useAppData();
  
  const [date, setDate] = useState<string>(searchParams.get('date') || toDateKey(new Date()));
  const [type, setType] = useState<LeaveRecordType>((searchParams.get('type') as LeaveRecordType) || 'full');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [startTime, setStartTime] = useState<string>('09:50');
  const [endTime, setEndTime] = useState<string>('11:50');
  const [memo, setMemo] = useState<string>('');

  // Auto-calculate end time based on duration and start time
  useEffect(() => {
    if (type === 'hourly') {
      let currentMinutes = timeToMinutes(startTime);
      let workingMins = 0;
      const targetMins = durationHours * 60;
      
      // Safety limit to avoid infinite loops, max 24 hours
      let iterations = 0;
      while (workingMins < targetMins && iterations < 1440) {
        currentMinutes++;
        iterations++;
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        const tStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        workingMins = calculateWorkingMinutes(startTime, tStr, date);
      }
      
      const newEndTime = `${Math.floor(currentMinutes / 60).toString().padStart(2, '0')}:${(currentMinutes % 60).toString().padStart(2, '0')}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEndTime(newEndTime);
    }
  }, [startTime, durationHours, type, date]);

  if (!isLoaded) return <div className="p-8 text-center">로딩 중...</div>;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return alert(validationError);

    const newRecord: LeaveRecord = {
      // eslint-disable-next-line react-hooks/purity
      id: Date.now().toString(),
      date,
      type,
      startTime: type === 'hourly' ? startTime : undefined,
      endTime: type === 'hourly' ? endTime : undefined,
      deductedMinutes: calculatedMinutes,
      deductedDays: calculatedDays,
      memo,
      // eslint-disable-next-line react-hooks/purity
      createdAt: Date.now(),
      // eslint-disable-next-line react-hooks/purity
      updatedAt: Date.now(),
    };

    updateLeaveRecords([...appData.leaveRecords, newRecord]);
    router.push('/');
  };

  const existingRecords = appData.leaveRecords.filter(r => r.date === date);
  
  // Validation Logic
  let validationError = '';
  
  if (!date) {
    validationError = '날짜를 선택해주세요.';
  } else if (existingRecords.some(r => r.type === 'full')) {
    validationError = '해당 날짜에 이미 연차(1일)가 입력되어 있습니다.';
  } else if (type === 'full' && existingRecords.length > 0) {
    validationError = '해당 날짜에 이미 다른 내역이 있어 1일 연차를 입력할 수 없습니다.';
  } else if (type === 'morningHalf' && existingRecords.some(r => r.type === 'morningHalf')) {
    validationError = '해당 날짜에 이미 오전 반차가 입력되어 있습니다.';
  } else if (type === 'afternoonHalf' && existingRecords.some(r => r.type === 'afternoonHalf')) {
    validationError = '해당 날짜에 이미 오후 반차가 입력되어 있습니다.';
  }

  // 2. Hourly checks
  let calculatedMinutes = 0;
  let calculatedDays = 0;
  
  if (type === 'full') {
    calculatedMinutes = 420;
    calculatedDays = 1;
  } else if (type === 'morningHalf' || type === 'afternoonHalf') {
    calculatedMinutes = 210;
    calculatedDays = 0.5;
  } else if (type === 'hourly') {
    if (!validateTimeWithinWorkHours(date, startTime, endTime)) {
      const earlyLeaveEnd = getFridayEarlyLeaveEndTime(date);
      validationError = `시간연차는 근무 시간(${WORK_START}~${earlyLeaveEnd}) 내에서만 설정 가능하며, 시작 시간이 종료 시간보다 빨라야 합니다.`;
    } else {
      calculatedMinutes = calculateWorkingMinutes(startTime, endTime, date);
      if (!validateHourlyLeaveUnit(calculatedMinutes)) {
        validationError = '시간연차는 1시간 단위로만 사용할 수 있습니다.';
      } else {
        calculatedDays = convertMinutesToLeaveDays(calculatedMinutes);
        
        // Check overlap with half days
        const hasMorning = existingRecords.some(r => r.type === 'morningHalf');
        const hasAfternoon = existingRecords.some(r => r.type === 'afternoonHalf');
        if (hasMorning && startTime < '14:20') {
          validationError = '입력한 시간이 오전 반차(09:50~14:20)와 겹칩니다.';
        }
        if (hasAfternoon && endTime > '14:20') { // Simplified check
          validationError = '입력한 시간이 오후 반차(14:20~17:50)와 겹칩니다.';
        }
        
        // Check overlap with other hourly
        const hourlyRecords = existingRecords.filter(r => r.type === 'hourly');
        for (const hr of hourlyRecords) {
          if (hr.startTime && hr.endTime) {
            if (Math.max(timeToMinutes(startTime), timeToMinutes(hr.startTime)) < Math.min(timeToMinutes(endTime), timeToMinutes(hr.endTime))) {
              validationError = '기존에 입력된 시간연차와 시간이 겹칩니다.';
            }
          }
        }
      }
    }
  }

  // Check 0.5 + 3hr combination
  let isCombo = false;
  if (!validationError) {
    let halfDayCount = existingRecords.filter(r => r.type === 'morningHalf' || r.type === 'afternoonHalf').length;
    if (type === 'morningHalf' || type === 'afternoonHalf') halfDayCount++;
    
    let hourlyMins = existingRecords.filter(r => r.type === 'hourly').reduce((sum, r) => sum + r.deductedMinutes, 0);
    if (type === 'hourly') hourlyMins += calculatedMinutes;
    
    if (halfDayCount === 1 && hourlyMins === 180) {
      isCombo = true;
      // The total day calculation handled by summaryCalculator handles it, but for UI preview we show it.
    }
  }

  // Preview Calculations
  let newSummary = null;
  let oldSummary = null;
  let newConnections = 0;
  let connectionMessage = '연휴·공휴일 연결 차감 없음';

  if (!validationError) {
    const previewRecords = [...appData.leaveRecords, {
      id: 'preview', date, type, deductedMinutes: calculatedMinutes, deductedDays: calculatedDays, startTime, endTime, createdAt: 0, updatedAt: 0
    } as LeaveRecord];
    
    const todayKey = toDateKey(new Date());
    oldSummary = calculateLeaveSummary(appData.settings, appData.leaveRecords, appData.holidays, todayKey);
    newSummary = calculateLeaveSummary(appData.settings, previewRecords, appData.holidays, todayKey);
    
    // To strictly check if THIS record caused a connection increment:
    newConnections = newSummary.recordedConnectedUsageCount - oldSummary.recordedConnectedUsageCount;
    
    if (newConnections > 0) {
      connectionMessage = '이 연차는 휴무일과 연결되어 이번 주 연휴·공휴일 연결 1회가 차감됩니다.';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-visible border border-gray-100">
        <div className="bg-gray-800 p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">사용 연차 입력</h1>
          <button onClick={() => router.back()} className="text-gray-300 hover:text-white font-medium">취소</button>
        </div>
        
        <div className="p-6 bg-blue-50/50 border-b border-gray-100 text-sm text-gray-600">
          <p className="font-bold text-blue-800 mb-1">안내</p>
          <p>이 화면은 회사 연차 신청/등록 화면이 아닙니다.</p>
          <p>이미 사용했거나 사용할 예정인 연차 사용량을 입력해 남은 연차를 계산하기 위한 개인 화면입니다.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">사용 날짜</label>
              <DatePicker value={date} onChange={setDate} required />
              <p className="text-xs text-gray-500 mt-1">※ 날짜를 입력하면 연휴·공휴일과 연결하여 사용한 횟수를 자동 계산할 수 있습니다.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">연차 유형</label>
              <select value={type} onChange={e => setType(e.target.value as LeaveRecordType)} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white">
                <option value="full">연차 (1일)</option>
                <option value="morningHalf">오전 반차</option>
                <option value="afternoonHalf">오후 반차</option>
                <option value="hourly">시간연차</option>
              </select>
            </div>

            {type === 'hourly' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">사용 시간</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(h => (
                      <button key={h} type="button" onClick={() => setDurationHours(h)} className={`flex-1 py-2 rounded-lg border font-bold transition ${durationHours === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>
                        {h}시간
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">시작 시간</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">종료 시간 (자동계산)</label>
                  <input type="time" value={endTime} readOnly className="w-full border rounded-lg p-2.5 bg-gray-100 text-gray-500 cursor-not-allowed outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">메모 (선택)</label>
              <input type="text" value={memo} onChange={e => setMemo(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400" placeholder="사유 등을 입력하세요" />
            </div>

            {validationError ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 font-medium text-sm">
                ⚠️ {validationError}
              </div>
            ) : (
              <div className="p-5 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                <h3 className="font-bold text-blue-900 mb-1">입력 미리보기</h3>
                <div className="flex flex-col gap-y-3 text-sm text-blue-800 mt-2">
                  <div className="flex justify-between items-center">
                    <span>선택 날짜:</span> 
                    <span className="font-semibold">{date} ({getKoreanDayOfWeek(date)})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>사용 유형:</span> 
                    <FormattedLeaveUnits text={formatLeaveUnits(calculatedDays)} valueClass="text-sm" />
                  </div>
                  <div className="pt-3 border-t border-blue-200 flex justify-between items-center">
                    <span>계산 후 남은 연차:</span>
                    <FormattedLeaveUnits text={formatLeaveUnits(newSummary?.remainingDays || 0)} valueClass="text-lg" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>계산 후 남은 연결 횟수:</span>
                    <strong className="text-lg">{newSummary?.remainingConnectedUsageCount}회</strong>
                  </div>
                </div>
                {isCombo && <p className="text-xs text-blue-600 mt-2">안내: 반차 1회와 시간연차 3시간을 함께 사용하면 연차 1일로 처리됩니다.</p>}
                {newConnections > 0 && <p className="text-xs font-bold text-purple-700 mt-2 bg-purple-100 p-2 rounded">{connectionMessage}</p>}
                {newSummary?.remainingConnectedUsageCount !== undefined && newSummary.remainingConnectedUsageCount < 0 && <p className="text-xs font-bold text-red-600 mt-1">⚠️ 연휴·공휴일 연결 횟수를 초과합니다!</p>}
              </div>
            )}

            <button type="submit" disabled={!!validationError} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg mt-6 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
              계산에 반영
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
