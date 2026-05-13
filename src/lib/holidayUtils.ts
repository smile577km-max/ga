import { Holiday, HolidayType, HolidaySource, OverrideStatus } from '@/types/holiday';
import { getKoreanDayOfWeek, isWeekend } from './dateUtils';

export function generateMockHolidays(years: number[]): Holiday[] {
  const recurringHolidays = [
    { month: 1, day: 1, name: '신정', type: 'public' as HolidayType },
    { month: 3, day: 1, name: '삼일절', type: 'public' as HolidayType },
    { month: 5, day: 1, name: '근로자의 날', type: 'laborDay' as HolidayType },
    { month: 5, day: 5, name: '어린이날', type: 'public' as HolidayType },
    { month: 6, day: 6, name: '현충일', type: 'public' as HolidayType },
    { month: 8, day: 15, name: '광복절', type: 'public' as HolidayType },
    { month: 10, day: 3, name: '개천절', type: 'public' as HolidayType },
    { month: 10, day: 9, name: '한글날', type: 'public' as HolidayType },
    { month: 12, day: 25, name: '성탄절', type: 'public' as HolidayType },
  ];

  // Specific dates for 2026
  const specific2026 = [
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
  ];

  // Specific dates for 2027
  const specific2027 = [
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-02-09', name: '대체공휴일(설날)' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-09-14', name: '추석 연휴' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 연휴' },
  ];

  const holidays: Holiday[] = [];

  years.forEach(year => {
    recurringHolidays.forEach(h => {
      const dateStr = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
      holidays.push({
        id: `mock-${dateStr}`,
        date: dateStr,
        name: h.name,
        isHoliday: true,
        isNonWorkingDay: true,
        isSubstituteHoliday: false,
        holidayType: h.type,
        source: 'mock' as HolidaySource,
        overrideStatus: 'none' as OverrideStatus,
        updatedAt: Date.now(),
      });
    });

    if (year === 2026) {
      specific2026.forEach(h => {
        holidays.push({
          id: `mock-${h.date}`,
          date: h.date,
          name: h.name,
          isHoliday: true,
          isNonWorkingDay: true,
          isSubstituteHoliday: h.name.includes('대체'),
          holidayType: h.name.includes('대체') ? 'substitute' : 'public',
          source: 'mock' as HolidaySource,
          overrideStatus: 'none' as OverrideStatus,
          updatedAt: Date.now(),
        });
      });
    }

    if (year === 2027) {
      specific2027.forEach(h => {
        holidays.push({
          id: `mock-${h.date}`,
          date: h.date,
          name: h.name,
          isHoliday: true,
          isNonWorkingDay: true,
          isSubstituteHoliday: h.name.includes('대체'),
          holidayType: h.name.includes('대체') ? 'substitute' : 'public',
          source: 'mock' as HolidaySource,
          overrideStatus: 'none' as OverrideStatus,
          updatedAt: Date.now(),
        });
      });
    }
  });

  return holidays;
}

interface UpcomingHolidaysParams {
  holidays: Holiday[];
  today: string;
  resetDate: string;
}

export function getUpcomingWeekdayHolidays({
  holidays,
  today,
  resetDate
}: UpcomingHolidaysParams): Holiday[] {
  const activeHolidays = holidays.filter(h => h.overrideStatus !== 'deleted');
  const filteredHolidays = activeHolidays.filter(h => h.date >= today && h.date < resetDate);
  
  const weekdayHolidays = filteredHolidays.filter(h => !isWeekend(h.date));

  const finalHolidays = weekdayHolidays.filter(h => 
    h.isHoliday || h.isNonWorkingDay || h.isSubstituteHoliday || h.holidayType === 'company'
  );

  return finalHolidays.sort((a, b) => a.date.localeCompare(b.date));
}
