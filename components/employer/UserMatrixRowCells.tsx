import React, { memo } from 'react';
import { WorkLog, User, EntryType } from '../../types';
import { format, isAfter } from 'date-fns';
import { formatDurationShort, formatDuration } from '../../utils';

interface UserMatrixRowCellsProps {
  emp: User;
  empLogs: WorkLog[];
  userLogsLookup?: Record<string, WorkLog[]>;
  days: Date[];
  today: Date;
  filterMonth: string;
  setEditingLog: (data: {userId: string, date: string}) => void;
}

export const UserMatrixRowCells = memo(({ 
  emp, 
  empLogs, 
  userLogsLookup,
  days, 
  today, 
  filterMonth, 
  setEditingLog 
}: UserMatrixRowCellsProps) => {
  const totalMinutes = empLogs.filter(l => l.checkOut || l.entryType !== EntryType.WORK).reduce((s, l) => s + l.durationMinutes, 0);

  return (
    <React.Fragment>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (isAfter(day, today)) {
          const planned = emp.plannedShifts?.[dateStr];
          return (
            <td key={dateStr} className="border-r p-1 h-12 text-center align-middle">
              {planned && (
                <span className={`text-[10px] font-black ${
                  planned === 'Р' ? 'text-blue-400' :
                  planned === 'В' ? 'text-slate-300' :
                  planned === 'Д' ? 'text-amber-400' :
                  planned === 'О' ? 'text-purple-400' :
                  planned === 'Н' ? 'text-indigo-400' : 'text-slate-300'
                }`}>
                  {planned}
                </span>
              )}
            </td>
          );
        }

        const dayLogs = userLogsLookup ? (userLogsLookup[dateStr] || []) : empLogs.filter(l => l.date === dateStr);
        const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
        const workMins = workEntries.reduce((s, l) => s + l.durationMinutes, 0);
        const hasWork = workEntries.length > 0;
        const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
        const anyCorrected = dayLogs.some(l => l.isCorrected);
        const anyNight = dayLogs.some(l => l.isNightShift);
        
        let content: React.ReactNode = null;
        if (absence) {
           content = <span className="font-black text-blue-600">{absence.entryType === EntryType.SICK ? 'Б' : absence.entryType === EntryType.VACATION ? 'О' : 'В'}{anyCorrected && '*'}</span>;
        } else if (hasWork) {
           const isPending = workEntries.some(l => !l.checkOut);
           content = (
             <div className="flex flex-col items-center justify-center">
                <span className={`text-[11px] font-black ${isPending ? 'text-blue-500 italic' : 'text-slate-900'}`}>
                  {workMins > 0 ? formatDurationShort(workMins) : (isPending ? '--:--' : '0:00')}{(isPending || anyCorrected) && '*'}
                </span>
                {anyNight && <svg className="w-2 h-2 text-slate-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
             </div>
           );
        } else {
           content = <span className="text-[10px] font-bold text-slate-300">В</span>;
        }

        return (
          <td key={dateStr} onClick={() => setEditingLog({ userId: emp.id, date: dateStr })} className="border-r p-1 text-center h-12 tabular-nums cursor-pointer hover:bg-blue-50 transition-colors">
            {content}
          </td>
        );
      })}
      <td className="sticky right-0 z-10 px-4 py-3 text-center font-black text-slate-900 text-xs bg-slate-50 border-l border-slate-300">{formatDuration(totalMinutes)}</td>
    </React.Fragment>
  );
});
