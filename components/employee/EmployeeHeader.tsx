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
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 no-print">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl">
          {user.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-blue-600 font-semibold uppercase tracking-wider">{user.position}</p>
            {isAbsentToday && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">На выходном сегодня</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {onRefresh && (
          <button onClick={onRefresh} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Обновить данные">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        )}
        <button onClick={() => setShowPinChange(true)} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Сменить PIN">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
        </button>
        
        {(user.id === 'admin' || user.isAdmin) && (
          <button 
            onClick={() => {
              localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
              localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
              window.location.reload();
            }} 
            className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors" 
            title="Выйти в меню выбора"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        )}

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setViewMode('control')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'control' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>Управление</button>
          {perms.viewSelfMatrix && (
            <button onClick={() => setViewMode('matrix')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>Мой Табель</button>
          )}
        </div>
      </div>
    </div>
  );
});
