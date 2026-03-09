import React, { memo } from 'react';
import { formatDuration, formatDurationShort } from '../../utils';
import { Machine } from '../../types';

interface EmployeeStatsProps {
  stats: {
    workDays: number;
    workTime: number;
    sick: number;
    vacation: number;
    off: number;
  };
  onShowMachineStats?: () => void;
}

export const EmployeeStats = memo<EmployeeStatsProps>(({ stats, onShowMachineStats }) => {
  return (
    <div className="space-y-4 mb-6 no-print">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Отработано дней</p>
            <p className="text-2xl font-black text-slate-900">{stats.workDays}</p>
         </div>
         <button 
           onClick={onShowMachineStats}
           className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left hover:bg-blue-50 transition-colors group"
         >
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 group-hover:text-blue-400 transition-colors">Всего времени</p>
            <p className="text-2xl font-black text-blue-600">{formatDuration(stats.workTime)}</p>
         </button>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Болезни</p>
            <p className="text-2xl font-black text-red-500">{stats.sick}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Отпуска</p>
            <p className="text-2xl font-black text-purple-600">{stats.vacation}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Выходные</p>
            <p className="text-2xl font-black text-slate-400">{stats.off}</p>
         </div>
      </section>
    </div>
  );
});
