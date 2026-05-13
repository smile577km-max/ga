"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { Holiday, HolidayType } from '@/types/holiday';
import { getKoreanDayOfWeek } from '@/lib/dateUtils';

export default function HolidaysPage() {
  const router = useRouter();
  const { appData, isLoaded, updateHolidays } = useAppData();
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<HolidayType>('company');
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isLoaded) return <div className="p-8 text-center">로딩 중...</div>;

  const currentHolidays = appData.holidays.filter(h => h.date.startsWith(year));

  const handleUpdateFromAPI = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/holidays?year=${year}`);
      const data = await res.json();
      if (data.success) {
        const apiHolidays: Holiday[] = data.data;
        const existingOverrides = appData.holidays.filter(h => h.overrideStatus !== 'none');
        const overrideIds = new Set(existingOverrides.map(h => h.id));
        
        const mergedHolidays = apiHolidays.filter(h => !overrideIds.has(h.id));
        mergedHolidays.push(...existingOverrides);
        
        const otherYearNonOverrides = appData.holidays.filter(h => !h.date.startsWith(year) && h.overrideStatus === 'none');
        
        updateHolidays([...otherYearNonOverrides, ...mergedHolidays]);
      }
    } catch (e) {
      console.error('API call failed', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = (id: string) => {
    const holiday = appData.holidays.find(h => h.id === id);
    if (!holiday) return;
    
    if (holiday.source === 'api' || holiday.source === 'mock') {
      const newHolidays = appData.holidays.map(h => h.id === id ? { ...h, overrideStatus: 'deleted' as const } : h);
      updateHolidays(newHolidays);
    } else {
      updateHolidays(appData.holidays.filter(h => h.id !== id));
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newHoliday: Holiday = {
      id: `manual-${Date.now()}`,
      date: newDate,
      name: newName,
      isHoliday: true,
      isNonWorkingDay: true,
      isSubstituteHoliday: false,
      holidayType: newType,
      source: 'manual',
      overrideStatus: 'added',
      updatedAt: Date.now()
    };
    updateHolidays([...appData.holidays, newHoliday]);
    setIsAdding(false);
    setNewDate('');
    setNewName('');
  };

  const displayHolidays = currentHolidays.filter(h => h.overrideStatus !== 'deleted').sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-white">
          <h1 className="text-2xl font-bold text-gray-800">휴무일 관리</h1>
          <button onClick={() => router.push('/')} className="text-blue-600 font-medium hover:underline">대시보드로 돌아가기</button>
        </div>

        <div className="p-6 bg-gray-50 flex gap-4 items-center">
          <select value={year} onChange={e => setYear(e.target.value)} className="border rounded p-2 outline-none text-gray-900 bg-white">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button onClick={handleUpdateFromAPI} disabled={isUpdating} className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded hover:bg-blue-200 transition">
            {isUpdating ? '업데이트 중...' : '한국 공휴일 자동 업데이트'}
          </button>
          <button onClick={() => setIsAdding(!isAdding)} className="px-4 py-2 bg-gray-800 text-white font-bold rounded hover:bg-gray-900 transition ml-auto">
            {isAdding ? '취소' : '+ 수동 추가'}
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAdd} className="p-6 border-b bg-blue-50 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold mb-1">날짜</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">휴무일명</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">유형</label>
              <select value={newType} onChange={e => setNewType(e.target.value as HolidayType)} className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white">
                <option value="company">회사 지정 휴무일</option>
                <option value="laborDay">근로자의 날</option>
                <option value="manual">개인 휴무일</option>
              </select>
            </div>
            <button type="submit" className="bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700 transition">추가하기</button>
          </form>
        )}

        <div className="p-6">
          <ul className="text-sm text-gray-500 mb-6 space-y-1">
            <li>• 안내: 한국 공휴일 데이터는 대한민국 기준으로 관리됩니다. API 호출 실패 시 저장된 샘플 데이터를 사용합니다.</li>
            <li>• 대체공휴일과 임시공휴일 반영을 위해 휴무일 데이터를 최신 상태로 유지해주세요.</li>
            <li>• 수동으로 추가/수정/삭제한 항목은 API 업데이트보다 우선 적용됩니다.</li>
          </ul>
          
          <table className="w-full text-left border-collapse mt-4">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-3 font-semibold text-gray-600">날짜</th>
                <th className="p-3 font-semibold text-gray-600">휴무일명</th>
                <th className="p-3 font-semibold text-gray-600">유형</th>
                <th className="p-3 font-semibold text-gray-600">출처</th>
                <th className="p-3 font-semibold text-right text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {displayHolidays.map(h => (
                <tr key={h.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-3 font-medium text-gray-800">{h.date} ({getKoreanDayOfWeek(h.date)})</td>
                  <td className="p-3">
                    <span className="font-semibold text-gray-800">{h.name}</span>
                    {h.isSubstituteHoliday && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2 font-bold">대체공휴일</span>}
                  </td>
                  <td className="p-3 text-sm text-gray-600">{h.holidayType === 'company' ? '회사 휴무' : h.holidayType === 'laborDay' ? '근로자의 날' : h.holidayType === 'manual' ? '수동 휴무' : '법정공휴일'}</td>
                  <td className="p-3 text-sm text-gray-500 uppercase">{h.source}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleDelete(h.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">삭제</button>
                  </td>
                </tr>
              ))}
              {displayHolidays.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
