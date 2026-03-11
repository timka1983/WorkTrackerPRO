import React, { useMemo } from 'react';
import { User, PositionConfig, PlanLimits, PayrollConfig, Machine, Branch, WorkLog, EntryType } from '../../types';
import { DEFAULT_PAYROLL_CONFIG } from '../../constants';
import { Trash2 } from 'lucide-react';

interface EmployeeEditModalProps {
  editingEmployee: User;
  setEditingEmployee: (user: User | null) => void;
  saveEmployeeEdit: (e: React.FormEvent) => void;
  positions: PositionConfig[];
  planLimits: PlanLimits;
  canUsePayroll: boolean;
  handleUpdateEmployeePayroll: (key: keyof PayrollConfig, value: any) => void;
  handleResetDevicePairing: () => void;
  machines: Machine[];
  branches: Branch[];
  telegramSettings?: { botToken: string; enabled: boolean };
}

export const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  editingEmployee,
  setEditingEmployee,
  saveEmployeeEdit,
  positions,
  planLimits,
  canUsePayroll,
  handleUpdateEmployeePayroll,
  handleResetDevicePairing,
  machines,
  branches,
  telegramSettings
}) => {
  const renderOverrideLabel = (key: keyof NonNullable<PayrollConfig['overrides']>, label: string) => {
    const isOverridden = editingEmployee.payroll?.overrides?.[key] || false;
    return (
      <div className="flex items-center justify-between ml-1 mb-1">
        <label className="text-[9px] font-black text-slate-400 uppercase">{label}</label>
        <input 
          type="checkbox" 
          checked={isOverridden}
          onChange={e => {
            const overrides = { ...(editingEmployee.payroll?.overrides || {}) };
            overrides[key] = e.target.checked;
            handleUpdateEmployeePayroll('overrides', overrides);
          }}
          className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          title="Приоритет над базовыми настройками должности"
        />
      </div>
    );
  };

  const isMachineRatesOverridden = editingEmployee.payroll?.overrides?.machineRates || false;
  const activeMachineRates = isMachineRatesOverridden 
    ? (editingEmployee.payroll?.machineRates || {}) 
    : (positions.find(p => p.name === editingEmployee.position)?.payroll?.machineRates || {});

  const configuredMachineIds = Object.keys(activeMachineRates);
  const availableMachines = machines.filter(m => !configuredMachineIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Редактировать сотрудника</h3>
            <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-900 text-2xl font-light">&times;</button>
         </div>
         <div className="overflow-y-auto custom-scrollbar">
           <form onSubmit={saveEmployeeEdit} className="p-8 space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ФИО</label>
                 <input 
                   required 
                   type="text" 
                   value={editingEmployee.name} 
                   onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} 
                   className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" 
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Должность</label>
                 <select 
                   value={editingEmployee.position} 
                   onChange={e => setEditingEmployee({...editingEmployee, position: e.target.value})} 
                   className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white"
                 >
                   {positions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                 </select>
              </div>
              
              {branches.length > 0 && (
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Филиал</label>
                   <select 
                     value={editingEmployee.branchId || ''} 
                     onChange={e => setEditingEmployee({...editingEmployee, branchId: e.target.value})} 
                     className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white"
                   >
                     <option value="">Без филиала (Все)</option>
                     {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                   </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">PIN-код</label>
                    <input 
                      type="text" 
                      maxLength={4} 
                      value={editingEmployee.pin} 
                      onChange={e => setEditingEmployee({...editingEmployee, pin: e.target.value.replace(/[^0-9]/g, '')})} 
                      className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono font-black text-blue-600" 
                    />
                 </div>
                 <div className="flex flex-col justify-end">
                    <div className={`flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 h-[52px] ${!planLimits.features.photoCapture ? 'opacity-50' : ''}`}>
                       <input 
                         disabled={!planLimits.features.photoCapture}
                         type="checkbox" 
                         checked={editingEmployee.requirePhoto} 
                         onChange={e => setEditingEmployee({...editingEmployee, requirePhoto: e.target.checked})} 
                         className="w-5 h-5 rounded accent-blue-600" 
                         id="edit-req-photo" 
                       />
                       <label htmlFor="edit-req-photo" className="text-[9px] font-black text-slate-600 uppercase cursor-pointer">
                          Фото {!planLimits.features.photoCapture && 'PRO'}
                       </label>
                    </div>
                 </div>
              </div>

              {canUsePayroll && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Финансы (Персонально)</p>
                   
                    <div className="space-y-1">
                      {renderOverrideLabel('type', 'Тип оплаты')}
                      <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                        {(['hourly', 'fixed', 'shift', 'piecework'] as const).map(type => (
                          <button
                            key={type}
                            type="button"
                            disabled={!editingEmployee.payroll?.overrides?.type}
                            onClick={() => handleUpdateEmployeePayroll('type', type)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(editingEmployee.payroll?.type || positions.find(p => p.name === editingEmployee.position)?.payroll?.type || DEFAULT_PAYROLL_CONFIG.type) === type ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'} ${!editingEmployee.payroll?.overrides?.type ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {type === 'hourly' ? 'Почасовая' : type === 'fixed' ? 'Оклад' : type === 'shift' ? 'За смену' : 'Сдельная'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         {renderOverrideLabel('rate', 'Ставка (₽)')}
                         <input 
                           type="number" 
                           disabled={!editingEmployee.payroll?.overrides?.rate}
                           value={editingEmployee.payroll?.rate ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.rate || DEFAULT_PAYROLL_CONFIG.rate)}
                           onChange={e => handleUpdateEmployeePayroll('rate', Number(e.target.value))}
                           className={`w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 ${!editingEmployee.payroll?.overrides?.rate ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                         />
                      </div>
                      <div className="space-y-1">
                         {renderOverrideLabel('overtimeMultiplier', 'Коэф. переработок')}
                         <input 
                           type="number" 
                           step="0.1"
                           disabled={!editingEmployee.payroll?.overrides?.overtimeMultiplier}
                           value={editingEmployee.payroll?.overtimeMultiplier ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.overtimeMultiplier || DEFAULT_PAYROLL_CONFIG.overtimeMultiplier)}
                           onChange={e => handleUpdateEmployeePayroll('overtimeMultiplier', Number(e.target.value))}
                           className={`w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 ${!editingEmployee.payroll?.overrides?.overtimeMultiplier ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                         />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         {renderOverrideLabel('nightShiftBonus', 'Бонус за ночную смену (₽)')}
                         <input 
                           type="number" 
                           disabled={!editingEmployee.payroll?.overrides?.nightShiftBonus}
                           value={editingEmployee.payroll?.nightShiftBonus ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.nightShiftBonus || DEFAULT_PAYROLL_CONFIG.nightShiftBonus)}
                           onChange={e => handleUpdateEmployeePayroll('nightShiftBonus', Number(e.target.value))}
                           className={`w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 ${!editingEmployee.payroll?.overrides?.nightShiftBonus ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                         />
                      </div>
                      <div className="space-y-1">
                         {renderOverrideLabel('sickLeaveRate', 'Ставка больничного (₽/день)')}
                         <input 
                           type="number" 
                           disabled={!editingEmployee.payroll?.overrides?.sickLeaveRate}
                           value={editingEmployee.payroll?.sickLeaveRate ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.sickLeaveRate || 0)}
                           onChange={e => handleUpdateEmployeePayroll('sickLeaveRate', Number(e.target.value))}
                           className={`w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 ${!editingEmployee.payroll?.overrides?.sickLeaveRate ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                         />
                      </div>
                    </div>

                  {positions.find(p => p.name === editingEmployee.position)?.permissions.useMachines && machines.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {renderOverrideLabel('machineRates', 'Ставки по оборудованию (₽/час)')}
                        </div>
                        {availableMachines.length > 0 && editingEmployee.payroll?.overrides?.machineRates && (
                          <select 
                            className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500 font-bold text-slate-600 ml-2"
                            value=""
                            onChange={e => {
                              if (!e.target.value) return;
                              const currentRates = { ...(editingEmployee.payroll?.machineRates || {}) };
                              currentRates[e.target.value] = 0;
                              handleUpdateEmployeePayroll('machineRates', currentRates);
                            }}
                          >
                            <option value="">+ Добавить станок</option>
                            {availableMachines.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="space-y-2">
                        {configuredMachineIds.length === 0 ? (
                          <p className="text-xs text-slate-400 italic ml-1">Нет добавленных станков. Выберите из списка выше.</p>
                        ) : (
                          configuredMachineIds.map(mId => {
                            const m = machines.find(x => x.id === mId);
                            if (!m) return null;
                            return (
                              <div key={m.id} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-bold text-slate-700 truncate block">{m.name}</span>
                                </div>
                                <input 
                                  type="number" 
                                  placeholder="Ставка"
                                  disabled={!editingEmployee.payroll?.overrides?.machineRates}
                                  value={isMachineRatesOverridden ? (editingEmployee.payroll?.machineRates?.[m.id] ?? '') : (activeMachineRates[m.id] ?? '')}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const currentRates = { ...(editingEmployee.payroll?.machineRates || {}) };
                                    currentRates[m.id] = Number(val);
                                    handleUpdateEmployeePayroll('machineRates', currentRates);
                                  }}
                                  className={`w-24 bg-white border-2 border-slate-200 rounded-xl px-2 py-1 text-xs font-bold outline-none focus:border-blue-500 ${!editingEmployee.payroll?.overrides?.machineRates ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                                />
                                <button
                                  type="button"
                                  disabled={!editingEmployee.payroll?.overrides?.machineRates}
                                  onClick={() => {
                                    const currentRates = { ...(editingEmployee.payroll?.machineRates || {}) };
                                    delete currentRates[m.id];
                                    handleUpdateEmployeePayroll('machineRates', currentRates);
                                  }}
                                  className={`p-1 transition-colors ${!editingEmployee.payroll?.overrides?.machineRates ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500'}`}
                                  title="Удалить станок"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-3">
                 <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest text-center">Безопасность и доступ</p>
                 
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-700 uppercase ml-1">Telegram Chat ID</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editingEmployee.telegramChatId || ''} 
                        onChange={e => setEditingEmployee({...editingEmployee, telegramChatId: e.target.value})} 
                        placeholder="123456789"
                        className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-500 bg-white text-amber-900" 
                      />
                      {telegramSettings?.enabled && telegramSettings.botToken && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch(`https://api.telegram.org/bot${telegramSettings.botToken}/getUpdates`);
                              const data = await res.json();
                              if (data.ok && data.result.length > 0) {
                                const lastMsg = data.result[data.result.length - 1];
                                const chatId = lastMsg.message?.chat.id || lastMsg.channel_post?.chat.id;
                                const senderName = lastMsg.message?.from?.first_name || lastMsg.message?.from?.username || 'Неизвестно';
                                if (chatId) {
                                  if (confirm(`Найдено сообщение от "${senderName}" (ID: ${chatId}). Использовать этот ID?`)) {
                                    setEditingEmployee({...editingEmployee, telegramChatId: String(chatId)});
                                  }
                                } else {
                                  alert('Не удалось определить ID. Напишите боту любое сообщение.');
                                }
                              } else {
                                alert('Нет новых сообщений. Пусть сотрудник напишет боту любое сообщение.');
                              }
                            } catch (e) {
                              alert('Ошибка при запросе к Telegram API');
                            }
                          }}
                          className="px-3 py-2 bg-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-300 transition-colors whitespace-nowrap"
                        >
                          Найти
                        </button>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[9px] text-amber-600/70">Для личных уведомлений</p>
                      {editingEmployee.telegramChatId && telegramSettings?.enabled && telegramSettings.botToken && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch(`https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  chat_id: editingEmployee.telegramChatId,
                                  text: `👋 Привет, ${editingEmployee.name}! Это тестовое уведомление от WorkTracker Pro.`
                                })
                              });
                              const data = await res.json();
                              if (data.ok) alert('Тестовое сообщение отправлено!');
                              else alert('Ошибка: ' + data.description);
                            } catch (e) {
                              alert('Ошибка при отправке');
                            }
                          }}
                          className="text-[9px] font-bold text-amber-700 underline hover:text-amber-900"
                        >
                          Проверить
                        </button>
                      )}
                    </div>

                    {telegramSettings?.enabled && (
                      <div className="mt-3 pt-3 border-t border-amber-200/50 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[8px] font-black text-amber-700 uppercase tracking-tighter">Типы уведомлений для сотрудника:</p>
                          {!editingEmployee.telegramChatId && (
                            <span className="text-[7px] font-bold text-amber-500 uppercase bg-amber-100 px-1.5 py-0.5 rounded">Требуется ID</span>
                          )}
                        </div>
                        <div className={`grid grid-cols-1 gap-2 ${!editingEmployee.telegramChatId ? 'opacity-50 pointer-events-none' : ''}`}>
                          {[
                            { id: 'notifyOnShiftStart', label: 'Начало смены' },
                            { id: 'notifyOnShiftEnd', label: 'Конец смены' },
                            { id: 'notifyOnLimitExceeded', label: 'Превышение лимита' }
                          ].map(type => (
                            <label key={type.id} className="flex items-center gap-2 cursor-pointer group">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  disabled={!editingEmployee.telegramChatId}
                                  checked={editingEmployee.telegramSettings?.[type.id as keyof typeof editingEmployee.telegramSettings] ?? true}
                                  onChange={e => {
                                    const currentSettings = editingEmployee.telegramSettings || {
                                      notifyOnShiftStart: true,
                                      notifyOnShiftEnd: true,
                                      notifyOnLimitExceeded: true
                                    };
                                    setEditingEmployee({
                                      ...editingEmployee,
                                      telegramSettings: {
                                        ...currentSettings,
                                        [type.id]: e.target.checked
                                      }
                                    });
                                  }}
                                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              </div>
                              <span className="text-[10px] font-bold text-amber-800 group-hover:text-amber-900 transition-colors uppercase tracking-tight">{type.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>

                 <button 
                   type="button" 
                   onClick={() => setEditingEmployee({...editingEmployee, forcePinChange: true})}
                   className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${editingEmployee.forcePinChange ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-100'}`}
                 >
                   {editingEmployee.forcePinChange ? 'PIN будет сброшен при входе' : 'Сбросить PIN при входе'}
                 </button>
                 <button 
                   type="button" 
                   onClick={handleResetDevicePairing}
                   className="w-full py-3 bg-white text-amber-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 border-amber-200 hover:bg-amber-100"
                 >
                   Сбросить привязку устройства
                 </button>
              </div>

              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest mt-2">Сохранить изменения</button>
           </form>
         </div>
      </div>
    </div>
  );
};
