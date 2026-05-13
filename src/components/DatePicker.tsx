"use client";

import { useState, useRef, useEffect } from 'react';
import { toDateKey, getTodayDateKeyInKorea } from '@/lib/dateUtils';

interface DatePickerProps {
  value: string;
  onChange: (dateKey: string) => void;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
}

export function DatePicker({ value, onChange, className = '', min, max, required }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date(value || new Date()));
  const [inputValue, setInputValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setInputValue(value || '');
    if (value) {
      const dt = new Date(value);
      if (!isNaN(dt.getTime())) setCurrentDate(dt);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(e.target.value)) {
      const dt = new Date(e.target.value);
      if (!isNaN(dt.getTime())) {
        const dateStr = e.target.value;
        const kstToday = getTodayDateKeyInKorea();
        
        let isValid = true;
        if (min && dateStr < min) isValid = false;
        if (max === 'today' && dateStr > kstToday) isValid = false;
        else if (max && max !== 'today' && dateStr > max) isValid = false;

        if (isValid) {
          setCurrentDate(dt);
          onChange(e.target.value);
        }
      }
    }
  };

  const handleDateClick = (date: Date) => {
    const key = toDateKey(date);
    onChange(key);
    setIsOpen(false);
  };

  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onChange(toDateKey(today));
    setIsOpen(false);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentDate(new Date(Number(e.target.value), month, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentDate(new Date(year, Number(e.target.value), 1));
  };

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startEmptyDays = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const currentKoreanYear = parseInt(getTodayDateKeyInKorea().split('-')[0], 10);
  
  let startYear = new Date().getFullYear() - 10;
  if (min) {
    const minD = new Date(min);
    if (!isNaN(minD.getTime())) startYear = minD.getFullYear();
  }
  
  let endYear = new Date().getFullYear() + 10;
  if (max === 'today') {
    endYear = currentKoreanYear;
  } else if (max) {
    const maxD = new Date(max);
    if (!isNaN(maxD.getTime())) endYear = maxD.getFullYear();
  }

  startYear = Math.min(startYear, currentKoreanYear);
  endYear = Math.max(endYear, startYear);
  
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="YYYY-MM-DD"
          className={`w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white ${className}`}
          onClick={() => setIsOpen(true)}
          required={required}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 text-gray-400 hover:text-blue-600 p-1"
        >
          📅
        </button>
      </div>

      {isOpen && (
        <div 
          className="absolute top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[99] sm:w-[320px]"
          style={{ width: 'min(100vw - 32px, 320px)', left: 0 }}
        >
          <div className="flex justify-between items-center mb-3">
            <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="px-2 py-1 text-sm bg-gray-50 rounded hover:bg-gray-100">&larr;</button>
            <div className="flex gap-1">
              <select value={year} onChange={handleYearChange} className="p-1 border rounded text-sm bg-white font-medium text-gray-800">
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={month} onChange={handleMonthChange} className="p-1 border rounded text-sm bg-white font-medium text-gray-800">
                {months.map(m => <option key={m} value={m}>{m + 1}월</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="px-2 py-1 text-sm bg-gray-50 rounded hover:bg-gray-100">&rarr;</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`text-center text-xs font-bold py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startEmptyDays }).map((_, i) => (
              <div key={`empty-${i}`} className="p-1"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dateObj = new Date(year, month, d);
              const dateStr = toDateKey(dateObj);
              const kstToday = getTodayDateKeyInKorea();
              const isToday = dateStr === kstToday;
              const isSelected = dateStr === value;
              
              let isDisabled = false;
              if (min && dateStr < min) isDisabled = true;
              if (max === 'today') {
                if (dateStr > kstToday) isDisabled = true;
              } else if (max && dateStr > max) {
                isDisabled = true;
              }

              return (
                <button
                  key={d}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDateClick(dateObj)}
                  className={`p-1.5 text-sm rounded-md transition ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-blue-50 text-gray-700'} ${isSelected ? 'bg-blue-600 text-white font-bold hover:bg-blue-700' : isToday ? 'ring-1 ring-blue-400 font-bold' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={goToday} className="text-xs font-bold text-blue-600 px-3 py-1.5 bg-blue-50 rounded hover:bg-blue-100">오늘</button>
            <button type="button" onClick={() => setIsOpen(false)} className="text-xs font-bold text-gray-600 px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
