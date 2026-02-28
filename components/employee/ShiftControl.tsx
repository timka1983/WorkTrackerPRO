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
  getMachineName: (id?: string) => string;
  isAnyShiftActiveInLogs: boolean;
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
  getMachineName,
  isAnyShiftActiveInLogs
}) => {
  const renderSlot = (slot: number) => {
    const active = activeShifts[slot];
    
    return (
      <div key={slot} className={`bg-slate-50 border-2 p-6 rounded-3xl flex flex-col items-center gap-4 transition-all ${isAbsentToday ? 'opacity-50 grayscale pointer-events-none' : 'hover:bg-white hover:border-blue-100 hover:shadow-xl'} ${active ? 'border-blue-500' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full ${active ? (overtimeAlerts[slot] ? 'bg-rose-500 animate-pulse' : 'bg-blue-500 animate-pulse') : 'bg-slate-300'}`}></span>
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Рабочее место №{slot}</h4>
        </div>
        
        {active ? (
          <div className="text-center space-y-4 w-full">
            <div className={`${overtimeAlerts[slot] ? 'bg-rose-600' : 'bg-blue-600'} p-3 rounded-2xl shadow-lg ${overtimeAlerts[slot] ? 'shadow-rose-100' : 'shadow-blue-100'} relative overflow-hidden transition-colors duration-500`}>
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
              <p className={`text-3xl font-mono font-black tabular-nums transition-colors ${overtimeAlerts[slot] ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatTime(active.checkIn!)}
              </p>
              {overtimeAlerts[slot] && (
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                  Смена длится более {perms.maxShiftDurationMinutes! / 60} ч.
                </p>
              )}
            </div>
            <button onClick={() => processAction(slot, 'stop')} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-red-100 transition-all active:scale-95 uppercase">Завершить</button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {perms.useMachines && (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase px-1">Оборудование</label>
                <select 
                  disabled={isAbsentToday}
                  value={slotMachineIds[slot]} 
                  onChange={e => setSlotMachineIds({ ...slotMachineIds, [slot]: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold bg-white text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:bg-slate-100"
                >
                  <option value="">-- Выберите оборудование --</option>
                  {machines.map(m => {
                    const isBusyByOthers = busyMachineIds.includes(m.id);
                    const isSelectedInOtherSlot = Object.entries(slotMachineIds)
                      .some(([s, id]) => parseInt(s) !== slot && id === m.id);
                    
                    const isDisabled = isBusyByOthers || isSelectedInOtherSlot;
                    
                    return (
                      <option key={m.id} value={m.id} disabled={isDisabled} className={isDisabled ? 'text-slate-300' : ''}>
                        {m.name} {isBusyByOthers ? '(ЗАНЯТ)' : isSelectedInOtherSlot ? '(ВЫБРАН В ДР. СЛОТЕ)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            
            {perms.canUseNightShift && (
              <div className="flex items-center justify-between px-2 py-1">
                 <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isAnyNightShiftActive ? 'text-blue-600' : 'text-slate-400'}`}>
                    <svg className={`w-3 h-3 ${isNightModeGlobal ? 'text-blue-500' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                    Ночная смена
                 </span>
                 <button 
                    disabled={isAnyNightShiftActive}
                    onClick={() => setIsNightModeGlobal(!isNightModeGlobal)}
                    className={`w-10 h-5 rounded-full transition-all relative ${isNightModeGlobal ? 'bg-blue-600' : 'bg-slate-200'} ${isAnyNightShiftActive ? 'opacity-80 cursor-not-allowed' : ''}`}
                    title={isAnyNightShiftActive ? "Нельзя отключить, пока один из станков в ночной смене" : ""}
                 >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isNightModeGlobal ? 'left-5.5' : 'left-0.5'}`}></div>
                 </button>
              </div>
            )}

            <button 
              disabled={isAbsentToday || isAnyShiftActiveInLogs || (perms.useMachines && busyMachineIds.includes(slotMachineIds[slot]))}
              onClick={() => processAction(slot, 'start')} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 transition-all active:scale-95 uppercase disabled:bg-slate-300 disabled:shadow-none"
            >
              Начать {isNightModeGlobal && perms.canUseNightShift ? 'ночную' : ''} смену
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white p-8 rounded-3xl border shadow-sm border-slate-200 no-print">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Контроль рабочего времени</h3>
      <div className={`grid grid-cols-1 ${perms.multiSlot ? 'md:grid-cols-3' : 'max-w-md mx-auto'} gap-8`}>
         {perms.multiSlot ? [1, 2, 3].map(renderSlot) : [1].map(renderSlot)}
      </div>
    </section>
  );
});
