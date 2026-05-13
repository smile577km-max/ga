"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { UserSettings, EmploymentStatus, IncomeType, ResetRule } from '@/types/settings';
import { toDateKey } from '@/lib/dateUtils';
import { formatLeaveUnits } from '@/lib/leaveFormatter';
import { calculateGrantedDays } from '@/lib/leaveCalculator';
import { defaultSettings } from '@/lib/storage';
import { DatePicker } from '@/components/DatePicker';

export default function SettingsPage() {
  const router = useRouter();
  const { appData, isLoaded, updateSettings, resetData } = useAppData();
  
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<Partial<UserSettings>>({
    name: '',
    employmentStatus: 'regular',
    incomeType: 'earned',
    resetRule: 'janFirst',
    hireDate: toDateKey(new Date()),
    initialUsageMode: 'simple',
    initialUsageRecords: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // New record state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecordType, setNewRecordType] = useState<'full' | 'morningHalf' | 'afternoonHalf' | 'hourly'>('full');
  const [newRecordStartDate, setNewRecordStartDate] = useState(toDateKey(new Date()));
  const [newRecordEndDate, setNewRecordEndDate] = useState(toDateKey(new Date()));
  const [newRecordHours, setNewRecordHours] = useState(1);
  const [newRecordMemo, setNewRecordMemo] = useState('');

  useEffect(() => {
    if (isLoaded && !isInitialized) {
      setFormData(prev => ({ ...prev, ...appData.settings }));
      setIsInitialized(true);
      setMounted(true);
    }
  }, [isLoaded, appData.settings, isInitialized]);

  if (!isLoaded || !mounted) return <div className="p-8 text-center">로딩 중...</div>;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value 
    }));
  };

  const handleAddRecord = () => {
    if (newRecordType === 'full' && newRecordStartDate > newRecordEndDate) {
      alert('종료일은 시작일보다 같거나 늦어야 합니다.');
      return;
    }

    let calculatedDays = 0;
    let calculatedMins = 0;

    if (newRecordType === 'full') {
      // For simplicity in settings, we just count days directly (no holiday checking here to match user request for simple input)
      const s = new Date(newRecordStartDate);
      const e = new Date(newRecordEndDate);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      calculatedMins = calculatedDays * 420;
    } else if (newRecordType === 'morningHalf' || newRecordType === 'afternoonHalf') {
      calculatedDays = 0.5;
      calculatedMins = 210;
    } else {
      calculatedMins = newRecordHours * 60;
      calculatedDays = newRecordHours / 7;
    }

    const newRecord: any = {
      id: `initial-${Date.now()}`,
      date: newRecordStartDate,
      type: newRecordType,
      deductedMinutes: calculatedMins,
      deductedDays: calculatedDays,
      isInitial: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      memo: newRecordMemo
    };

    if (newRecordType === 'full' && newRecordStartDate !== newRecordEndDate) {
      newRecord.endDate = newRecordEndDate;
    }

    const updatedRecords = [...(formData.initialUsageRecords || []), newRecord];
    
    // Auto sum
    let totalDays = 0;
    updatedRecords.forEach(r => totalDays += r.deductedDays);
    
    const days = Math.floor(totalDays);
    let remainder = totalDays - days;
    let halfDays = 0;
    let hours = 0;
    if (remainder >= 0.5) {
      halfDays = 1;
      remainder -= 0.5;
    }
    if (remainder > 0) {
      hours = Math.round(remainder * 7);
    }

    setFormData(prev => ({
      ...prev,
      initialUsageRecords: updatedRecords,
      initialUsedDays: days,
      initialUsedHalfDays: halfDays,
      initialUsedHours: hours
    }));

    setShowAddForm(false);
    setNewRecordMemo('');
  };

  const handleDeleteRecord = (id: string) => {
    const updatedRecords = (formData.initialUsageRecords || []).filter(r => r.id !== id);
    
    // Auto sum
    let totalDays = 0;
    updatedRecords.forEach(r => totalDays += r.deductedDays);
    
    const days = Math.floor(totalDays);
    let remainder = totalDays - days;
    let halfDays = 0;
    let hours = 0;
    if (remainder >= 0.5) {
      halfDays = 1;
      remainder -= 0.5;
    }
    if (remainder > 0) {
      hours = Math.round(remainder * 7);
    }

    setFormData(prev => ({
      ...prev,
      initialUsageRecords: updatedRecords,
      initialUsedDays: days,
      initialUsedHalfDays: halfDays,
      initialUsedHours: hours
    }));
  };

  const currentSettings = { ...defaultSettings, ...formData } as UserSettings;
  const granted = isInitialized ? calculateGrantedDays(currentSettings, toDateKey(new Date())) : { actual: 0 };
  const totalGranted = granted.actual + (formData.manualLeaveAdjustment || 0);
  const initialUsedDaysTotal = (formData.initialUsedDays || 0) + ((formData.initialUsedHalfDays || 0) * 0.5) + ((formData.initialUsedHours || 0) / 7);
  const isExceeded = initialUsedDaysTotal > totalGranted;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isExceeded) return;

    if (!formData.name || !formData.hireDate) {
      alert('이름과 입사일을 입력해주세요.');
      return;
    }

    if (formData.hireDate > toDateKey(new Date())) {
      alert('입사일은 오늘 또는 과거 날짜만 선택할 수 있습니다.');
      return;
    }

    setIsSaving(true);
    try {
      updateSettings({ 
        ...formData, 
        onboardingCompleted: true 
      });
      
      if (!appData.settings.initialLeaveInputCompleted) {
        router.push('/initial-leave');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error(err);
      setIsSaving(false);
      alert('설정 저장 중 문제가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `leave-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.schemaVersion) {
          localStorage.setItem('leave_app_data', JSON.stringify(json));
          window.location.href = '/';
        }
      } catch (err) {
        console.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    resetData();
    router.push('/setup');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-visible border border-gray-100">
        <div className="bg-gray-800 p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">내 기준 설정</h1>
          <button onClick={() => router.push('/')} className="text-gray-300 hover:text-white font-medium">취소</button>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2">기본 설정</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">이름</label>
                <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">입사일</label>
                <DatePicker value={formData.hireDate || ''} onChange={(date) => setFormData(prev => ({ ...prev, hireDate: date }))} min="2000-01-01" max="today" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">고용 상태</label>
                <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
                  <option value="regular">일반 직원</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">소득 유형</label>
                <select name="incomeType" value={formData.incomeType} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
                  <option value="earned">근로소득자</option>
                  <option value="business">사업소득자</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">초기화 기준</label>
                <select name="resetRule" value={formData.resetRule} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
                  <option value="janFirst">매년 1월 1일</option>
                  <option value="hireDate">입사일 기준</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-bold text-gray-700">근속 상태 (자동 계산)</p>
              <p className="text-sm font-medium text-blue-600 mt-1">
                {formData.hireDate && (new Date().getTime() - new Date(formData.hireDate).getTime()) < (365 * 24 * 60 * 60 * 1000) 
                  ? '입사 1년 미만 직원' 
                  : '입사 1년 이상 직원'}
              </p>
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                • 입사일을 기준으로 1년 미만 여부가 자동 계산됩니다.<br/>
                • 입사 1년 미만 직원은 월별 만근 기준으로 연차가 발생합니다.<br/>
                • 입사 1년 이상 직원은 근속연수 기준으로 연차가 계산됩니다.
              </p>
            </div>

            <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mt-8">사용량 설정</h2>
            
            <div className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">입력 방식 선택</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="initialUsageMode" value="simple" checked={formData.initialUsageMode === 'simple'} onChange={handleChange} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-800">간단 입력 (직접 숫자 입력)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="initialUsageMode" value="detailed" checked={formData.initialUsageMode === 'detailed'} onChange={handleChange} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-800">상세 기록 (날짜별 입력)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">앱 사용 전 이미 사용한 연차</label>
                {formData.initialUsageMode === 'simple' ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="relative">
                        <input type="number" step="1" min="0" name="initialUsedDays" value={formData.initialUsedDays || 0} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">일</span>
                      </div>
                      <div className="relative">
                        <input type="number" step="1" min="0" name="initialUsedHalfDays" value={formData.initialUsedHalfDays || 0} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">회</span>
                      </div>
                      <div className="relative">
                        <input type="number" step="1" min="0" name="initialUsedHours" value={formData.initialUsedHours || 0} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">시간</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-900 font-medium">
                      연차 {formData.initialUsedDays || 0}일 · 반차 {formData.initialUsedHalfDays || 0}회 · 시간연차 {formData.initialUsedHours || 0}시간
                    </p>
                    <p className="text-xs text-gray-500 mt-1">※ 상세 연차 기록을 기반으로 자동 합산됩니다.</p>
                  </div>
                )}
                {isExceeded ? (
                  <p className="text-sm font-bold text-red-600 mt-2">
                    ⚠️ 보유 연차({formatLeaveUnits(totalGranted)})보다 많은 사용량은 입력할 수 없습니다. 앱 사용 전 사용량을 다시 확인해주세요.
                  </p>
                ) : (
                  <p className="text-xs text-blue-600 mt-2 font-medium">총 합산 사용량: {formatLeaveUnits(initialUsedDaysTotal)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">앱 사용 전 이미 사용한 연휴·공휴일 연결 횟수</label>
                <input type="number" step="1" name="usedConsecutiveLeaveAdjustment" value={formData.usedConsecutiveLeaveAdjustment || 0} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
              </div>
            </div>

            {formData.initialUsageMode === 'detailed' && (
              <div className="mt-4 border border-blue-100 rounded-xl overflow-visible bg-white">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                  <h3 className="font-bold text-blue-900 text-sm">상세 연차 기록</h3>
                  <button type="button" onClick={() => setShowAddForm(!showAddForm)} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                    + 상세 기록 추가
                  </button>
                </div>
                
                {showAddForm && (
                  <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">사용 유형</label>
                      <select value={newRecordType} onChange={e => setNewRecordType(e.target.value as any)} className="w-full border p-2 rounded-md text-sm">
                        <option value="full">연차</option>
                        <option value="morningHalf">오전 반차</option>
                        <option value="afternoonHalf">오후 반차</option>
                        <option value="hourly">시간연차</option>
                      </select>
                    </div>
                    
                    {newRecordType === 'full' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">시작일</label>
                          <DatePicker value={newRecordStartDate} onChange={setNewRecordStartDate} className="text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">종료일</label>
                          <DatePicker value={newRecordEndDate} onChange={setNewRecordEndDate} className="text-sm" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">날짜</label>
                        <DatePicker value={newRecordStartDate} onChange={setNewRecordStartDate} className="text-sm" />
                      </div>
                    )}
                    
                    {newRecordType === 'hourly' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">사용 시간 (1~7시간)</label>
                        <select value={newRecordHours} onChange={e => setNewRecordHours(Number(e.target.value))} className="w-full border p-2 rounded-md text-sm">
                          {[1, 2, 3, 4, 5, 6, 7].map(h => <option key={h} value={h}>{h}시간</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">메모 (선택)</label>
                      <input type="text" value={newRecordMemo} onChange={e => setNewRecordMemo(e.target.value)} className="w-full border p-2 rounded-md text-sm" placeholder="예: 여름휴가" />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={handleAddRecord} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-md text-sm">확인</button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-2 rounded-md text-sm">취소</button>
                    </div>
                  </div>
                )}

                <div className="p-0">
                  {(!formData.initialUsageRecords || formData.initialUsageRecords.length === 0) ? (
                    <div className="p-6 text-center text-sm text-gray-500">
                      등록된 상세 연차 기록이 없습니다.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {formData.initialUsageRecords.map(r => {
                        let typeName = '';
                        if (r.type === 'full') {
                          const diffDays = r.endDate && r.endDate !== r.date ? Math.ceil(Math.abs(new Date(r.endDate).getTime() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
                          typeName = '연차 ' + diffDays + '일';
                        }
                        else if (r.type === 'morningHalf') typeName = '오전 반차';
                        else if (r.type === 'afternoonHalf') typeName = '오후 반차';
                        else if (r.type === 'hourly') typeName = '시간연차 ' + (r.deductedMinutes / 60) + '시간';

                        let dateStr = r.date;
                        if (r.type === 'full' && r.endDate && r.endDate !== r.date) {
                          dateStr = `${r.date} ~ ${r.endDate}`;
                        }

                        return (
                          <li key={r.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                            <div>
                              <div className="font-medium text-sm text-gray-800">{dateStr} / <span className="text-blue-700">{typeName}</span></div>
                              {r.memo && <div className="text-xs text-gray-500 mt-0.5">{r.memo}</div>}
                            </div>
                            <button type="button" onClick={() => handleDeleteRecord(r.id)} className="text-red-500 text-xs font-bold px-2 py-1 bg-red-50 rounded hover:bg-red-100">삭제</button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={isExceeded} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg mt-6 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
              저장
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">고급 설정</h2>
            
            <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1">기타 연차 조정</label>
                <input type="number" step="0.01" name="manualLeaveAdjustment" value={formData.manualLeaveAdjustment || 0} onChange={handleChange} className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
                <p className="text-xs text-blue-600 mt-1">표시 단위: {formatLeaveUnits(formData.manualLeaveAdjustment || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">회사에서 별도로 부여하거나 차감한 연차가 있을 때만 입력하세요. 일반적으로는 0으로 두면 됩니다. 잘 모르겠다면 수정하지 않아도 됩니다.</p>
            </div>
            
            <h3 className="font-bold text-gray-700 mb-2">데이터 백업 및 초기화</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button onClick={handleExport} className="flex-1 bg-green-50 text-green-700 border border-green-200 font-bold py-2.5 rounded-lg hover:bg-green-100 transition">
                  데이터 백업
                </button>
                <div className="flex-1 relative">
                  <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="bg-orange-50 text-orange-700 border border-orange-200 font-bold py-2.5 rounded-lg text-center hover:bg-orange-100 transition">
                    백업 파일 불러오기
                  </div>
                </div>
              </div>
              <button onClick={handleReset} className="w-full bg-red-50 text-red-600 border border-red-200 font-bold py-2.5 rounded-lg hover:bg-red-100 hover:text-red-700 transition">
                데이터 초기화
              </button>
            </div>
            
            <div className="mt-6 bg-gray-50 p-4 rounded-lg text-xs text-gray-500 leading-relaxed">
              <strong>시스템 알림:</strong><br/>
              • 모든 데이터는 현재 기기의 로컬에만 안전하게 보관됩니다.<br/>
              • 브라우저 캐시 삭제 시 데이터가 유실될 수 있으므로 주기적으로 [JSON 내보내기]를 권장합니다.<br/>
              • 저장된 데이터에 문제가 발생한 경우 [데이터 초기화]를 진행해주세요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
