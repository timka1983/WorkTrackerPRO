import React, { useMemo } from 'react';
import { User, WorkLog, EntryType } from '../../types';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { formatDurationShort, applyRounding } from '../../utils';

interface EmployeeScheduleModalProps {
  user: User;
  onClose: () => void;
  days: Date[];
  userLogs?: Record<string, WorkLog[]>;
  roundShiftMinutes?: boolean;
}

export const EmployeeScheduleModal: React.FC<EmployeeScheduleModalProps> = ({ user, onClose, days, userLogs = {}, roundShiftMinutes }) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Детальный отчет</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Табель + График: <span className="text-blue-600">{user.name}</span></h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 gap-3">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isPast = dateStr <= todayStr;
              const plannedShift = user.plannedShifts?.[dateStr];
              const dayLogs = userLogs[dateStr] || [];
              
              const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
              const machineTotals: Record<string, number> = {};
              workEntries.forEach(l => {
                const mid = l.machineId || 'unknown';
                machineTotals[mid] = (machineTotals[mid] || 0) + l.durationMinutes;
              });
              const maxMins = Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
              const workMins = applyRounding(maxMins, roundShiftMinutes);
              
              const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
              const anyNight = dayLogs.some(l => l.isNightShift);
              const hasWork = workEntries.length > 0;

              // Logic for actual shift display
              let displayShift = plannedShift || '-';
              if (isPast && hasWork) {
                displayShift = anyNight ? 'Н' : 'Д';
              }

              const isToday = dateStr === todayStr;

              return (
                <div key={dateStr} className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
                  isToday 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 shadow-lg shadow-blue-500/20 scale-105 z-10' 
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'
                }`}>
                  <span className={`text-xs font-black mb-1 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{format(day, 'd')}</span>
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-sm font-black ${
                      displayShift === 'Р' || displayShift === 'Д' ? 'text-blue-500' :
                      displayShift === 'В' ? 'text-slate-400' :
                      displayShift === 'О' ? 'text-purple-500' :
                      displayShift === 'Н' ? 'text-indigo-500' : 'text-slate-300'
                    }`}>{displayShift}</span>
                    
                    <div className="h-[1px] w-4 bg-slate-200 dark:bg-slate-700" />
                    
                    <span className={`text-[10px] font-bold ${
                      absence ? 'text-blue-600' : 
                      workMins > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'
                    }`}>
                      {absence ? (absence.entryType === EntryType.SICK ? 'Б' : absence.entryType === EntryType.VACATION ? 'О' : 'В') : 
                       workMins > 0 ? formatDurationShort(workMins) : '0:00'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Верх: График</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Низ: Табель</span>
          </div>
        </div>
      </div>
    </div>
  );
};
