import { NextResponse } from 'next/server';
import { mockHolidays } from '@/lib/mockHolidays';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || new Date().getFullYear().toString();

  // Here you would normally fetch from 공공데이터포털
  // e.g., fetch(`http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${process.env.HOLIDAY_API_KEY}`)
  
  // For now, return mock data
  const yearHolidays = mockHolidays.filter(h => h.date.startsWith(year));
  
  return NextResponse.json({
    success: true,
    data: yearHolidays,
    source: 'mock'
  });
}
