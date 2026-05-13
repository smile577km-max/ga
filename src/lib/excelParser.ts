import * as XLSX from 'xlsx';
import { LeaveRecord, LeaveRecordType } from '@/types/leave';
import { toDateKey } from './dateUtils';
import { subtractLunchMinutes } from './timeCalculator';
import { UserSettings } from '@/types/settings';
import { getCurrentLeavePeriod, isDateInCurrentPeriod } from './periodCalculator';
import { getTodayDateKeyInKorea } from './dateUtils';

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

export async function parseExcelLeaveFile(file: File, existingRecords: LeaveRecord[], settings: UserSettings): Promise<ExcelParsedResult> {
  console.log('[EXCEL] Parsing with C-I columns logic for file:', file.name);
  const todayKey = getTodayDateKeyInKorea();
  const period = getCurrentLeavePeriod(settings, todayKey);
  console.log(`[EXCEL] Current Period: ${period.start} ~ ${period.end}`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
        
        console.log('[EXCEL] Total Rows:', rows.length);
        if (rows.length === 0) {
          return resolve({ records: [], ignoredCount: 0, preview: { toReflect: [], noDeduction: [], needsCheck: [], duplicates: [], excludedByStatus: [], outOfPeriod: [] } });
        }

        // C-I column indices (0-based)
        const typeCol = 2;
        const dateCol = 3;
        const startTimeCol = 4;
        const endDateCol = 5;
        const endTimeCol = 6;
        const dayCol = 7;
        const hourCol = 8;
        const memoCol = 9; // Still useful for memo if available

        // Find where data starts (skip until row has something in C or D)
        let dataStartIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i][typeCol] === '구분' || rows[i][dateCol] === '시작시간 날짜') {
            dataStartIdx = i + 1;
            break;
          }
        }

        const dataRows = rows.slice(dataStartIdx);
        const result: ExcelParsedResult = { 
          records: [], 
          ignoredCount: 0, 
          preview: { toReflect: [], noDeduction: [], needsCheck: [], duplicates: [], excludedByStatus: [], outOfPeriod: [] } 
        };

        dataRows.forEach((row) => {
          if (!row[typeCol] || !row[dateCol]) return;

          const rawType = String(row[typeCol]).trim();
          const rawDate = String(row[dateCol]).trim();
          const date = rawDate.includes('-') ? rawDate : toDateKey(new Date(rawDate));
          const memo = String(row[memoCol] || '').trim();

          const previewItem: ExcelPreviewItem = {
            date,
            originalType: rawType,
            mappedType: '',
            memo: memo || rawType,
            displayValue: ''
          };

          // New: Filter by period
          if (!isDateInCurrentPeriod(date, period)) {
            result.preview.outOfPeriod.push({ ...previewItem, reason: '현재 연차 사용 기간 밖 내역' });
            return;
          }

          // 1. Keyword check
          let finalType: LeaveRecordType | 'NO_DEDUCTION' | 'UNKNOWN' = 'UNKNOWN';
          const noDeductionSearch = (rawType + ' ' + memo).trim();
          
          if (NO_DEDUCTION_KEYWORDS.some(k => noDeductionSearch.includes(k))) finalType = 'NO_DEDUCTION';
          else if (rawType.includes('시간연차')) finalType = 'hourly';
          else if (rawType.includes('반차')) {
             if (rawType.includes('오후')) finalType = 'afternoonHalf';
             else finalType = 'morningHalf';
          }
          else if (rawType.includes('연차')) finalType = 'full';
          else if (['조퇴', '병가', '지각'].some(k => rawType.includes(k))) finalType = 'hourly';

          if (finalType === 'UNKNOWN') {
            result.preview.needsCheck.push({ ...previewItem, reason: '구분 인식 불가', displayValue: '확인 필요' });
            return;
          }

          if (finalType === 'NO_DEDUCTION') {
            result.preview.noDeduction.push({ ...previewItem, displayValue: '차감 없음' });
            return;
          }

          // 2. Calculation
          let mappedType: LeaveRecordType = finalType;
          let deductedDays = 0;
          let deductedMinutes = 0;
          let displayValue = '';
          let isValid = true;

          if (mappedType === 'full') {
            const d = Number(row[dayCol]);
            deductedDays = (isNaN(d) || d === 0) ? 1 : d;
            displayValue = `연차 ${deductedDays}일`;
          } else if (mappedType === 'morningHalf' || mappedType === 'afternoonHalf') {
            deductedDays = 0.5;
            displayValue = '반차 1회';
          } else if (mappedType === 'hourly') {
            let mins = 0;
            const h = Number(row[hourCol]);
            if (!isNaN(h) && h > 0) {
              mins = h * 60;
            } else {
              let s = String(row[startTimeCol] || '').trim();
              let e = String(row[endTimeCol] || '').trim();
              // Clamping
              if (s === '00:00' || s === '00:00:00' || s < '09:50') s = '09:50';
              if (e > '17:50' || e === '23:59' || e === '23:59:00') e = '17:50';
              if (s < e) mins = subtractLunchMinutes(s, e);
            }

            if (mins === 0 || (mins % 60 !== 0 && mins !== 210)) {
              isValid = false;
            } else {
              if (mins >= 420) {
                mappedType = 'full'; deductedDays = 1; displayValue = '연차 1일';
              } else if (mins === 210) {
                mappedType = 'morningHalf'; deductedDays = 0.5; displayValue = '반차 1회';
              } else {
                deductedMinutes = mins; displayValue = `시간연차 ${mins / 60}시간`;
              }
            }
          }

          if (!isValid) {
            result.preview.needsCheck.push({ ...previewItem, reason: '시간 단위 오류', displayValue: '확인 필요' });
            return;
          }

          previewItem.mappedType = mappedType;
          previewItem.displayValue = displayValue;

          // 3. Duplicate check
          if (existingRecords.some(r => r.date === date && r.type === mappedType && (mappedType !== 'hourly' || r.deductedMinutes === deductedMinutes))) {
            result.preview.duplicates.push({ ...previewItem, reason: '중복' });
          } else {
            result.preview.toReflect.push(previewItem);
            result.records.push({
              id: `excel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              date,
              endDate: (row[endDateCol] && row[endDateCol] !== row[dateCol]) ? String(row[endDateCol]) : undefined,
              type: mappedType,
              deductedDays,
              deductedMinutes,
              memo: previewItem.memo,
              source: 'excel',
              isInitial: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        });

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
