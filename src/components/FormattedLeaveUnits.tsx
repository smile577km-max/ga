import React from 'react';

export function FormattedLeaveUnits({ text, colorClass = "text-gray-900", valueClass = "text-base" }: { text: string, colorClass?: string, valueClass?: string }) {
  const parts = text.split(' · ');
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {parts.map((part, i) => {
        const spaceIndex = part.indexOf(' ');
        const label = part.substring(0, spaceIndex);
        const value = part.substring(spaceIndex + 1);
        return (
          <div key={i} className="flex items-baseline gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-xs font-semibold text-gray-500">{label}</span>
            <span className={`${valueClass} font-bold ${colorClass}`}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
