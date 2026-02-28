import React from 'react';
import { User, PositionConfig, PlanLimits, PayrollConfig } from '../../types';
import { DEFAULT_PAYROLL_CONFIG } from '../../constants';

interface EmployeeEditModalProps {
  editingEmployee: User;
  setEditingEmployee: (user: User | null) => void;
  saveEmployeeEdit: (e: React.FormEvent) => void;
  positions: PositionConfig[];
  planLimits: PlanLimits;
  canUsePayroll: boolean;
  handleUpdateEmployeePayroll: (key: keyof PayrollConfig, value: any) => void;
  handleResetDevicePairing: () => void;
}

export const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  editingEmployee,
  setEditingEmployee,
  saveEmployeeEdit,
  positions,
  planLimits,
  canUsePayroll,
  handleUpdateEmployeePayroll,
  handleResetDevicePairing
}) => {
  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
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
                    <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                      {(['hourly', 'fixed', 'shift'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleUpdateEmployeePayroll('type', type)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(editingEmployee.payroll?.type || positions.find(p => p.name === editingEmployee.position)?.payroll?.type || DEFAULT_PAYROLL_CONFIG.type) === type ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
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
                         value={editingEmployee.payroll?.rate ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.rate || DEFAULT_PAYROLL_CONFIG.rate)}
                         onChange={e => handleUpdateEmployeePayroll('rate', Number(e.target.value))}
                         className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Коэф. переработок</label>
                       <input 
                         type="number" 
                         step="0.1"
                         value={editingEmployee.payroll?.overtimeMultiplier ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.overtimeMultiplier || DEFAULT_PAYROLL_CONFIG.overtimeMultiplier)}
                         onChange={e => handleUpdateEmployeePayroll('overtimeMultiplier', Number(e.target.value))}
                         className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                       />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (₽)</label>
                     <input 
                       type="number" 
                       value={editingEmployee.payroll?.nightShiftBonus ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.nightShiftBonus || DEFAULT_PAYROLL_CONFIG.nightShiftBonus)}
                       onChange={e => handleUpdateEmployeePayroll('nightShiftBonus', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                </div>
              )}

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-3">
                 <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest text-center">Безопасность и доступ</p>
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
