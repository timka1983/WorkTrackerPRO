import React, { memo } from 'react';
import { WorkLog, EntryType } from '../../types';
import { formatTime, formatDurationShort } from '../../utils';

interface TodaySessionsProps {
  todayLogs: WorkLog[];
  getMachineName: (id?: string) => string;
}

export const TodaySessions = memo<TodaySessionsProps>(({ todayLogs, getMachineName }) => {
  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Журнал сессий за сегодня</h3>
      <div className="overflow-hidden border border-slate-100 rounded-2xl">
         <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Объект / Статус</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Начало</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Конец</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Время</th>
              </tr>
            </thead>
            <tbody>
              {todayLogs.length > 0 ? todayLogs.map(log => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight flex items-center gap-1 w-fit ${log.entryType === EntryType.WORK ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {log.isNightShift && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                      {log.entryType === EntryType.WORK ? getMachineName(log.machineId) : 'Отсутствие'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-600">{log.checkIn ? formatTime(log.checkIn) : '--:--'}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-600">{log.checkOut ? formatTime(log.checkOut) : '--:--'}</td>
                  <td className="px-4 py-3 font-black text-slate-900 text-right">{log.durationMinutes > 0 ? formatDurationShort(log.durationMinutes) : (log.entryType === EntryType.WORK && !log.checkOut ? '--:--' : '0:00')}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-300 italic text-xs font-medium">Записей пока нет</td>
                </tr>
              )}
            </tbody>
         </table>
      </div>
    </section>
  );
});
