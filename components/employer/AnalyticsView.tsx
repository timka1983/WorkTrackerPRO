import React from 'react';
import { User, WorkLog, Machine, Organization } from '../../types';
import { format } from 'date-fns';
import { formatTime, formatDurationShort } from '../../utils';

interface AnalyticsViewProps {
  dashboardStats: any;
  users: User[];
  machines: Machine[];
  userPerms: any;
  handleForceFinish: (log: WorkLog) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  dashboardStats,
  users,
  machines,
  userPerms,
  handleForceFinish
}) => {
  return (
    <div className="space-y-8 no-print">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Сейчас в работе</h3>
               <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <div className="space-y-3">
               {dashboardStats.activeShifts.length > 0 ? dashboardStats.activeShifts.map((s: WorkLog) => {
                  const emp = users.find(u => u.id === s.userId);
                  const machine = machines.find(m => m.id === s.machineId);
                  const machineName = machine?.name || 'Работа';
                  const isOld = s.date !== dashboardStats.todayStr;
                  
                  return (
                    <div key={s.id} className={`group/item flex justify-between items-center p-3 rounded-xl border transition-all ${isOld ? 'bg-red-50 border-red-200 hover:bg-white shadow-sm' : 'bg-blue-50 border-blue-100 hover:bg-white'}`}>
                       <div className="flex-1 pr-2">
                          <span className={`text-xs font-bold block truncate ${isOld ? 'text-red-900' : 'text-slate-700'}`}>{emp?.name}</span>
                          <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 flex items-center gap-1 ${isOld ? 'text-red-500' : 'text-blue-500'}`}>
                            {s.isNightShift && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                            {machineName}
                          </span>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="flex flex-col items-end">
                           {isOld && (
                             <span className="text-[8px] font-black text-red-600 uppercase mb-0.5 tracking-tighter">
                               Начало: {format(new Date(s.date), 'dd.MM')}
                             </span>
                           )}
                           <span className={`text-[10px] font-black bg-white px-2 py-0.5 rounded-lg border ${isOld ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-100'}`}>
                             {formatTime(s.checkIn)}
                           </span>
                         </div>
                         <div className="flex flex-col items-center gap-1">
                            {userPerms.isFullAdmin && (
                            <button 
                               onClick={() => handleForceFinish(s)}
                               className={`hidden group-hover/item:flex items-center justify-center p-1.5 text-white rounded-lg transition-colors shadow-sm ${isOld ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}
                               title="Принудительно завершить"
                            >
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            )}
                            <span className={`hidden group-hover/item:block text-[6px] font-black uppercase leading-none tracking-tighter ${isOld ? 'text-red-600' : 'text-red-400'}`}>СТОП {machineName.split(' ')[0]}</span>
                         </div>
                       </div>
                    </div>
                  );
               }) : <p className="text-xs text-slate-400 italic py-4 text-center">Все отдыхают</p>}
            </div>
         </div>
         
         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Смена (Сегодня)</h3>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
               {dashboardStats.finishedToday.length > 0 ? dashboardStats.finishedToday.map((s: any) => {
                  const emp = users.find(u => u.id === s.userId);
                  return (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                             {s.isNightShift && <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                             {emp?.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Начало: {formatTime(s.checkIn)} | Конец: {formatTime(s.checkOut)}</span>
                       </div>
                       <span className="text-[11px] font-black text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200">{formatDurationShort(s.durationMinutes)}</span>
                    </div>
                  );
               }) : <p className="text-xs text-slate-400 italic py-4 text-center">Нет завершенных смен</p>}
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-slate-900 p-7 rounded-[2.2rem] text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
               </div>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">Средняя выработка (7дн)</h3>
               <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tabular-nums">{dashboardStats.avgWeeklyHours.toFixed(1)}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase">часов / день</span>
               </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Топ пропусков</h3>
               <div className="space-y-4">
                  {dashboardStats.absenceCounts.length > 0 ? dashboardStats.absenceCounts.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black text-xs">{i+1}</div>
                       <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{a.name}</p>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                             <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min((a.count / 10) * 100, 100)}%` }}></div>
                          </div>
                       </div>
                       <span className="text-[10px] font-black text-slate-400 tabular-nums">{a.count} дн.</span>
                    </div>
                  )) : <p className="text-xs text-slate-400 italic text-center py-4">Без пропусков в этом месяце</p>}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
