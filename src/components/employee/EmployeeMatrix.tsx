import React, { memo } from 'react';
import { format, isAfter } from 'date-fns';
import { WorkLog, Machine, EntryType, PositionPermissions } from '../../../types';
import { formatDurationShort } from '../../../utils';

interface MemoizedEmployeeMatrixRowProps {
  machine: Machine | null;
  daysInMonth: Date[];
  today: Date;
  filteredLogs: WorkLog[];
}

const MemoizedEmployeeMatrixRow = memo(({ 
  machine, 
  daysInMonth, 
  today, 
  filteredLogs 
}: MemoizedEmployeeMatrixRowProps) => {
  return (
    <tr className="border-b border-slate-100">
      <td className="sticky left-0 z-10 bg-white border-r px-4 py-3 text-[11px] font-bold text-slate-700">
        {machine ? machine.name : 'Отработано'}
      </td>
      {daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-12"></td>;
        
        const workEntries = filteredLogs.filter(l => 
          l.date === dateStr && 
          l.entryType === EntryType.WORK && 
          (!machine || l.machineId === machine.id)
        );
        
        const mins = workEntries.reduce((sum, l) => sum + l.durationMinutes, 0);
        const hasWork = workEntries.length > 0;
        const absence = filteredLogs.find(l => l.date === dateStr && l.entryType !== EntryType.WORK);
        
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

interface EmployeeMatrixProps {
  daysInMonth: Date[];
  today: Date;
  filteredLogs: WorkLog[];
  usedMachines: Machine[];
  downloadCalendarPDF: () => void;
  perms: PositionPermissions;
}

const EmployeeMatrix: React.FC<EmployeeMatrixProps> = ({ 
  daysInMonth, 
  today, 
  filteredLogs, 
  usedMachines, 
  downloadCalendarPDF,
  perms
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Детальный отчет по дням</h3>
        <button onClick={downloadCalendarPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase transition-all">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Скачать PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase border-r min-w-[120px]">Ресурс</th>
              {daysInMonth.map(day => (
                <th key={day.toString()} className="px-1 py-2 text-center text-[9px] font-bold text-slate-500 border-r min-w-[32px]">
                  {format(day, 'd')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <MemoizedEmployeeMatrixRow 
              machine={null}
              daysInMonth={daysInMonth}
              today={today}
              filteredLogs={filteredLogs}
            />
            {usedMachines.map(m => (
              <MemoizedEmployeeMatrixRow 
                key={m.id}
                machine={m}
                daysInMonth={daysInMonth}
                today={today}
                filteredLogs={filteredLogs}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(EmployeeMatrix);
