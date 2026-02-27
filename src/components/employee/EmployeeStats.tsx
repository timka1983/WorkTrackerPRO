import React, { memo } from 'react';
import { formatDuration } from '../../../utils';

interface EmployeeStatsProps {
  stats: {
    workDays: number;
    workTime: number;
    sick: number;
    vacation: number;
    off: number;
  };
}

const EmployeeStats: React.FC<EmployeeStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-xl shadow-slate-200">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Отработано</p>
        <p className="text-2xl font-black tabular-nums">{stats.workDays} <span className="text-[10px] text-slate-500">дн.</span></p>
      </div>
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Всего часов</p>
        <p className="text-2xl font-black text-slate-900 tabular-nums">{formatDuration(stats.workTime)}</p>
      </div>
      <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Выходные</p>
        <p className="text-2xl font-black text-blue-600 tabular-nums">{stats.off}</p>
      </div>
      <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">Больничные</p>
        <p className="text-2xl font-black text-amber-600 tabular-nums">{stats.sick}</p>
      </div>
      <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100">
        <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">Отпуск</p>
        <p className="text-2xl font-black text-purple-600 tabular-nums">{stats.vacation}</p>
      </div>
    </div>
  );
};

export default memo(EmployeeStats);
