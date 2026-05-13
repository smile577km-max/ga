import React from 'react';

export function FormattedLeaveUnits({ text, colorClass = "text-gray-900", valueClass = "text-base" }: { text: string, colorClass?: string, valueClass?: string }) {
  const parts = text.split(' · ');
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {parts.map((part, i) => {
        const spaceIndex = part.indexOf(' ');
        const label = part.substring(0, spaceIndex);
        const value = part.substring(spaceIndex + 1);

        return (
          <div key={i} className={`flex items-baseline gap-1.5 px-3 py-1 rounded-full border border-[#e0e0e0] bg-transparent`}>
            <span className="text-[12px] font-normal text-[#7a7a7a]">{label}</span>
            <span className={`${valueClass} font-semibold text-[#1d1d1f]`}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
