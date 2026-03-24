import React, { memo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { User, EntryType, WorkLog } from '../../types';
import { formatDurationShort, applyRounding } from '../../utils';

interface EmployeePrintViewProps {
  calendarData: any;
  user: User;
  filteredLogs: WorkLog[];
  roundShiftMinutes?: boolean;
}

export const EmployeePrintView = memo<EmployeePrintViewProps>(({
  calendarData,
  user,
  filteredLogs,
  roundShiftMinutes
}) => {
  return (
    <div id="employee-calendar-print" className="hidden print:block bg-white text-black p-4" style={{ width: '280mm', height: '190mm', fontFamily: 'serif' }}>
      <div className="flex justify-between items-start mb-6">
        <div className="w-32 opacity-80">
          <div className="text-[8px] font-bold mb-1">{calendarData.prevMonth.name} {calendarData.prevMonth.year}</div>
          <div className="grid grid-cols-7 gap-0.5 text-[6px]">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="font-bold">{d}</div>)}
            {Array.from({ length: calendarData.prevMonth.startOffset }).map((_, i) => <div key={i}></div>)}
            {calendarData.prevMonth.days.map((d: any) => <div key={d.toString()}>{format(d, 'd')}</div>)}
          </div>
        </div>
        <div className="text-center flex-1">
          <h1 className="text-6xl font-black tracking-tight leading-none mb-1" style={{ fontFamily: 'serif' }}>{calendarData.monthName} {calendarData.year}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Рабочий табель сотрудника: {user.name}</p>
        </div>
        <div className="w-32 opacity-80 text-right">
          <div className="text-[8px] font-bold mb-1">{calendarData.nextMonth.name} {calendarData.nextMonth.year}</div>
          <div className="grid grid-cols-7 gap-0.5 text-[6px] text-left">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="font-bold">{d}</div>)}
            {Array.from({ length: calendarData.nextMonth.startOffset }).map((_, i) => <div key={i}></div>)}
            {calendarData.nextMonth.days.map((d: any) => <div key={d.toString()}>{format(d, 'd')}</div>)}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse border-2 border-black">
        <thead>
          <tr>
            {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map(d => (
              <th key={d} className="border border-black p-1 text-[7px] font-bold uppercase tracking-widest bg-slate-50">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, rowIdx) => {
            const weekDays = Array.from({ length: 7 }).map((_, colIdx) => {
              const dayIdx = rowIdx * 7 + colIdx - calendarData.startOffset;
              const date = calendarData.days[dayIdx];
              if (!date) return <td key={colIdx} className="border border-black bg-slate-50/20"></td>;

              const dateStr = format(date, 'yyyy-MM-dd');
              const dayLogs = filteredLogs.filter(l => l.date === dateStr);
              const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
              
              const machineTotals: Record<string, number> = {};
              workEntries.forEach(l => {
                const mid = l.machineId || 'unknown';
                machineTotals[mid] = (machineTotals[mid] || 0) + l.durationMinutes;
              });
              const maxMins = Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
              const workMins = applyRounding(maxMins, roundShiftMinutes);
              
              const hasWork = workEntries.length > 0;
              const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);

              return (
                <td key={colIdx} className="border border-black h-28 p-1 relative vertical-align-top">
                  <span className="text-lg font-black absolute top-0.5 left-1">{format(date, 'd')}</span>
                  <div className="h-full flex flex-col justify-end items-center text-center pb-0.5">
                     {absence ? (
                       <div className="bg-slate-900 text-white px-1 py-0.5 rounded-sm text-[6px] font-black uppercase">
                         {absence.entryType === EntryType.SICK ? 'БОЛЬНИЧНЫЙ' : absence.entryType === EntryType.VACATION ? 'ОТПУСК' : 'ВЫХОДНОЙ'}
                       </div>
                     ) : hasWork ? (
                       <div className="flex flex-col items-center">
                          <span className={`text-sm font-black tabular-nums ${workEntries.some(l => !l.checkOut) ? 'text-blue-600 italic' : ''}`}>
                            {workMins > 0 ? formatDurationShort(workMins) : (workEntries.some(l => !l.checkOut) ? '--:--' : '0:00')}
                          </span>
                          <span className="text-[6px] font-bold text-slate-500 uppercase tracking-tighter">ОТРАБОТАНО</span>
                       </div>
                     ) : (
                       <span className="text-[8px] text-slate-200 font-bold italic">--:--</span>
                     )}
                  </div>
                </td>
              );
            });
            if (rowIdx === 5 && !calendarData.days[rowIdx * 7 - calendarData.startOffset]) return null;
            return <tr key={rowIdx}>{weekDays}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
});
