"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { DatePicker } from '@/components/DatePicker';
import { LeaveRecord, LeaveRecordType } from '@/types/leave';
import { toDateKey, addDaysByDateKey } from '@/lib/dateUtils';
import { isHolidayOrNonWorkingDay, calculateConnectedLeaveUsageByWeek } from '@/lib/connectedUsageCalculator';
import { calculateWorkingMinutes, convertMinutesToLeaveDays } from '@/lib/timeCalculator';
import { formatLeaveUnits } from '@/lib/leaveFormatter';
import { calculateGrantedDays } from '@/lib/leaveCalculator';
import { FormattedLeaveUnits } from '@/components/FormattedLeaveUnits';

export default function InitialLeavePage() {
  const router = useRouter();
  const { appData, isLoaded, updateSettings, updateLeaveRecords } = useAppData();
  
  const [initialUsedDays, setInitialUsedDays] = useState<number>(0);
  const [initialUsedHalfDays, setInitialUsedHalfDays] = useState<number>(0);
  const [initialUsedHours, setInitialUsedHours] = useState<number>(0);
  const [usedConsecutive, setUsedConsecutive] = useState<number>(0);
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<LeaveRecordType>('full');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [startTime, setStartTime] = useState('09:50');
  const [endTime, setEndTime] = useState('11:50');

  useEffect(() => {
    if (isLoaded) {
      if (!appData.settings.onboardingCompleted) {
        router.replace('/setup');
      } else if (appData.settings.initialLeaveInputCompleted) {
        router.replace('/');
      } else {
        setInitialUsedDays(appData.settings.initialUsedDays || 0);
        setInitialUsedHalfDays(appData.settings.initialUsedHalfDays || 0);
        setInitialUsedHours(appData.settings.initialUsedHours || 0);
        setUsedConsecutive(appData.settings.usedConsecutiveLeaveAdjustment || 0);
        setRecords(appData.leaveRecords.filter(r => r.isInitial));
      }
    }
  }, [isLoaded, appData.settings, appData.leaveRecords, router]);

  // Recalculate auto connected usage when records change
  useEffect(() => {
    if (records.length > 0) {
      const autoCount = calculateConnectedLeaveUsageByWeek(records, appData.holidays, { start: '2000-01-01', end: '2100-01-01' });
      setUsedConsecutive(autoCount);
    }
  }, [records, appData.holidays]);

  // Auto-calculate end time based on duration and start time for hourly
  useEffect(() => {
    if (modalType === 'hourly' && startTime) {
      let currentMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
      let workingMins = 0;
      const targetMins = durationHours * 60;
      
      let iterations = 0;
      while (workingMins < targetMins && iterations < 1440) {
        currentMinutes++;
        iterations++;
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        const tStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        workingMins = calculateWorkingMinutes(startTime, tStr, startDate || toDateKey(new Date()));
      }
      
      const newEndTime = `${Math.floor(currentMinutes / 60).toString().padStart(2, '0')}:${(currentMinutes % 60).toString().padStart(2, '0')}`;
      setEndTime(newEndTime);
    }
  }, [startTime, durationHours, modalType, startDate]);

  if (!isLoaded || !appData.settings.onboardingCompleted || appData.settings.initialLeaveInputCompleted) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중...</div>;
  }

  const handleDateClick = (dateKey: string) => {
    setStartDate(dateKey);
    setEndDate(dateKey);
    setModalType('full');
    setShowModal(true);
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecords: LeaveRecord[] = [];
    
    if (modalType === 'full') {
      if (startDate > endDate) return alert('종료일은 시작일보다 같거나 늦어야 합니다.');
      let curr = startDate;
      while (curr <= endDate) {
        if (!isHolidayOrNonWorkingDay(curr, appData.holidays)) {
          newRecords.push({
            id: `initial-${Date.now()}-${curr}`,
            date: curr,
            type: 'full',
            deductedMinutes: 420,
            deductedDays: 1,
            isInitial: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
        curr = addDaysByDateKey(curr, 1);
      }
      if (newRecords.length === 0) return alert('선택한 기간에 평일(휴무일 제외)이 없습니다.');
    } else {
      let calcMins = 0;
      let calcDays = 0;
      if (modalType === 'morningHalf' || modalType === 'afternoonHalf') {
        calcMins = 210;
        calcDays = 0.5;
      } else {
        calcMins = calculateWorkingMinutes(startTime, endTime, startDate);
        calcDays = convertMinutesToLeaveDays(calcMins);
      }
      
      newRecords.push({
        id: `initial-${Date.now()}`,
        date: startDate,
        type: modalType,
        startTime: modalType === 'hourly' ? startTime : undefined,
        endTime: modalType === 'hourly' ? endTime : undefined,
        deductedMinutes: calcMins,
        deductedDays: calcDays,
        isInitial: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    setRecords([...records, ...newRecords]);
    setShowModal(false);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  const calculateTotalRecordsDays = () => {
    let days = 0;
    records.forEach(r => {
      days += r.deductedDays;
    });
    return days;
  };

  const currentInitialTotal = initialUsedDays + (initialUsedHalfDays * 0.5) + (initialUsedHours / 7);
  const totalUsedLeave = currentInitialTotal + calculateTotalRecordsDays();

  const granted = isLoaded ? calculateGrantedDays(appData.settings as any, toDateKey(new Date())) : { actual: 0 };
  const totalGranted = granted.actual + (appData.settings.manualLeaveAdjustment || 0);

  // Validation
  let warningMessage = '';
  if (totalUsedLeave > totalGranted) {
    warningMessage = `보유 연차(${formatLeaveUnits(totalGranted)})보다 많은 사용량은 입력할 수 없습니다. 앱 사용 전 사용량을 다시 확인해주세요.`;
  } else if (totalUsedLeave === 0 && usedConsecutive > 0) {
    warningMessage = '사용한 연차가 없으면 연휴·공휴일 연결 횟수를 입력할 수 없습니다.';
  } else if (usedConsecutive > 10) {
    warningMessage = '연휴·공휴일 연결 횟수는 최대 10회까지 입력할 수 있습니다.';
  } else if (usedConsecutive > records.length + Math.ceil(currentInitialTotal)) {
    warningMessage = '연휴·공휴일 연결 횟수가 사용 내역보다 많습니다. 입력값을 확인해주세요.';
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (warningMessage) return alert(warningMessage);
    
    // Save to AppData
    updateSettings({
      initialUsedDays: Number(initialUsedDays),
      initialUsedHalfDays: Number(initialUsedHalfDays),
      initialUsedHours: Number(initialUsedHours),
      usedConsecutiveLeaveAdjustment: Number(usedConsecutive),
      initialLeaveInputCompleted: true,
    });
    
    // Keep existing non-initial records, and overwrite initial records with new ones
    const nonInitial = appData.leaveRecords.filter(r => !r.isInitial);
    updateLeaveRecords([...nonInitial, ...records]);
    
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-visible">
          <div className="bg-blue-600 p-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">계산에 반영할 사용 내역 입력 📝</h1>
            <p className="text-blue-100 text-sm">
              앱을 사용하기 전에 이미 사용한 연차를 입력하세요.<br/>
              이 입력은 회사 연차 신청이 아니라 <strong>남은 연차 계산을 위한 개인 기록</strong>입니다.
            </p>
          </div>
          
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-full flex justify-center">
                <button 
                  onClick={() => {
                    setStartDate(toDateKey(new Date()));
                    setEndDate(toDateKey(new Date()));
                    setModalType('full');
                    setShowModal(true);
                  }}
                  className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
                >
                  <span className="text-xl">+</span> 내역 추가하기
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2 text-center">※ 달력의 날짜를 클릭하거나 위 버튼을 눌러 상세 사용 내역을 추가할 수 있습니다.</p>
            </div>
        </div>

        {records.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">상세 입력 내역</h2>
            <div className="space-y-2">
              {records.sort((a, b) => a.date.localeCompare(b.date)).map(r => (
                <div key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-700">{r.date}</span>
                    <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      {formatLeaveUnits(r.deductedDays)}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteRecord(r.id)} className="text-red-500 text-sm font-bold hover:bg-red-50 px-2 py-1 rounded">삭제</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2">간단 입력</h2>
          <p className="text-sm text-gray-500 mb-6">단순히 전체 사용량만 알고 있다면 아래에 직접 숫자로 입력할 수 있습니다. 위 달력에서 입력한 내역과 합산됩니다.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">기존 사용 연차 (간단 입력)</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <input type="number" min="0" value={initialUsedDays} onChange={(e) => setInitialUsedDays(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg p-3 pr-8 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">일</span>
                </div>
                <div className="relative">
                  <input type="number" min="0" value={initialUsedHalfDays} onChange={(e) => setInitialUsedHalfDays(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg p-3 pr-8 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">회</span>
                </div>
                <div className="relative">
                  <input type="number" min="0" value={initialUsedHours} onChange={(e) => setInitialUsedHours(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg p-3 pr-8 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">시간</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">기존 연휴·공휴일 연결 횟수</label>
              <div className="relative">
                <input 
                  type="number" step="1" min="0" max="10" value={usedConsecutive} 
                  onChange={(e) => setUsedConsecutive(Number(e.target.value))} 
                  className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">회</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center border border-gray-200 gap-3">
            <span className="text-gray-700 font-semibold">총 반영될 사용 일수 (상세 + 간단):</span>
            <FormattedLeaveUnits text={formatLeaveUnits(totalUsedLeave)} valueClass="text-lg" />
          </div>

          {warningMessage && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg font-bold text-sm border border-red-200">
              ⚠️ {warningMessage}
            </div>
          )}

          <button onClick={handleSubmit} disabled={!!warningMessage} className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg mt-8 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition shadow-md text-lg">
            빠르게 시작하기 🚀
          </button>
        </div>

      </div>

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-visible">
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <h2 className="font-bold">사용 내역 추가</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">연차 유형</label>
                <select value={modalType} onChange={e => setModalType(e.target.value as LeaveRecordType)} className="w-full border rounded-lg p-2 outline-none text-gray-900 focus:ring-2 focus:ring-blue-500">
                  <option value="full">연차 (1일 단위)</option>
                  <option value="morningHalf">오전 반차</option>
                  <option value="afternoonHalf">오후 반차</option>
                  <option value="hourly">시간연차</option>
                </select>
              </div>

              {modalType === 'full' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">시작일</label>
                    <DatePicker value={startDate} onChange={setStartDate} required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">종료일</label>
                    <DatePicker value={endDate} onChange={setEndDate} required />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">선택일</label>
                  <DatePicker value={startDate} onChange={setStartDate} required />
                </div>
              )}

              {modalType === 'hourly' && (
                <div className="grid grid-cols-1 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">사용 시간 (1시간 단위)</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map(h => (
                        <button key={h} type="button" onClick={() => setDurationHours(h)} className={`w-10 h-10 rounded-lg border font-bold transition ${durationHours === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">시작 시간</label>
                      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border rounded-lg p-2 outline-none text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">종료 시간</label>
                      <input type="time" value={endTime} readOnly className="w-full border rounded-lg p-2 bg-gray-100 text-gray-500" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200">취소</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">추가하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
