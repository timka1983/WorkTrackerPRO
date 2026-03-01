import React, { memo } from 'react';
import { WorkLog, Machine, EntryType } from '../../types';
import { format, isAfter } from 'date-fns';
import { formatDurationShort } from '../../utils';

interface EmployeeMatrixRowProps {
  machine: Machine | null;
  daysInMonth: Date[];
  today: Date;
  filteredLogs: WorkLog[];
  userLogsLookup?: Record<string, WorkLog[]>;
}

export const EmployeeMatrixRow = memo(({ 
  machine, 
  daysInMonth, 
  today, 
  filteredLogs,
  userLogsLookup
}: EmployeeMatrixRowProps) => {
  return (
    <tr className="border-b border-slate-100">
      <td className="sticky left-0 z-10 bg-white border-r px-4 py-3 text-[11px] font-bold text-slate-700">
        {machine ? machine.name : 'Отработано'}
      </td>
      {daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-12"></td>;
        
        const dayLogs = userLogsLookup ? (userLogsLookup[dateStr] || []) : filteredLogs.filter(l => l.date === dateStr);
        const workEntries = dayLogs.filter(l => 
          l.entryType === EntryType.WORK && 
          (!machine || l.machineId === machine.id)
        );
        
        let mins = 0;
        if (machine) {
          mins = workEntries.reduce((sum, l) => sum + l.durationMinutes, 0);
        } else {
          // Если это общая строка (без машины), считаем по правилу:
          // Максимальное время работы на одном станке за день
          const machineTotals: Record<string, number> = {};
          workEntries.forEach(l => {
            const mid = l.machineId || 'unknown';
            machineTotals[mid] = (machineTotals[mid] || 0) + l.durationMinutes;
          });
          mins = Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
        }

        const hasWork = workEntries.length > 0;
        const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
        
        let content = absence ? 
          <span className="font-black text-blue-600">{absence.entryType === EntryType.SICK ? 'Б' : absence.entryType === EntryType.VACATION ? 'О' : 'В'}</span> : 
          (hasWork ? 
            <span className={`text-[11px] font-black ${workEntries.some(l => !l.checkOut) ? 'text-blue-500 italic' : 'text-slate-900'}`}>
              {mins > 0 ? formatDurationShort(mins) : (workEntries.some(l => !l.checkOut) ? '--:--' : '0:00')}
            </span> : 
            <span className="text-[10px] font-bold text-slate-300">В</span>
          );
          
        return <td key={dateStr} className="border-r p-1 text-center h-12 tabular-nums">{content}</td>;
      })}
    </tr>
  );
});
