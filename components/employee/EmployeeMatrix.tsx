import React, { memo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { WorkLog, User, EntryType, Machine, PositionPermissions } from '../../types';
import { EmployeeMatrixRow } from './EmployeeMatrixRow';

interface EmployeeMatrixProps {
  filterMonth: string;
  setFilterMonth: (month: string) => void;
  onMonthChange?: (month: string) => void;
  daysInMonth: Date[];
  user: User;
  onUpdateUser: (user: User) => void;
  today: Date;
  shiftCounts: Record<string, number>;
  perms: PositionPermissions;
  usedMachines: Machine[];
  filteredLogs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
  downloadCalendarPDF: () => void;
}

export const EmployeeMatrix = memo<EmployeeMatrixProps>(({
  filterMonth,
  setFilterMonth,
  onMonthChange,
  daysInMonth,
  user,
  onUpdateUser,
  today,
  shiftCounts,
  perms,
  usedMachines,
  filteredLogs,
  logsLookup = {},
  downloadCalendarPDF
}) => {
  const userLogsLookup = logsLookup[user.id] || {};

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print-monochrome">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 no-print">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-slate-900">Мой Табель</h3>
          <div className="flex gap-2">
             <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-white transition-colors">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
               Обычная печать
             </button>
             <button onClick={downloadCalendarPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               Скачать календарь
             </button>
          </div>
        </div>
        <input type="month" value={filterMonth} onChange={(e) => {
          setFilterMonth(e.target.value);
          if (onMonthChange) onMonthChange(e.target.value);
        }} className="border border-slate-200 rounded-xl p-2 text-sm font-bold" />
      </div>

      <div className="p-4 bg-slate-50/30 border-b border-slate-100 no-print">
        <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[9px]">Р</span> Рабочий - {shiftCounts['Р']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-slate-100 text-slate-400 flex items-center justify-center text-[9px]">В</span> Выходной - {shiftCounts['В']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-[9px]">Д</span> День - {shiftCounts['Д']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-[9px]">О</span> Отпуск - {shiftCounts['О']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px]">Н</span> Ночь - {shiftCounts['Н']}</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-20 bg-slate-50 px-4 py-4 text-left text-[10px] font-bold text-slate-600 uppercase border-r min-w-[160px]">День</th>
              {daysInMonth.map(day => (
                <th key={day.toString()} className={`px-1 py-2 text-center text-[9px] font-bold border-r min-w-[40px] ${[0, 6].includes(day.getDay()) ? 'text-red-500 bg-red-50/20' : 'text-slate-500'}`}>
                  <div className="flex flex-col items-center">
                    <span>{format(day, 'd')}</span>
                    <span className="text-[7px] uppercase opacity-60 font-medium">{format(day, 'eeeeee', { locale: ru })}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <td className="sticky left-0 z-10 bg-slate-50 border-r px-4 py-3 text-[11px] font-black text-blue-600">График</td>
              {daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const planned = user.plannedShifts?.[dateStr];
                const isFuture = day >= today;
                
                const handleClick = () => {
                  if (!isFuture) return;
                  const cycle = ['', 'Р', 'В', 'Д', 'О', 'Н'];
                  const currentVal = planned || '';
                  const nextIdx = (cycle.indexOf(currentVal) + 1) % cycle.length;
                  const nextVal = cycle[nextIdx];
                  const newPlannedShifts = { ...(user.plannedShifts || {}) };
                  if (nextVal === '') delete newPlannedShifts[dateStr];
                  else newPlannedShifts[dateStr] = nextVal;
                  onUpdateUser({ ...user, plannedShifts: newPlannedShifts });
                };

                return (
                  <td key={dateStr} onClick={handleClick} className={`border-r p-1 text-center h-12 tabular-nums transition-colors ${isFuture ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
                    {planned && (
                      <span className={`text-[10px] font-black ${
                        planned === 'Р' ? 'text-blue-600' :
                        planned === 'В' ? 'text-slate-400' :
                        planned === 'Д' ? 'text-amber-600' :
                        planned === 'О' ? 'text-purple-600' :
                        planned === 'Н' ? 'text-indigo-600' : 'text-slate-400'
                      }`}>
                        {planned}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            {perms.useMachines ? (
              usedMachines.map(m => (
                <EmployeeMatrixRow
                  key={m.id}
                  machine={m}
                  daysInMonth={daysInMonth}
                  today={today}
                  filteredLogs={filteredLogs}
                  userLogsLookup={userLogsLookup}
                />
              ))
            ) : (
              <EmployeeMatrixRow
                machine={null}
                daysInMonth={daysInMonth}
                today={today}
                filteredLogs={filteredLogs}
                userLogsLookup={userLogsLookup}
              />
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
});
