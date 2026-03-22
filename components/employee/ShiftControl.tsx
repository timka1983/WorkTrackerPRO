import React, { memo } from 'react';
import { WorkLog, Machine, PositionPermissions } from '../../types';
import { formatTime } from '../../utils';

interface ShiftControlProps {
  perms: PositionPermissions;
  activeShifts: Record<number, WorkLog | null>;
  overtimeAlerts: Record<number, boolean>;
  isAbsentToday: boolean;
  isAnyNightShiftActive: boolean;
  isNightModeGlobal: boolean;
  setIsNightModeGlobal: (val: boolean) => void;
  slotMachineIds: Record<number, string>;
  setSlotMachineIds: (val: Record<number, string>) => void;
  machines: Machine[];
  busyMachineIds: string[];
  processAction: (slot: number, type: 'start' | 'stop') => void;
  isProcessingAction?: boolean;
  getMachineName: (id?: string) => string;
  isAnyShiftActiveInLogs: boolean;
  isPaid?: boolean;
}

export const ShiftControl = memo<ShiftControlProps>(({
  perms,
  activeShifts,
  overtimeAlerts,
  isAbsentToday,
  isAnyNightShiftActive,
  isNightModeGlobal,
  setIsNightModeGlobal,
  slotMachineIds,
  setSlotMachineIds,
  machines,
  busyMachineIds,
  processAction,
  isProcessingAction,
  getMachineName,
  isAnyShiftActiveInLogs,
  isPaid
}) => {
  const renderSlot = (slot: number) => {
    const active = activeShifts[slot];
    
    return (
      <div key={slot} className={`bg-slate-50 dark:bg-slate-800/30 border-2 p-6 rounded-3xl flex flex-col items-center gap-4 transition-all ${isAbsentToday ? 'opacity-50 grayscale pointer-events-none' : 'hover:bg-white dark:hover:bg-slate-800 hover:border-blue-100 dark:hover:border-blue-900/30 hover:shadow-2xl dark:hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]'} ${active ? 'border-blue-500 dark:border-blue-400' : 'border-slate-100 dark:border-slate-700'}`}>
        <div className="flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full ${active ? (overtimeAlerts[slot] ? 'bg-rose-500 animate-pulse' : 'bg-blue-500 animate-pulse') : 'bg-slate-300 dark:bg-slate-600'}`}></span>
           <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Рабочее место №{slot}</h4>
        </div>
        
        {active ? (
          <div className="text-center space-y-4 w-full">
            <div className={`${overtimeAlerts[slot] ? 'bg-rose-600' : 'bg-blue-600'} p-3 rounded-2xl shadow-xl dark:shadow-slate-900/20 ${overtimeAlerts[slot] ? 'shadow-rose-100 dark:shadow-rose-900/20' : 'shadow-blue-100 dark:shadow-blue-900/20'} relative overflow-hidden transition-colors duration-500`}>
              {active.isNightShift && (
                <div className="absolute top-1 right-1">
                   <svg className="w-3 h-3 text-white opacity-40" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                </div>
              )}
              <p className="text-xs font-bold text-blue-100 uppercase mb-1">
                {overtimeAlerts[slot] ? 'ПРЕВЫШЕН ЛИМИТ!' : `В процессе ${active.isNightShift ? '(Ночь)' : ''}`}
              </p>
              <p className="text-sm font-black text-white truncate px-2">{getMachineName(active.machineId)}</p>
            </div>
            <div className="space-y-1">
              <p className={`text-3xl font-mono font-black tabular-nums transition-colors ${overtimeAlerts[slot] ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-50 dark:text-white'}`}>
                {formatTime(active.checkIn!)}
              </p>
              {overtimeAlerts[slot] && (
                <p className="text-[9px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest animate-pulse">
                  Смена длится более {perms.maxShiftDurationMinutes! / 60} ч.
                </p>
              )}
            </div>
              <button 
                disabled={isProcessingAction}
                onClick={() => {
                  if (isPaid) {
                    alert('Финансовый период закрыт. Изменение данных заблокировано.');
                    return;
                  }
                  processAction(slot, 'stop');
                }} 
                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm shadow-xl dark:shadow-slate-900/20 shadow-red-100 dark:shadow-red-900/20 transition-all active:scale-95 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingAction ? 'Обработка...' : 'Завершить'}
              </button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {perms.useMachines && (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase px-1">Оборудование</label>
                <select 
                  disabled={isAbsentToday}
                  value={slotMachineIds[slot]} 
                  onChange={e => setSlotMachineIds({ ...slotMachineIds, [slot]: e.target.value })}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900"
                >
                  <option value="">-- Выберите оборудование --</option>
                  {machines.map(m => {
                    const isBusyByOthers = busyMachineIds.includes(m.id);
                    const isSelectedInOtherSlot = Object.entries(slotMachineIds)
                      .some(([s, id]) => parseInt(s) !== slot && id === m.id);
                    
                    const isDisabled = isBusyByOthers || isSelectedInOtherSlot;
                    
                    return (
                      <option key={m.id} value={m.id} disabled={isDisabled} className={isDisabled ? 'text-slate-300 dark:text-slate-600 dark:text-slate-300' : ''}>
                        {m.name} {isBusyByOthers ? '(ЗАНЯТ)' : isSelectedInOtherSlot ? '(ВЫБРАН В ДР. СЛОТЕ)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            
            {perms.canUseNightShift && (
              <div className="flex items-center justify-between px-2 py-1">
                 <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isAnyNightShiftActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>
                    <svg className={`w-3 h-3 ${isNightModeGlobal ? 'text-blue-500 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 dark:text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                    Ночная смена
                 </span>
                 <button 
                    disabled={isAnyNightShiftActive}
                    onClick={() => setIsNightModeGlobal(!isNightModeGlobal)}
                    className={`w-10 h-5 rounded-full transition-all relative ${isNightModeGlobal ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'} ${isAnyNightShiftActive ? 'opacity-80 cursor-not-allowed' : ''}`}
                    title={isAnyNightShiftActive ? "Нельзя отключить, пока один из станков в ночной смене" : ""}
                 >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white dark:bg-slate-200 rounded-full shadow-md dark:shadow-slate-900/20 transition-all ${isNightModeGlobal ? 'left-5.5' : 'left-0.5'}`}></div>
                 </button>
              </div>
            )}

            <button 
              disabled={isAbsentToday || isAnyShiftActiveInLogs || (perms.useMachines && busyMachineIds.includes(slotMachineIds[slot])) || isPaid || isProcessingAction}
              onClick={() => {
                if (isPaid) {
                  alert('Финансовый период закрыт. Изменение данных заблокировано.');
                  return;
                }
                processAction(slot, 'start');
              }} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-xl dark:shadow-slate-900/20 shadow-blue-100 dark:shadow-blue-900/20 transition-all active:scale-95 uppercase disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isProcessingAction ? 'Загрузка...' : `Начать ${isNightModeGlobal && perms.canUseNightShift ? 'ночную' : ''} смену`}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border shadow-md dark:shadow-slate-900/20 border-slate-200 dark:border-slate-800 no-print transition-colors">
      <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Контроль рабочего времени</h3>
      <div className={`grid grid-cols-1 ${perms.multiSlot > 0 ? 'md:grid-cols-' + perms.multiSlot : 'max-w-md mx-auto'} gap-8`}>
         {perms.multiSlot > 0 ? Array.from({ length: perms.multiSlot }, (_, i) => i + 1).map(renderSlot) : [1].map(renderSlot)}
      </div>
    </section>
  );
});
