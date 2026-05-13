"use client";

import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/providers/AppDataProvider';
import { getKoreanDayOfWeek, toDateKey } from '@/lib/dateUtils';
import { formatLeaveUnits } from '@/lib/leaveFormatter';

import { FormattedLeaveUnits } from '@/components/FormattedLeaveUnits';

export default function HistoryPage() {
  const router = useRouter();
  const { appData, isLoaded, updateLeaveRecords } = useAppData();
  
  if (!isLoaded) return <div className="p-8 text-center">로딩 중...</div>;

  const handleDelete = (id: string) => {
    updateLeaveRecords(appData.leaveRecords.filter(r => r.id !== id));
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'full': return '연차 (1일)';
      case 'morningHalf': return '오전 반차';
      case 'afternoonHalf': return '오후 반차';
      case 'hourly': return '시간연차';
      default: return type;
    }
  };

  const sortedRecords = [...appData.leaveRecords].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0">
          <h1 className="text-2xl font-bold text-gray-800">사용 내역</h1>
          <button onClick={() => router.push('/')} className="text-sm font-medium text-blue-600 hover:underline">대시보드로 돌아가기</button>
        </div>
        
        <div className="p-6 bg-blue-50/50 border-b border-gray-100 text-sm text-gray-500">
          <p>이 내역은 남은 연차 계산을 위한 개인 입력 내역입니다. 회사 공식 연차 신청/승인 내역이 아닙니다.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-sm text-gray-500 font-medium">
                <th className="p-4">사용 날짜</th>
                <th className="p-4">사용 유형</th>
                <th className="p-4">사용 시간 / 차감 일수</th>
                <th className="p-4">메모</th>
                <th className="p-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-gray-500">입력된 사용 내역이 없습니다.</td>
                </tr>
              ) : (
                sortedRecords.map((record) => (
                  <tr key={record.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900 text-sm">{record.date}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{getKoreanDayOfWeek(record.date)}요일</span>
                        {record.date <= toDateKey(new Date()) ? (
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">사용 완료</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">사용 예정</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                        {getTypeName(record.type)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-700">
                      {record.type === 'hourly' ? <div className="mb-1 text-xs text-gray-500">{record.startTime} ~ {record.endTime}</div> : null}
                      <FormattedLeaveUnits text={formatLeaveUnits(record.deductedDays)} valueClass="text-sm" />
                    </td>
                    <td className="p-4 text-sm text-gray-600">{record.memo || '-'}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(record.id)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition">삭제</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
