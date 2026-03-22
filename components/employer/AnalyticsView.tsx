import React from 'react';
import { User, WorkLog, Machine, Organization, Branch } from '../../types';
import { format } from 'date-fns';
import { formatTime, formatDurationShort } from '../../utils';

interface AnalyticsViewProps {
  dashboardStats: any;
  users: User[];
  machines: Machine[];
  userPerms: any;
  handleForceFinish: (log: WorkLog) => void;
  branches: Branch[];
  onEditLog: (log: WorkLog) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  dashboardStats,
  users,
  machines,
  userPerms,
  handleForceFinish,
  branches,
  onEditLog
}) => {
  return (
    <div className="space-y-8 no-print">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Сейчас в работе */}
         <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Сейчас в работе</h3>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-900/30">
                    {dashboardStats.activeShifts.length} чел.
                  </span>
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
               </div>
            </div>
            
            <div className="space-y-3">
               {dashboardStats.activeShifts.length > 0 ? dashboardStats.activeShifts.map((s: WorkLog) => {
                  const emp = users.find(u => u.id === s.userId);
                  const machine = machines.find(m => m.id === s.machineId);
                  const machineName = machine?.name || 'Работа';
                  const isOld = s.date !== dashboardStats.todayStr;
                  
                  return (
                    <div 
                      key={s.id} 
                      onClick={() => onEditLog(s)}
                      className={`group/item relative bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-lg dark:hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] cursor-pointer ${isOld ? 'border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                       <div className="flex justify-between items-start mb-3">
                          <div className="min-w-0 flex-1">
                             <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold truncate ${isOld ? 'text-red-900 dark:text-red-200' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {emp?.name}
                                </span>
                                {emp?.isArchived && <span className="flex-shrink-0 text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">Архив</span>}
                             </div>
                             <div className="flex flex-col gap-0.5 mt-1">
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{emp?.position}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-black uppercase tracking-tight ${isOld ? 'text-red-500' : 'text-blue-500'}`}>
                                    {machineName}
                                  </span>
                                  {emp?.branchId && branches.find(b => b.id === emp.branchId) && (
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">
                                      • {branches.find(b => b.id === emp.branchId)?.name}
                                    </span>
                                  )}
                                </div>
                             </div>
                          </div>
                          <div className="text-right shrink-0">
                             <div className={`text-xs font-black px-2 py-1 rounded-lg border ${isOld ? 'text-red-600 dark:text-red-400 border-red-200 bg-white dark:bg-slate-900 dark:border-red-900/50' : 'text-blue-600 dark:text-blue-400 border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-900/20'}`}>
                                {formatTime(s.checkIn)}
                             </div>
                             {isOld && (
                               <div className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase mt-1 tracking-tighter">
                                 Начало: {format(new Date(s.date), 'dd.MM')}
                               </div>
                             )}
                          </div>
                       </div>

                       <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                             {s.isNightShift && (
                               <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md">
                                 <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                                 Ночь
                               </div>
                             )}
                             <span className="text-[9px] font-bold text-slate-400 uppercase">В работе</span>
                          </div>
                          
                          {userPerms.isFullAdmin && (
                            <button 
                               onClick={() => handleForceFinish(s)}
                               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isOld ? 'bg-red-600 text-white hover:bg-red-700 shadow-xl dark:shadow-slate-900/20 shadow-red-100 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:text-red-400'}`}
                            >
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                               Стоп
                            </button>
                          )}
                       </div>
                    </div>
                  );
               }) : (
                 <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-400 font-medium italic">Все отдыхают</p>
                 </div>
               )}
            </div>
         </div>
         
         {/* Смена (Сегодня) */}
         <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Смена (Сегодня)</h3>
               <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                 {dashboardStats.finishedToday.length} смен
               </span>
            </div>

            <div className="space-y-3">
               {dashboardStats.finishedToday.length > 0 ? dashboardStats.finishedToday.map((s: any) => {
                  const emp = users.find(u => u.id === s.userId);
                  return (
                    <div key={s.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 hover:shadow-lg dark:shadow-slate-900/20 transition-all">
                       <div className="flex justify-between items-start mb-3">
                          <div className="min-w-0 flex-1">
                             <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{emp?.name}</span>
                                {emp?.isArchived && <span className="flex-shrink-0 text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">Архив</span>}
                             </div>
                             <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                                   {formatTime(s.checkIn)} — {formatTime(s.checkOut)}
                                </span>
                             </div>
                          </div>
                          <div className="text-right shrink-0">
                             <div className="text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                {formatDurationShort(s.durationMinutes)}
                             </div>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-1.5 pt-3 border-t border-slate-50 dark:border-slate-800">
                          {s.isNightShift && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md">
                               <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                               Ночь
                            </div>
                          )}
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Завершено</span>
                       </div>
                    </div>
                  );
               }) : (
                 <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-400 font-medium italic">Нет завершенных смен</p>
                 </div>
               )}
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-slate-900 dark:bg-slate-950 p-7 rounded-[2.2rem] text-white shadow-2xl dark:shadow-slate-900/40 shadow-slate-200 dark:shadow-none border border-slate-800 dark:border-slate-800 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
               </div>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">Средняя выработка (7дн)</h3>
               <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tabular-nums">{dashboardStats.avgWeeklyHours.toFixed(1)}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase">часов / день</span>
               </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Топ пропусков</h3>
               <div className="space-y-4">
                  {dashboardStats.absenceCounts.length > 0 ? dashboardStats.absenceCounts.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center font-black text-xs">{i+1}</div>
                       <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.name}</p>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
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
