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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-visible">
        <div className="bg-blue-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">환영합니다! 👋</h1>
          <p className="text-blue-100 text-sm">연차 관리를 시작하기 위해 기본 정보를 설정해주세요.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">이름</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 placeholder-gray-400" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">고용 상태</label>
              <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900">
                <option value="regular">일반 직원</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">소득 유형</label>
              <select name="incomeType" value={formData.incomeType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900">
                <option value="earned">근로소득자</option>
                <option value="business">사업소득자</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">연차 초기화 기준</label>
            <select name="resetRule" value={formData.resetRule} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900">
              <option value="janFirst">매년 1월 1일 초기화</option>
              <option value="hireDate">입사일 기준 초기화</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">입사일</label>
            <DatePicker value={formData.hireDate || ''} onChange={(date) => setFormData(prev => ({ ...prev, hireDate: date }))} min="2000-01-01" max="today" required />
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
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
          </div>
          
          {preview}
          
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-6 hover:bg-blue-700 active:bg-blue-800 transition shadow-md">
            저장하고 다음 단계로
          </button>
        </form>
      </div>
    </div>
  );
}
