import * as XLSX from 'xlsx';
import { LeaveRecord, LeaveRecordType } from '@/types/leave';
import { toDateKey, addDaysByDateKey, parseDateKey } from './dateUtils';
import { subtractLunchMinutes } from './timeCalculator';
import { UserSettings } from '@/types/settings';
import { getCurrentLeaveCycle } from './periodCalculator';
import { getTodayDateKeyInKorea } from './dateUtils';
import { Holiday } from '@/types/holiday';
import { isHolidayOrNonWorkingDay } from './connectedUsageCalculator';

export interface ExcelParsedResult {
  records: Partial<LeaveRecord>[];
  ignoredCount: number;
  preview: {
    toReflect: ExcelPreviewItem[];
    noDeduction: ExcelPreviewItem[];
    needsCheck: ExcelPreviewItem[];
    duplicates: ExcelPreviewItem[];
    excludedByStatus: ExcelPreviewItem[];
    outOfPeriod: ExcelPreviewItem[];
  };
  attendanceUpdates?: Record<string, boolean>; // YYYY-MM: false
  debugInfo?: {
    resetRule: string;
    hireDate: string;
    today: string;
    cycleStart: string;
    cycleEnd: string;
  };
}

export interface ExcelPreviewItem {
  date: string;
  originalType: string;
  mappedType: string;
  memo: string;
  status?: string;
  displayValue: string;
  reason?: string;
}

const NO_DEDUCTION_KEYWORDS = ['무급', '유급', '예비군', '민방위', '조기퇴근', '출산 휴가', '출산휴가', '생일반차', '생일 반차', '생일휴가', '생일 휴가'];

export async function parseExcelLeaveFile(file: File, existingRecords: LeaveRecord[], settings: UserSettings, holidays: Holiday[]): Promise<ExcelParsedResult> {
  console.log('[EXCEL] Parsing with standardized cycle logic for file:', file.name);
  const todayKey = getTodayDateKeyInKorea();
  const { cycleStartDate, cycleEndDate } = getCurrentLeaveCycle(settings, todayKey);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
        
        if (rows.length === 0) {
          return resolve({ records: [], ignoredCount: 0, preview: { toReflect: [], noDeduction: [], needsCheck: [], duplicates: [], excludedByStatus: [], outOfPeriod: [] } });
        }

        const typeCol = 2, dateCol = 3, startTimeCol = 4, endDateCol = 5, endTimeCol = 6, dayCol = 7, hourCol = 8, memoCol = 9, statusCol = 14;

        let dataStartIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i][typeCol] === '구분' || rows[i][dateCol] === '시작시간 날짜') { dataStartIdx = i + 1; break; }
        }

        const dataRows = rows.slice(dataStartIdx);
        const result: ExcelParsedResult = { 
          records: [], ignoredCount: 0, 
          preview: { toReflect: [], noDeduction: [], needsCheck: [], duplicates: [], excludedByStatus: [], outOfPeriod: [] },
          attendanceUpdates: {},
          debugInfo: {
            resetRule: settings.resetRule || '미설정',
            hireDate: settings.hireDate || '미설정',
            today: todayKey,
            cycleStart: cycleStartDate,
            cycleEnd: cycleEndDate
          }
        };

        const simpleLateMonthlyCounts: Record<string, number> = {};
        const monthDeductedOneHour: Record<string, boolean> = {};

        dataRows.forEach((row) => {
          if (!row[typeCol] || !row[dateCol]) return;

          const rawType = String(row[typeCol]).trim();
          const rawDateStr = String(row[dateCol]).trim();
          const rawEndDateStr = row[endDateCol] ? String(row[endDateCol]).trim() : '';
          const memo = String(row[memoCol] || '').trim();
          const status = String(row[statusCol] || '').trim();

          // 0. Status Filter (Column O)
          const EXCLUDE_STATUS = ['반려', '취소', '삭제', '임시저장'];
          if (EXCLUDE_STATUS.some(s => status.includes(s))) {
            const startKey = rawDateStr.includes('-') ? rawDateStr : toDateKey(new Date(rawDateStr));
            result.preview.excludedByStatus.push({
              date: startKey,
              originalType: rawType,
              mappedType: '',
              memo: status,
              displayValue: '처리상태 제외'
            });
            return;
          }

          const startKey = rawDateStr.includes('-') ? rawDateStr : toDateKey(new Date(rawDateStr));
          const endKey = rawEndDateStr ? (rawEndDateStr.includes('-') ? rawEndDateStr : toDateKey(new Date(rawEndDateStr))) : startKey;

          let current = startKey;
          while (current <= endKey) {
            const previewItem: ExcelPreviewItem = { date: current, originalType: rawType, mappedType: '', memo: memo || rawType, displayValue: '' };

            // 1. Period Filter
            if (current < cycleStartDate || current >= cycleEndDate) {
              result.preview.outOfPeriod.push({ ...previewItem, reason: '현재 연차 기간 밖 내역' });
              current = addDaysByDateKey(current, 1);
              continue;
            }

            // 2. Holiday/Weekend Filter
            const isNonWorking = isHolidayOrNonWorkingDay(current, holidays);
            if (isNonWorking && !rawType.includes('시간연차') && !['조퇴', '병가', '지각'].some(k => rawType.includes(k))) {
              current = addDaysByDateKey(current, 1);
              continue;
            }

            // 3. Keyword Match
            const searchStr = (rawType + ' ' + memo).trim();
            const foundNoDeduction = NO_DEDUCTION_KEYWORDS.find(k => searchStr.includes(k));
            if (foundNoDeduction) {
              result.preview.noDeduction.push({ ...previewItem, originalType: foundNoDeduction, displayValue: '차감 없음' });
              current = addDaysByDateKey(current, 1);
              continue;
            }

            // 4. Service Year Check
            const hireDate = settings.hireDate ? parseDateKey(settings.hireDate) : null;
            const currentDate = parseDateKey(current);
            let yearsOfService = 0;
            if (hireDate) {
              yearsOfService = currentDate.getFullYear() - hireDate.getFullYear();
              const anniversaryThisYear = new Date(currentDate.getFullYear(), hireDate.getMonth(), hireDate.getDate());
              if (currentDate < anniversaryThisYear) yearsOfService--;
            }

            // 5. Type Mapping & Late Rules
            let finalType: LeaveRecordType | 'UNKNOWN' = 'UNKNOWN';
            let deductedDays = 0, deductedMinutes = 0, displayValue = '', isValid = true;
            let isLate = rawType === '지각';

            if (isLate) {
              const arrivalTime = (String(row[endTimeCol] || '').trim() || String(row[startTimeCol] || '').trim());
              const monthKey = current.substring(0, 7); // YYYY-MM

              if (yearsOfService < 1) {
                // Rule 2: Under 1 year, late means no leave next month
                if (result.attendanceUpdates) result.attendanceUpdates[monthKey] = false;
                finalType = 'hourly';
                deductedMinutes = 0;
                displayValue = '만근 아님';
              } else {
                // Rule 3: 1 year or more, late deduction rules
                if (arrivalTime > '09:50' && arrivalTime < '10:50') {
                  // Simple Late
                  simpleLateMonthlyCounts[monthKey] = (simpleLateMonthlyCounts[monthKey] || 0) + 1;
                  if (simpleLateMonthlyCounts[monthKey] >= 2 && !monthDeductedOneHour[monthKey]) {
                    finalType = 'hourly';
                    deductedMinutes = 60;
                    displayValue = '시간연차 1시간';
                    monthDeductedOneHour[monthKey] = true;
                  } else {
                    finalType = 'hourly';
                    deductedMinutes = 0;
                    displayValue = '차감 없음';
                  }
                } else if (arrivalTime >= '10:50' && arrivalTime < '14:20') {
                  finalType = 'afternoonHalf'; // Or morningHalf, user said "반차 1회"
                  deductedDays = 0.5;
                  displayValue = '반차 1회';
                } else if (arrivalTime >= '14:20') {
                  finalType = 'full';
                  deductedDays = 1.0;
                  displayValue = '연차 1일';
                } else {
                  // Arrived before 09:50 but marked as late?
                  finalType = 'hourly';
                  deductedMinutes = 0;
                  displayValue = '차감 없음';
                }
              }
            } else if (rawType.includes('시간연차')) finalType = 'hourly';
            else if (rawType.includes('반차')) finalType = rawType.includes('오후') ? 'afternoonHalf' : 'morningHalf';
            else if (rawType.includes('연차')) finalType = 'full';
            else if (['조퇴', '병가'].some(k => rawType.includes(k))) finalType = 'hourly';

            if (finalType === 'UNKNOWN') {
              result.preview.needsCheck.push({ ...previewItem, reason: '구분 인식 불가', displayValue: '확인 필요' });
              current = addDaysByDateKey(current, 1);
              continue;
            }

            // 6. Finalizing Type & Calculation
            let mappedType: LeaveRecordType = finalType as LeaveRecordType;
            if (!isLate) {
              if (mappedType === 'full') {
                deductedDays = 1; displayValue = '연차 1일';
              } else if (mappedType === 'morningHalf' || mappedType === 'afternoonHalf') {
                deductedDays = 0.5; displayValue = '반차 1회';
              } else if (mappedType === 'hourly') {
                let mins = 0;
                const h = Number(row[hourCol]);
                if (!isNaN(h) && h > 0) mins = h * 60;
                else {
                  let s = String(row[startTimeCol] || '').trim(), e = String(row[endTimeCol] || '').trim();
                  if (s === '00:00' || s === '00:00:00' || s < '09:50') s = '09:50';
                  if (e > '17:50' || e === '23:59' || e === '23:59:00') e = '17:50';
                  if (s < e) mins = subtractLunchMinutes(s, e);
                }
                if (mins === 0 || (mins % 60 !== 0 && mins !== 210)) isValid = false;
                else {
                  if (mins >= 420) { mappedType = 'full'; deductedDays = 1; displayValue = '연차 1일'; }
                  else if (mins === 210) { mappedType = 'morningHalf'; deductedDays = 0.5; displayValue = '반차 1회'; }
                  else { deductedMinutes = mins; displayValue = `시간연차 ${mins / 60}시간`; }
                }
              }
            }

            if (!isValid) {
              result.preview.needsCheck.push({ ...previewItem, reason: '시간 단위 오류', displayValue: '확인 필요' });
              current = addDaysByDateKey(current, 1);
              continue;
            }

            previewItem.mappedType = mappedType;
            previewItem.displayValue = displayValue;

            if (existingRecords.some(r => r.date === current && r.type === mappedType && (mappedType !== 'hourly' || r.deductedMinutes === deductedMinutes))) {
              result.preview.duplicates.push({ ...previewItem, reason: '중복' });
            } else if (displayValue === '차감 없음' || displayValue === '만근 아님') {
              result.preview.noDeduction.push(previewItem);
            } else {
              result.preview.toReflect.push(previewItem);
              result.records.push({
                id: `excel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                date: current, type: mappedType, deductedDays, deductedMinutes, memo: previewItem.memo,
                source: 'excel', isInitial: true, createdAt: Date.now(), updatedAt: Date.now()
              });
            }
            current = addDaysByDateKey(current, 1);
          }
        });
        resolve(result);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
