import React from 'react';

interface PrintWatermarkProps {
  teacherName?: string;
  schoolName?: string;
  publicRefId?: string;
  customText?: string;
}

export const PrintWatermark: React.FC<PrintWatermarkProps> = ({
  teacherName = '',
  schoolName = '',
  publicRefId = '',
  customText,
}) => {
  const displayText =
    customText ||
    `${schoolName ? schoolName + ' | ' : ''}${teacherName ? 'المعلم: ' + teacherName : ''}${
      publicRefId ? ' | ' + publicRefId : ''
    }`;

  if (!displayText.trim()) return null;

  return (
    <div className="pointer-events-none select-none overflow-hidden absolute inset-0 z-10 opacity-[0.06] flex flex-wrap items-center justify-center gap-16 p-8 transform -rotate-12 dir-rtl">
      {Array.from({ length: 24 }).map((_, idx) => (
        <div
          key={idx}
          className="text-slate-900 font-black text-sm tracking-widest whitespace-nowrap border-b border-slate-300 pb-1"
        >
          {displayText}
        </div>
      ))}
    </div>
  );
};
