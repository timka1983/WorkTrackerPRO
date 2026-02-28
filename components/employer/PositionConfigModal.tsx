import React from 'react';
import { PositionConfig, PlanLimits, PayrollConfig, Machine } from '../../types';
import { DEFAULT_PAYROLL_CONFIG } from '../../constants';

interface PositionConfigModalProps {
  configuringPosition: PositionConfig;
  setConfiguringPosition: (pos: PositionConfig | null) => void;
  planLimits: PlanLimits;
  handlePermissionToggle: (key: keyof PositionConfig['permissions']) => void;
  canUsePayroll: boolean;
  handleUpdatePayrollConfig: (key: keyof PayrollConfig, value: any) => void;
  positions: PositionConfig[];
  onUpdatePositions: (positions: PositionConfig[]) => void;
  machines: Machine[];
}

export const PositionConfigModal: React.FC<PositionConfigModalProps> = ({
  configuringPosition,
  setConfiguringPosition,
  planLimits,
  handlePermissionToggle,
  canUsePayroll,
  handleUpdatePayrollConfig,
  positions,
  onUpdatePositions,
  machines
}) => {
  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
               <h3 className="font-black text-slate-900 uppercase tracking-tight">Конструктор функций</h3>
               <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{configuringPosition.name}</p>
            </div>
            <button onClick={() => setConfiguringPosition(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light transition-colors">&times;</button>
         </div>
         <div className="p-8 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {[
              { key: 'isFullAdmin', label: 'Администратор', desc: 'Должность обладает всеми правами Администратора' },
              { key: 'isLimitedAdmin', label: 'Менеджер', desc: 'Доступ только к вкладкам Дашборд и Табель' },
              { key: 'useMachines', label: 'Работа на станках', desc: 'Возможность выбирать оборудование при начале смены' },
              { key: 'multiSlot', label: 'Мульти-слот (3 карточки)', desc: 'Одновременная работа на 3 станках (для токарей)' },
              { key: 'canUseNightShift', label: 'Ночная смена', desc: 'Возможность включать ночной режим работы с бонусом времени', isPro: true },
              { key: 'viewSelfMatrix', label: 'Вкладка «Мой Табель»', desc: 'Доступ сотрудника к своей статистике' },
              { key: 'markAbsences', label: 'Регистрация пропусков', desc: 'Возможность отмечать Б, О, В самостоятельно' },
              { key: 'defaultRequirePhoto', label: 'Обязательное фото', desc: 'Фотофиксация при каждом начале/конце смены', isPro: true },
            ].map((item) => {
              const isBlocked = (item.key === 'canUseNightShift' && !planLimits.features.nightShift) || 
                                (item.key === 'defaultRequirePhoto' && !planLimits.features.photoCapture);
              
              return (
                <label key={item.key} className={`flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white transition-all group ${isBlocked ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                  <div className="flex-1 pr-4">
                     <div className="flex items-center gap-2">
                       <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.label}</p>
                       {isBlocked && <span className="text-[7px] font-black bg-blue-600 text-white px-1 py-0.5 rounded uppercase">PRO</span>}
                     </div>
                     <p className="text-[9px] font-bold text-slate-400 leading-tight mt-0.5">{item.desc}</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={(configuringPosition.permissions as any)[item.key]} 
                      onChange={() => handlePermissionToggle(item.key as any)}
                      disabled={isBlocked}
                    />
                    <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-sm ${isBlocked ? 'bg-slate-300' : ''}`}></div>
                  </div>
                </label>
              );
            })}

            {canUsePayroll && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 mt-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">Финансовые условия (по умолчанию)</h4>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Тип оплаты</label>
                  <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                    {(['hourly', 'fixed', 'shift'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => handleUpdatePayrollConfig('type', type)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(configuringPosition.payroll?.type || DEFAULT_PAYROLL_CONFIG.type) === type ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {type === 'hourly' ? 'Почасовая' : type === 'fixed' ? 'Оклад' : 'За смену'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ставка (₽)</label>
                     <input 
                       type="number" 
                       value={configuringPosition.payroll?.rate ?? DEFAULT_PAYROLL_CONFIG.rate}
                       onChange={e => handleUpdatePayrollConfig('rate', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Коэф. переработок</label>
                     <input 
                       type="number" 
                       step="0.1"
                       value={configuringPosition.payroll?.overtimeMultiplier ?? DEFAULT_PAYROLL_CONFIG.overtimeMultiplier}
                       onChange={e => handleUpdatePayrollConfig('overtimeMultiplier', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (₽)</label>
                     <input 
                       type="number" 
                       value={configuringPosition.payroll?.nightShiftBonus ?? DEFAULT_PAYROLL_CONFIG.nightShiftBonus}
                       onChange={e => handleUpdatePayrollConfig('nightShiftBonus', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ставка больничного (₽/день)</label>
                     <input 
                       type="number" 
                       value={configuringPosition.payroll?.sickLeaveRate ?? 0}
                       onChange={e => handleUpdatePayrollConfig('sickLeaveRate', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                </div>

                {configuringPosition.permissions.useMachines && machines.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ставки по оборудованию (₽/час)</label>
                    <div className="space-y-2">
                      {machines.map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 flex-1 truncate">{m.name}</span>
                          <input 
                            type="number" 
                            placeholder="По умолчанию"
                            value={configuringPosition.payroll?.machineRates?.[m.id] ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              const currentRates = { ...(configuringPosition.payroll?.machineRates || {}) };
                              if (val === '') {
                                delete currentRates[m.id];
                              } else {
                                currentRates[m.id] = Number(val);
                              }
                              handleUpdatePayrollConfig('machineRates', currentRates);
                            }}
                            className="w-24 bg-white border-2 border-slate-200 rounded-xl px-2 py-1 text-xs font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Макс. длительность смены (часов)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min="0"
                  max="24"
                  value={configuringPosition.permissions.maxShiftDurationMinutes ? configuringPosition.permissions.maxShiftDurationMinutes / 60 : ''}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value || '0');
                    const next = {
                      ...configuringPosition,
                      permissions: {
                        ...configuringPosition.permissions,
                        maxShiftDurationMinutes: hours > 0 ? hours * 60 : undefined
                      }
                    };
                    setConfiguringPosition(next);
                    onUpdatePositions(positions.map(p => p.name === next.name ? next : p));
                  }}
                  placeholder="Без ограничений"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-blue-500"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Часов</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">Смена будет автоматически завершена или подсвечена при превышении этого времени.</p>
            </div>
            <button 
              onClick={() => setConfiguringPosition(null)} 
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl hover:bg-slate-800 transition-all active:scale-95 sticky bottom-0"
            >
              Готово
            </button>
         </div>
      </div>
    </div>
  );
};
