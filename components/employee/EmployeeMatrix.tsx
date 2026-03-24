import React, { memo, useState, useMemo } from 'react';
import { format, isAfter, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { WorkLog, User, EntryType, Machine, PositionPermissions } from '../../types';
import { ScheduleModal } from './ScheduleModal';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDurationShort, applyRounding } from '../../utils';

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
  roundShiftMinutes?: boolean;
  isPaid?: boolean;
}

const SHIFT_COLORS = {
  'Р': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'В': 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 dark:text-slate-300',
  'Д': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  'О': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  'Н': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
};

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
  downloadCalendarPDF,
  roundShiftMinutes,
  isPaid
}) => {
  const userLogsLookup = logsLookup[user.id] || {};
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const monthStart = startOfMonth(new Date(filterMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);
  
  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  const computedShiftCounts = useMemo(() => {
    const counts = { 'Р': 0, 'В': 0, 'Д': 0, 'О': 0, 'Н': 0 };
    
    calendarDays.forEach(day => {
      if (!isSameMonth(day, monthStart)) return;
      
      const dateStr = format(day, 'yyyy-MM-dd');
      const shift = user.plannedShifts?.[dateStr] as keyof typeof SHIFT_COLORS | undefined;
      const isPast = day < startOfDay(today);
      const isToday = isSameDay(day, today);
      
      const dayLogs = userLogsLookup[dateStr] || filteredLogs.filter(l => l.date === dateStr);
      const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
      const hasWork = workEntries.length > 0;
      const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
      
      if (isPast || isToday) {
        if (absence) {
          if (absence.entryType === EntryType.VACATION) counts['О']++;
          else counts['В']++; // Both SICK and DAY_OFF map to 'В'
        } else if (hasWork) {
          if (shift && counts[shift as keyof typeof counts] !== undefined) {
            counts[shift as keyof typeof counts]++;
          } else {
            counts['Р']++;
          }
        } else if (isPast) {
          counts['В']++;
        } else if (isToday) {
          if (shift && counts[shift as keyof typeof counts] !== undefined) {
            counts[shift as keyof typeof counts]++;
          } else {
            counts['В']++;
          }
        }
      } else {
        if (shift && counts[shift as keyof typeof counts] !== undefined) {
          counts[shift as keyof typeof counts]++;
        } else {
          counts['В']++;
        }
      }
    });
    
    return counts;
  }, [calendarDays, monthStart, today, user.plannedShifts, userLogsLookup, filteredLogs]);

  const handlePrevMonth = () => {
    const prev = subMonths(monthStart, 1);
    const val = format(prev, 'yyyy-MM');
    setFilterMonth(val);
    if (onMonthChange) onMonthChange(val);
  };

  const handleNextMonth = () => {
    const next = addMonths(monthStart, 1);
    const val = format(next, 'yyyy-MM');
    setFilterMonth(val);
    if (onMonthChange) onMonthChange(val);
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm shadow-blue-500/5 dark:shadow-blue-900/10 border border-slate-200 dark:border-slate-800 ring-1 ring-white/50 dark:ring-slate-700/20 overflow-hidden print-monochrome relative transition-colors">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 no-print gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 dark:text-white">Мой Табель</h3>
          <div className="flex flex-wrap gap-2">
             <button onClick={() => setIsScheduleModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-bold" title="Составить график">
               <CalendarDays className="w-5 h-5" />
               Составить график
             </button>
             <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm font-bold" title="Печать табеля">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
               <span className="hidden md:inline">Печать табеля</span>
             </button>
             <button onClick={downloadCalendarPDF} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Скачать календарь">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </button>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-full md:w-auto justify-between md:justify-start">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <input type="month" value={filterMonth} onChange={(e) => {
            setFilterMonth(e.target.value);
            if (onMonthChange) onMonthChange(e.target.value);
          }} className="border-none bg-transparent p-1 text-sm font-bold text-center focus:ring-0 cursor-pointer flex-1 md:w-32 text-slate-900 dark:text-slate-50 dark:text-white" />
          <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 bg-slate-50/30 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 no-print">
        <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[9px]">Р</span> Рабочий - {computedShiftCounts['Р']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 dark:text-slate-300 flex items-center justify-center text-[9px]">В</span> Выходной - {computedShiftCounts['В']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[9px]">Д</span> День - {computedShiftCounts['Д']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-[9px]">О</span> Отпуск - {computedShiftCounts['О']}</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-[9px]">Н</span> Ночь - {computedShiftCounts['Н']}</span>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-2">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">{day}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2 sm:gap-4">
          {calendarDays.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const shift = user.plannedShifts?.[dateStr] as keyof typeof SHIFT_COLORS | undefined;
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isPast = day < startOfDay(today);
            const isToday = isSameDay(day, today);
            const isFutureOrToday = !isPast;
            
            const dayLogs = userLogsLookup[dateStr] || filteredLogs.filter(l => l.date === dateStr);
            const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
            
            let mins = 0;
            const machineTotals: Record<string, number> = {};
            workEntries.forEach(l => {
              const mid = l.machineId || 'unknown';
              machineTotals[mid] = (machineTotals[mid] || 0) + l.durationMinutes;
            });
            const maxMins = Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
            mins = applyRounding(maxMins, roundShiftMinutes);

            const hasWork = workEntries.length > 0;
            const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
            
            let actualContent = null;
            if (isPast || isToday) {
              if (absence) {
                actualContent = <span className="font-black text-blue-600 dark:text-blue-400 text-[10px] sm:text-[11px] leading-tight">{absence.entryType === EntryType.SICK ? 'Болезнь' : absence.entryType === EntryType.VACATION ? 'Отпуск' : 'Выходной'}</span>;
              } else if (hasWork) {
                actualContent = (
                  <span className={`font-black text-[11px] sm:text-xs leading-tight ${workEntries.some(l => !l.checkOut) ? 'text-blue-500 italic' : 'text-slate-900 dark:text-slate-50 dark:text-white'}`}>
                    {mins > 0 ? formatDurationShort(mins) : (workEntries.some(l => !l.checkOut) ? '--:--' : '0:00')}
                  </span>
                );
              } else if (isPast) {
                actualContent = <span className="font-bold text-slate-300 dark:text-slate-600 dark:text-slate-300 text-[10px] sm:text-[11px] leading-tight">В</span>;
              }
            }

            const handleClick = () => {
              if (isPaid) {
                alert('Финансовый период закрыт. Изменение графика заблокировано.');
                return;
              }
              const cycle = ['', 'Р', 'В', 'Д', 'О', 'Н'];
              const currentVal = shift || '';
              const nextIdx = (cycle.indexOf(currentVal) + 1) % cycle.length;
              const nextVal = cycle[nextIdx];
              const newPlannedShifts = { ...(user.plannedShifts || {}) };
              if (nextVal === '') delete newPlannedShifts[dateStr];
              else newPlannedShifts[dateStr] = nextVal;
              onUpdateUser({ ...user, plannedShifts: newPlannedShifts });
            };

            return (
              <div
                key={i}
                onClick={handleClick}
                className={`
                  aspect-square sm:aspect-auto sm:min-h-[90px] rounded-2xl flex flex-col p-1 sm:p-2 relative border cursor-pointer transition-colors
                  ${!isCurrentMonth ? 'opacity-40 bg-slate-50/50 dark:bg-slate-800/50 border-transparent' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}
                  ${shift ? SHIFT_COLORS[shift].split(' ')[0] + '/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                `}
              >
                <div className="flex flex-col items-center mb-auto">
                  <span className={`text-sm font-bold ${shift ? '' : 'text-slate-600 dark:text-slate-400'} ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {shift && isFutureOrToday && (
                    <span className={`${shift === 'В' ? 'text-[10px] sm:text-[11px]' : 'text-sm'} font-bold mt-0.5 ${SHIFT_COLORS[shift].split(' ')[1]}`}>
                      {shift}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col items-center justify-center mt-auto min-h-[20px]">
                  {actualContent}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        user={user}
        onUpdateUser={onUpdateUser}
        currentMonth={filterMonth}
        setFilterMonth={setFilterMonth}
        onMonthChange={onMonthChange}
        readOnly={isPaid}
      />
    </section>
  );
});
