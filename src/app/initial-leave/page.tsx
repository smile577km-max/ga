"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { DatePicker } from '@/components/DatePicker';
import { LeaveRecord, LeaveRecordType } from '@/types/leave';
import { toDateKey, addDaysByDateKey, getTodayDateKeyInKorea } from '@/lib/dateUtils';
import { isHolidayOrNonWorkingDay, calculateConnectedLeaveUsageByBlock } from '@/lib/connectedUsageCalculator';
import { calculateWorkingMinutes, convertMinutesToLeaveDays } from '@/lib/timeCalculator';
import { formatLeaveUnits } from '@/lib/leaveFormatter';
import { calculateGrantedDays } from '@/lib/leaveCalculator';
import { FormattedLeaveUnits } from '@/components/FormattedLeaveUnits';
import { parseExcelLeaveFile, ExcelParsedResult } from '@/lib/excelParser';
import { getCurrentLeaveCycle } from '@/lib/periodCalculator';

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

  // Excel State
  const [excelResult, setExcelResult] = useState<ExcelParsedResult | null>(null);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);

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

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingExcel(true);
    try {
      const mockSettings: any = {
        ...appData.settings,
        resetRule: appData.settings.resetRule,
        hireDate: appData.settings.hireDate
      };
      const result = await parseExcelLeaveFile(file, records, mockSettings, appData.holidays);
      setExcelResult(result);
      setShowExcelPreview(true);
    } catch (err) {
      console.error(err);
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsParsingExcel(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleApplyExcelRecords = () => {
    if (!excelResult) return;
    
    console.log('[EXCEL] Applying records to state:', excelResult.records.length);
    
    const newRecords = excelResult.records.map(r => ({
      ...r,
      id: `excel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isInitial: true,
      source: 'excel' as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })) as LeaveRecord[];

    setRecords(prev => {
      const updated = [...prev, ...newRecords];
      console.log('[EXCEL] New total records:', updated.length);
      return updated;
    });
    
    if (excelResult.attendanceUpdates && Object.keys(excelResult.attendanceUpdates).length > 0) {
      updateSettings({
        monthlyPerfectAttendance: {
          ...appData.settings.monthlyPerfectAttendance,
          ...excelResult.attendanceUpdates
        }
      });
    }
    
    setShowExcelPreview(false);
    setExcelResult(null);
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

  const { cycleStartDate, cycleEndDate } = getCurrentLeaveCycle(appData.settings as any, getTodayDateKeyInKorea());
  const inclusiveEnd = addDaysByDateKey(cycleEndDate, -1);
  const autoCount = calculateConnectedLeaveUsageByBlock(records, appData.holidays, { start: cycleStartDate, end: inclusiveEnd });
  const totalConsecutive = usedConsecutive + autoCount;

  const granted = isLoaded ? calculateGrantedDays(appData.settings as any, toDateKey(new Date())) : { actual: 0 };
  const totalGranted = granted.actual + (appData.settings.manualLeaveAdjustment || 0);

  // Validation
  let warningMessage = '';
  if (totalUsedLeave > totalGranted) {
    warningMessage = `보유 연차(${formatLeaveUnits(totalGranted)})보다 많은 사용량은 입력할 수 없습니다. 앱 사용 전 사용량을 다시 확인해주세요.`;
  } else if (totalUsedLeave === 0 && totalConsecutive > 0) {
    warningMessage = '사용한 연차가 없으면 연휴·공휴일 연결 횟수를 입력할 수 없습니다.';
  } else if (totalConsecutive > 10) {
    warningMessage = '연휴·공휴일 연결 횟수는 최대 10회까지 입력할 수 있습니다.';
  } else if (totalConsecutive > records.length + Math.ceil(currentInitialTotal)) {
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
    <div className="min-h-screen bg-[#f5f5f7] py-12 px-4 font-sans text-[#1d1d1f]">
      <div className="max-w-[800px] mx-auto space-y-8">
        
        <div className="bg-white rounded-[18px] border border-[#e0e0e0] overflow-hidden">
          <div className="p-8 text-center border-b border-[#e0e0e0]">
            <h1 className="text-[28px] font-semibold tracking-[-0.015em] text-[#1d1d1f] mb-2">계산에 반영할 사용 내역 입력 📝</h1>
            <p className="text-[#7a7a7a] text-[14px] font-normal leading-relaxed">
              앱을 사용하기 전에 이미 사용한 연차를 입력하세요.<br/>
              이 입력은 회사 연차 신청이 아니라 <strong className="text-[#1d1d1f]">남은 연차 계산을 위한 개인 기록</strong>입니다.
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-6 py-10 px-8">
            <div className="w-full flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={() => {
                  setStartDate(toDateKey(new Date()));
                  setEndDate(toDateKey(new Date()));
                  setModalType('full');
                  setShowModal(true);
                }}
                className="bg-[#0066cc] text-white font-semibold px-8 py-3.5 rounded-full hover:bg-[#0071e3] transition active:scale-95 text-[15px] flex-1 text-center"
              >
                + 직접 추가하기
              </button>
              
              <label className="bg-white text-[#0066cc] border border-[#0066cc] font-semibold px-8 py-3.5 rounded-full hover:bg-[#0066cc]/5 transition active:scale-95 text-[15px] flex-1 cursor-pointer text-center">
                📁 엑셀 파일 등록
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  className="hidden" 
                  onChange={handleExcelUpload}
                  disabled={isParsingExcel}
                />
              </label>
            </div>
            <div className="text-center">
              <p className="text-[13px] text-[#7a7a7a] font-normal">인트라 근태 엑셀 파일을 등록하면 사용 내역을 자동으로 입력할 수 있습니다.</p>
              {isParsingExcel && <p className="text-[13px] text-[#0066cc] font-semibold animate-pulse mt-3">파일을 분석하고 있습니다...</p>}
            </div>
          </div>
        </div>

        {records.length > 0 && (
          <div className="bg-white rounded-[18px] border border-[#e0e0e0] p-8">
            <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-5">상세 입력 내역</h2>
            <div className="space-y-3">
              {records.sort((a, b) => a.date.localeCompare(b.date)).map(r => (
                <div key={r.id} className="flex justify-between items-center p-4 bg-[#f5f5f7] rounded-[11px] border border-[#e0e0e0]/50 transition-colors hover:border-[#e0e0e0]">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-[#1d1d1f] text-[15px]">{r.date.replace(/-/g, '.')}</span>
                    <span className="text-[12px] font-semibold text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-2.5 py-1 rounded-full">
                      {formatLeaveUnits(r.deductedDays)}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteRecord(r.id)} className="text-[#ff3b30] text-[13px] font-semibold hover:bg-[#ff3b30]/5 px-3 py-1.5 rounded-full transition">삭제</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-[18px] border border-[#e0e0e0] p-8">
          <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] mb-2">간단 입력</h2>
          <p className="text-[14px] text-[#7a7a7a] mb-8 font-normal leading-relaxed">단순히 전체 사용량만 알고 있다면 아래에 직접 숫자로 입력할 수 있습니다. 위 상세 내역과 합산됩니다.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">기존 사용 연차 (간단 입력)</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <input type="number" min="0" value={initialUsedDays} onChange={(e) => setInitialUsedDays(Number(e.target.value))} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 pr-8 focus:ring-1 focus:ring-[#0066cc] outline-none text-[#1d1d1f] font-semibold appearance-none" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#7a7a7a]">일</span>
                </div>
                <div className="relative">
                  <input type="number" min="0" value={initialUsedHalfDays} onChange={(e) => setInitialUsedHalfDays(Number(e.target.value))} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 pr-8 focus:ring-1 focus:ring-[#0066cc] outline-none text-[#1d1d1f] font-semibold appearance-none" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#7a7a7a]">회</span>
                </div>
                <div className="relative">
                  <input type="number" min="0" value={initialUsedHours} onChange={(e) => setInitialUsedHours(Number(e.target.value))} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 pr-8 focus:ring-1 focus:ring-[#0066cc] outline-none text-[#1d1d1f] font-semibold appearance-none" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#7a7a7a]">시간</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">연휴·공휴일 연결 횟수 (직접 입력)</label>
              <div className="relative">
                <input 
                  type="number" step="1" min="0" max="10" value={usedConsecutive} 
                  onChange={(e) => setUsedConsecutive(Number(e.target.value))} 
                  className="w-full border border-[#e0e0e0] rounded-[11px] p-3 pr-10 focus:ring-1 focus:ring-[#0066cc] outline-none text-[#1d1d1f] font-semibold appearance-none" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a7a7a] text-[14px]">회</span>
              </div>
              
              <div className="bg-[#f5f5f7] rounded-[11px] border border-[#e0e0e0] p-4 text-[13px]">
                <div className="flex justify-between text-[#7a7a7a] mb-2">
                  <span>앱 사용 전 (직접 입력)</span>
                  <span className="font-semibold text-[#1d1d1f]">{usedConsecutive}회</span>
                </div>
                <div className="flex justify-between text-[#7a7a7a] mb-2">
                  <span>앱 사용 후 (사용 내역)</span>
                  <span className="font-semibold text-[#1d1d1f]">{autoCount}회</span>
                </div>
                <div className="flex justify-between text-[#1d1d1f] font-bold border-t border-[#e0e0e0] mt-3 pt-3">
                  <span>총 사용 횟수</span>
                  <span className="text-[#0066cc]">{totalConsecutive}회</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-5 bg-[#f5f5f7] rounded-[11px] border border-[#e0e0e0] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <span className="text-[#7a7a7a] text-[15px] font-normal">총 반영될 사용 일수 (상세 + 간단)</span>
            <FormattedLeaveUnits text={formatLeaveUnits(totalUsedLeave)} valueClass="text-lg" />
          </div>

          {warningMessage && (
            <div className="mt-6 p-4 bg-[#ff3b30]/5 text-[#ff3b30] rounded-[11px] font-semibold text-[14px] border border-[#ff3b30]/20">
              ⚠️ {warningMessage}
            </div>
          )}

          <button onClick={handleSubmit} disabled={!!warningMessage} className="w-full bg-[#0066cc] text-white font-semibold py-4 rounded-full mt-10 hover:bg-[#0071e3] transition active:scale-95 disabled:opacity-50 text-[17px]">
            저장하고 시작하기 🚀
          </button>
        </div>

      </div>

      {/* Excel Preview Modal */}
      {showExcelPreview && excelResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] border border-[#e0e0e0]">
            <div className="px-8 py-6 flex justify-between items-center border-b border-[#e0e0e0] shrink-0">
              <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-[#1d1d1f]">엑셀 사용 내역 확인</h2>
              <button onClick={() => setShowExcelPreview(false)} className="text-[#7a7a7a] hover:text-[#1d1d1f] transition text-[20px]">✕</button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[#f5f5f7] p-3 rounded-[11px] text-center border border-[#e0e0e0]">
                  <div className="text-[11px] text-[#7a7a7a] font-bold mb-1">반영 대상</div>
                  <div className="text-[17px] font-bold text-[#0066cc]">{excelResult.preview.toReflect.length}건</div>
                </div>
                <div className="bg-[#f5f5f7] p-3 rounded-[11px] text-center border border-[#e0e0e0]">
                  <div className="text-[11px] text-[#7a7a7a] font-bold mb-1">차감 없음</div>
                  <div className="text-[17px] font-bold text-[#1d1d1f]">{excelResult.preview.noDeduction.length}건</div>
                </div>
                <div className="bg-[#f5f5f7] p-3 rounded-[11px] text-center border border-[#e0e0e0]">
                  <div className="text-[11px] text-[#7a7a7a] font-bold mb-1">확인 필요</div>
                  <div className="text-[17px] font-bold text-[#ff9500]">{excelResult.preview.needsCheck.length}건</div>
                </div>
                <div className="bg-[#f5f5f7] p-3 rounded-[11px] text-center border border-[#e0e0e0]">
                  <div className="text-[11px] text-[#7a7a7a] font-bold mb-1">제외 대상</div>
                  <div className="text-[17px] font-bold text-[#ff3b30]">{excelResult.preview.duplicates.length + excelResult.preview.excludedByStatus.length}건</div>
                </div>
                <div className="bg-[#f5f5f7] p-3 rounded-[11px] text-center border border-[#e0e0e0]">
                  <div className="text-[11px] text-[#7a7a7a] font-bold mb-1">기간 외</div>
                  <div className="text-[17px] font-bold text-[#af52de]">{excelResult.preview.outOfPeriod.length}건</div>
                </div>
              </div>

              {excelResult.preview.toReflect.length > 0 && (
                <section>
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc]"></span>
                    반영될 내역
                  </h3>
                  <div className="rounded-[11px] border border-[#e0e0e0] overflow-hidden">
                    <table className="w-full text-[14px]">
                      <thead className="bg-[#f5f5f7] text-[#7a7a7a] text-left border-b border-[#e0e0e0]">
                        <tr>
                          <th className="p-3 font-semibold">날짜</th>
                          <th className="p-3 font-semibold">구분</th>
                          <th className="p-3 font-semibold">결과</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e0e0e0]">
                        {excelResult.preview.toReflect.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#f5f5f7]/50">
                            <td className="p-3 font-medium text-[#1d1d1f]">{item.date}</td>
                            <td className="p-3 text-[#7a7a7a]">{item.originalType}</td>
                            <td className="p-3 font-semibold text-[#0066cc]">{item.displayValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {excelResult.preview.needsCheck.length > 0 && (
                <section>
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500]"></span>
                    확인 필요
                  </h3>
                  <div className="rounded-[11px] border border-[#ff9500]/30 overflow-hidden bg-[#ff9500]/5">
                    <table className="w-full text-[14px]">
                      <tbody className="divide-y divide-[#ff9500]/20">
                        {excelResult.preview.needsCheck.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-3 text-[#1d1d1f] font-medium">{item.date}</td>
                            <td className="p-3 text-[#7a7a7a]">{item.originalType}</td>
                            <td className="p-3 font-semibold text-[#ff9500]">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            <div className="p-8 border-t border-[#e0e0e0] bg-[#f5f5f7] shrink-0">
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowExcelPreview(false);
                    setExcelResult(null);
                  }}
                  className="flex-1 bg-white border border-[#e0e0e0] text-[#1d1d1f] font-semibold py-3.5 rounded-full hover:bg-white/80 transition active:scale-95 text-[15px]"
                >
                  취소
                </button>
                <button 
                  onClick={handleApplyExcelRecords}
                  disabled={excelResult.preview.toReflect.length === 0}
                  className="flex-1 bg-[#0066cc] text-white font-semibold py-3.5 rounded-full hover:bg-[#0071e3] transition active:scale-95 disabled:opacity-50 text-[15px]"
                >
                  계산에 반영
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md border border-[#e0e0e0] overflow-hidden">
            <div className="px-8 py-6 border-b border-[#e0e0e0] flex justify-between items-center bg-white">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">사용 내역 추가</h2>
              <button onClick={() => setShowModal(false)} className="text-[#7a7a7a] hover:text-[#1d1d1f] transition">✕</button>
            </div>
            <form onSubmit={handleAddRecord} className="p-8 space-y-6">
              <div>
                <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">연차 유형</label>
                <select value={modalType} onChange={e => setModalType(e.target.value as LeaveRecordType)} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 outline-none text-[#1d1d1f] focus:ring-1 focus:ring-[#0066cc] bg-white appearance-none">
                  <option value="full">연차 (1일 단위)</option>
                  <option value="morningHalf">오전 반차</option>
                  <option value="afternoonHalf">오후 반차</option>
                  <option value="hourly">시간연차</option>
                </select>
              </div>

              {modalType === 'full' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">시작일</label>
                    <DatePicker value={startDate} onChange={setStartDate} required />
                  </div>
                  <div>
                    <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">종료일</label>
                    <DatePicker value={endDate} onChange={setEndDate} required />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">선택일</label>
                  <DatePicker value={startDate} onChange={setStartDate} required />
                </div>
              )}

              {modalType === 'hourly' && (
                <div className="space-y-4 p-5 bg-[#f5f5f7] rounded-[11px] border border-[#e0e0e0]">
                  <div>
                    <label className="block text-[12px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">사용 시간 (1시간 단위)</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map(h => (
                        <button key={h} type="button" onClick={() => setDurationHours(h)} className={`w-10 h-10 rounded-[11px] border text-[14px] font-semibold transition active:scale-90 ${durationHours === h ? 'bg-[#0066cc] text-white border-[#0066cc]' : 'bg-white text-[#1d1d1f] border-[#e0e0e0] hover:border-[#7a7a7a]'}`}>
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#7a7a7a] mb-2">시작 시간</label>
                      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-[#e0e0e0] rounded-[11px] p-2.5 outline-none text-[#1d1d1f] focus:ring-1 focus:ring-[#0066cc] bg-white" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#7a7a7a] mb-2">종료 시간</label>
                      <input type="time" value={endTime} readOnly className="w-full border border-[#e0e0e0] rounded-[11px] p-2.5 bg-[#ffffff]/50 text-[#7a7a7a]" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white border border-[#e0e0e0] text-[#1d1d1f] font-semibold py-3.5 rounded-full hover:bg-[#f5f5f7] transition active:scale-95 text-[15px]">취소</button>
                <button type="submit" className="flex-1 bg-[#0066cc] text-white font-semibold py-3.5 rounded-full hover:bg-[#0071e3] transition active:scale-95 text-[15px]">추가하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
