import React, { memo } from 'react';
import { User, PositionPermissions } from '../../types';
import { STORAGE_KEYS } from '../../constants';

interface EmployeeHeaderProps {
  user: User;
  isAbsentToday: boolean;
  onRefresh?: () => Promise<void>;
  setShowPinChange: (show: boolean) => void;
  viewMode: 'control' | 'matrix';
  setViewMode: (mode: 'control' | 'matrix') => void;
  perms: PositionPermissions;
}

export const EmployeeHeader = memo<EmployeeHeaderProps>(({
  user,
  isAbsentToday,
  onRefresh,
  setShowPinChange,
  viewMode,
  setViewMode,
  perms
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 flex flex-col md:flex-row justify-between items-center gap-4 no-print transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center font-black text-2xl">
          {user.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 dark:text-white">{user.name}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">{user.position}</p>
            {isAbsentToday && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">На выходном сегодня</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Refresh button removed as requested */}
      </div>
    </div>
  );
});
