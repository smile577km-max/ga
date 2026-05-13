"use client";

import { useState } from 'react';
import { toDateKey } from '@/lib/dateUtils';
import { getFridayWeekOrder } from '@/lib/timeCalculator';
import { Holiday } from '@/types/holiday';
import { LeaveRecord } from '@/types/leave';

export interface CalendarViewProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDateClick: (dateKey: string) => void;
  holidays: Holiday[];
  records: LeaveRecord[];
}

export function CalendarView({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  holidays,
  records
}: CalendarViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startEmptyDays = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < startEmptyDays; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-100 bg-gray-50"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateKey = toDateKey(date);
      const dayOfWeek = date.getDay();
      
      const holiday = holidays.find(h => h.date === dateKey && h.overrideStatus !== 'deleted');
      const dayRecords = records.filter(r => r.date === dateKey);
      
      const isToday = dateKey === toDateKey(new Date());
      const isEarlyFriday = dayOfWeek === 5 && getFridayWeekOrder(dateKey) > 0;
      
      let bgClass = "bg-white";
      let textClass = "text-gray-800";
      
      if (dayOfWeek === 0 || dayOfWeek === 6 || holiday?.isHoliday || holiday?.isNonWorkingDay) {
        bgClass = "bg-red-50/50";
        textClass = "text-red-600";
      }
      if (isToday) bgClass += " ring-2 ring-blue-500 inset-0 z-10";

      days.push(
        <div key={dateKey} onClick={() => onDateClick(dateKey)} className={`min-h-[120px] p-2 border border-gray-100 hover:bg-gray-100 cursor-pointer transition relative ${bgClass} ${dayRecords.length > 0 ? 'bg-blue-50/30' : ''}`}>
          <div className={`font-bold text-sm ${textClass}`}>{i}</div>
          
          <div className="mt-1 space-y-1">
            {holiday && <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${holiday.isSubstituteHoliday ? 'bg-red-100 text-red-700' : holiday.holidayType === 'company' ? 'bg-red-100 text-red-700' : 'bg-red-100 text-red-700'}`}>
              {holiday.holidayType === 'company' ? '회사 휴무' : holiday.holidayType === 'laborDay' ? '근로자의 날' : holiday.isSubstituteHoliday ? '대체공휴일' : holiday.name}
            </div>}
            {isEarlyFriday && !holiday && <div className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded truncate">조기퇴근 (금)</div>}
            
            {dayRecords.map(r => (
              <div key={r.id} className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded truncate">
                {r.type === 'full' ? '연차' : r.type === 'morningHalf' ? '오전 반차' : r.type === 'afternoonHalf' ? '오후 반차' : '시간연차'}
              </div>
            ))}
            {dayRecords.some(r => r.type === 'hourly') && (
              <div className="absolute bottom-2 right-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full block"></span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center bg-white">
        <button type="button" onClick={onPrevMonth} className="px-3 py-1.5 border rounded-lg font-medium hover:bg-gray-50 transition text-sm">&larr; 이전 달</button>
        <h2 className="text-lg font-bold text-gray-800">{year}년 {month + 1}월</h2>
        <button type="button" onClick={onNextMonth} className="px-3 py-1.5 border rounded-lg font-medium hover:bg-gray-50 transition text-sm">다음 달 &rarr;</button>
      </div>

      <div className="grid grid-cols-7 border-b">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={`p-2 text-center font-bold text-xs border-r last:border-r-0 ${i === 0 || i === 6 ? 'text-red-500 bg-red-50/30' : 'text-gray-600 bg-gray-50'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-b border-l">
        {renderDays().map((el, idx) => (
          <div key={idx} className="border-b border-r border-t-0 border-l-0">{el}</div>
        ))}
      </div>
    </div>
  );
}
