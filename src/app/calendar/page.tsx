"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { CalendarView } from '@/components/CalendarView';

export default function CalendarPage() {
  const router = useRouter();
  const { appData, isLoaded } = useAppData();
  const [currentDate, setCurrentDate] = useState(new Date());

  if (!isLoaded) return <div className="p-8 text-center">로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDateClick = (dateKey: string) => {
    router.push(`/register?date=${dateKey}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-white">
          <h1 className="text-2xl font-bold text-gray-800">캘린더</h1>
          <button onClick={() => router.push('/')} className="text-blue-600 font-medium hover:underline">대시보드로 돌아가기</button>
        </div>

        <div className="p-6">
          <CalendarView 
            currentDate={currentDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onDateClick={handleDateClick}
            holidays={appData.holidays}
            records={appData.leaveRecords}
          />
          
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-gray-600 p-4 bg-gray-50 rounded-lg">
            <span className="font-bold text-gray-800 mr-2">범례:</span>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-50 border border-red-200 rounded"></span> 빨간색: 주말/공휴일/회사 휴무일</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-50/30 border border-blue-200 rounded"></span> 연한 배경: 사용 연차 입력일</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 ring-2 ring-blue-500 rounded-full bg-white"></span> 테두리: 오늘</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-600 rounded-full"></span> 점 표시: 시간연차 사용일</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-100 border border-green-200 rounded"></span> 금요일 조기퇴근</div>
          </div>
        </div>
      </div>
    </div>
  );
}
