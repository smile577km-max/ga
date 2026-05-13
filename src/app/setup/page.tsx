"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { UserSettings } from '@/types/settings';
import { calculateGrantedDays } from '@/lib/leaveCalculator';
import { getNextResetDate, getDaysUntilReset } from '@/lib/periodCalculator';
import { toDateKey } from '@/lib/dateUtils';
import { DatePicker } from '@/components/DatePicker';

export default function SetupPage() {
  const router = useRouter();
  const { appData, isLoaded, updateSettings } = useAppData();
  const [formData, setFormData] = useState<Partial<UserSettings>>({
    name: '',
    employmentStatus: 'regular',
    incomeType: 'earned',
    resetRule: 'janFirst',
    hireDate: toDateKey(new Date()),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isLoaded && !isInitialized) {
      if (!appData.settings.onboardingCompleted) {
        setFormData(prev => ({ ...prev, ...appData.settings }));
      }
      setIsInitialized(true);
    }
  }, [isLoaded, appData.settings, isInitialized]);

  useEffect(() => {
    if (isLoaded && appData.settings.onboardingCompleted) {
      if (!appData.settings.initialLeaveInputCompleted) {
        router.replace('/initial-leave');
      } else {
        router.replace('/');
      }
    }
  }, [isLoaded, appData.settings, router]);

  if (!isLoaded || appData.settings.onboardingCompleted) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중...</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value 
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!formData.name || !formData.hireDate) {
      return alert('이름과 입사일을 입력해주세요.');
    }

    if (formData.hireDate > toDateKey(new Date())) {
      return alert('입사일은 오늘 또는 과거 날짜만 선택할 수 있습니다.');
    }

    // 최초 설정에서는 확인 팝업 없이 바로 저장
    setIsSaving(true);
    try {
      updateSettings({ 
        ...formData, 
        onboardingCompleted: true,
        initialLeaveInputCompleted: false 
      });
      
      router.push('/initial-leave');
    } catch (err) {
      console.error(err);
      setIsSaving(false);
      alert('설정 저장 중 문제가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const todayKey = toDateKey(new Date());
  let preview = null;
  
  if (formData.hireDate && formData.employmentStatus && formData.incomeType && formData.resetRule) {
    const dummySettings = { ...appData.settings, ...formData } as UserSettings;
    const granted = calculateGrantedDays(dummySettings, todayKey);
    const nextReset = getNextResetDate(dummySettings, todayKey);
    const daysUntilReset = getDaysUntilReset(dummySettings, todayKey);
    
    const hireDt = new Date(formData.hireDate);
    const todayDt = new Date(todayKey);
    const isUnderOneYear = todayDt.getFullYear() - hireDt.getFullYear() === 0 || 
      (todayDt.getFullYear() - hireDt.getFullYear() === 1 && todayDt < new Date(todayDt.getFullYear(), hireDt.getMonth(), hireDt.getDate()));
    
    preview = (
      <div className="mt-8 p-5 bg-blue-50 border border-blue-100 rounded-lg">
        <h3 className="font-semibold text-lg mb-3 text-blue-900">내 연차 미리보기</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex justify-between"><span>이름:</span> <strong>{formData.name}</strong></li>
          {isUnderOneYear ? (
            <>
              <li className="flex justify-between"><span>현재까지 실제 발생 연차:</span> <strong>{granted.actual}일</strong></li>
              <li className="flex justify-between"><span>앞으로 발생 가능 연차:</span> <strong>{granted.projected}일</strong></li>
              <li className="flex justify-between"><span>총 예상 가능 연차:</span> <strong>{granted.total}일</strong></li>
              <li className="mt-3 text-xs text-blue-700 bg-blue-100/50 p-2.5 rounded-md border border-blue-200">
                안내: 입사 1년 미만 직원은 월별 만근 기준으로 연차가 발생합니다.
              </li>
            </>
          ) : (
            <>
              <li className="flex justify-between"><span>현재까지 실제 발생 연차:</span> <strong>{granted.actual}일</strong></li>
              <li className="flex justify-between"><span>예상 발생 연차:</span> <strong>{granted.projected}일</strong></li>
            </>
          )}
          <li className="flex justify-between mt-3 pt-3 border-t border-blue-200"><span>다음 초기화일:</span> <strong>{nextReset} ({daysUntilReset}일 남음)</strong></li>
        </ul>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 font-sans text-[#1d1d1f]">
      <div className="max-w-[480px] w-full bg-white rounded-[18px] border border-[#e0e0e0] overflow-hidden">
        <div className="p-8 text-center border-b border-[#e0e0e0]">
          <h1 className="text-[28px] font-semibold tracking-[-0.015em] text-[#1d1d1f] mb-2">환영합니다 👋</h1>
          <p className="text-[#7a7a7a] text-[14px] font-normal">연차 관리를 시작하기 위해 기본 정보를 설정해주세요.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">이름</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 focus:ring-1 focus:ring-[#0066cc] focus:border-[#0066cc] outline-none transition text-[#1d1d1f] placeholder-[#7a7a7a]" placeholder="이름을 입력하세요" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">고용 상태</label>
              <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 focus:ring-1 focus:ring-[#0066cc] outline-none bg-white text-[#1d1d1f] appearance-none">
                <option value="regular">일반 직원</option>
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">소득 유형</label>
              <select name="incomeType" value={formData.incomeType} onChange={handleChange} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 focus:ring-1 focus:ring-[#0066cc] outline-none bg-white text-[#1d1d1f] appearance-none">
                <option value="earned">근로소득자</option>
                <option value="business">사업소득자</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">연차 초기화 기준</label>
            <select name="resetRule" value={formData.resetRule} onChange={handleChange} className="w-full border border-[#e0e0e0] rounded-[11px] p-3 focus:ring-1 focus:ring-[#0066cc] outline-none bg-white text-[#1d1d1f] appearance-none">
              <option value="janFirst">매년 1월 1일 초기화</option>
              <option value="hireDate">입사일 기준 초기화</option>
            </select>
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-2">입사일</label>
            <DatePicker value={formData.hireDate || ''} onChange={(date) => setFormData(prev => ({ ...prev, hireDate: date }))} min="2000-01-01" max="today" required />
            <div className="mt-4 p-4 bg-[#f5f5f7] rounded-[11px] border border-[#e0e0e0]">
              <p className="text-[12px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-1">근속 상태 (자동 계산)</p>
              <p className="text-[14px] font-semibold text-[#0066cc]">
                {formData.hireDate && (new Date().getTime() - new Date(formData.hireDate).getTime()) < (365 * 24 * 60 * 60 * 1000) 
                  ? '입사 1년 미만 직원' 
                  : '입사 1년 이상 직원'}
              </p>
              <p className="text-[11px] text-[#7a7a7a] mt-2 leading-relaxed">
                • 입사일을 기준으로 1년 미만 여부가 자동 계산됩니다.<br/>
                • 1년 미만 직원은 월별 만근 기준으로 연차가 발생합니다.
              </p>
            </div>
          </div>
          
          {preview && (
            <div className="mt-8 p-5 bg-[#f5f5f7] rounded-[11px] border border-[#e0e0e0]">
              <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-[#1d1d1f] mb-4">내 연차 미리보기</h3>
              <ul className="space-y-3 text-[14px] text-[#1d1d1f]">
                <li className="flex justify-between font-normal"><span className="text-[#7a7a7a]">이름</span> <span className="font-semibold">{formData.name}</span></li>
                {formData.hireDate && (new Date(toDateKey(new Date())).getFullYear() - new Date(formData.hireDate).getFullYear() === 0 || (new Date(toDateKey(new Date())).getFullYear() - new Date(formData.hireDate).getFullYear() === 1 && new Date(toDateKey(new Date())) < new Date(new Date(toDateKey(new Date())).getFullYear(), new Date(formData.hireDate).getMonth(), new Date(formData.hireDate).getDate()))) ? (
                  <>
                    <li className="flex justify-between font-normal"><span className="text-[#7a7a7a]">현재 발생 연차</span> <span className="font-semibold">{calculateGrantedDays({ ...appData.settings, ...formData } as UserSettings, toDateKey(new Date())).actual}일</span></li>
                    <li className="flex justify-between font-normal"><span className="text-[#7a7a7a]">앞으로 발생 가능</span> <span className="font-semibold">{calculateGrantedDays({ ...appData.settings, ...formData } as UserSettings, toDateKey(new Date())).projected}일</span></li>
                  </>
                ) : (
                  <li className="flex justify-between font-normal"><span className="text-[#7a7a7a]">현재 발생 연차</span> <span className="font-semibold">{calculateGrantedDays({ ...appData.settings, ...formData } as UserSettings, toDateKey(new Date())).actual}일</span></li>
                )}
                <li className="flex justify-between pt-3 border-t border-[#e0e0e0] font-normal"><span className="text-[#7a7a7a]">다음 초기화일</span> <span className="font-semibold">{getNextResetDate({ ...appData.settings, ...formData } as UserSettings, toDateKey(new Date()))}</span></li>
              </ul>
            </div>
          )}
          
          <button type="submit" className="w-full bg-[#0066cc] text-white font-semibold py-4 rounded-full mt-8 hover:bg-[#0071e3] transition active:scale-95 text-[15px]">
            저장하고 다음 단계로
          </button>
        </form>
      </div>
    </div>
  );
}
