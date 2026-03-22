import React from 'react';
import { User } from '../../types';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X } from 'lucide-react';

interface EmployeeScheduleModalProps {
  user: User;
  onClose: () => void;
  days: Date[];
}

export const EmployeeScheduleModal: React.FC<EmployeeScheduleModalProps> = ({ user, onClose, days }) => {
  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">График: {user.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 gap-2">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const shift = user.plannedShifts?.[dateStr];
              return (
                <div key={dateStr} className="flex flex-col items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold">{format(day, 'd')}</span>
                  <span className={`text-sm font-black ${
                    shift === 'Р' ? 'text-blue-500' :
                    shift === 'В' ? 'text-slate-400' :
                    shift === 'Д' ? 'text-amber-500' :
                    shift === 'О' ? 'text-purple-500' :
                    shift === 'Н' ? 'text-indigo-500' : 'text-slate-300'
                  }`}>{shift || '-'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
