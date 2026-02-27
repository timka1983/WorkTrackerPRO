import React, { memo } from 'react';
import { User, PositionConfig } from '../../../types';

interface EmployeeEditModalProps {
  editingEmployee: User | null;
  positions: PositionConfig[];
  planFeatures: { photoCapture: boolean };
  onClose: () => void;
  onUpdateEmployee: (emp: User) => void;
  onResetDevicePairing: () => void;
  setEditingEmployee: (emp: User | null) => void;
}

const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  editingEmployee,
  positions,
  planFeatures,
  onClose,
  onUpdateEmployee,
  onResetDevicePairing,
  setEditingEmployee
}) => {
  if (!editingEmployee) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateEmployee(editingEmployee);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Редактировать сотрудника</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl font-light">&times;</button>
         </div>
         <form onSubmit={handleSubmit} className="p-8 space-y-4">
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
                  <div className={`flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 h-[52px] ${!planFeatures.photoCapture ? 'opacity-50' : ''}`}>
                     <input 
                       disabled={!planFeatures.photoCapture}
                       type="checkbox" 
                       checked={editingEmployee.requirePhoto} 
                       onChange={e => setEditingEmployee({...editingEmployee, requirePhoto: e.target.checked})} 
                       className="w-5 h-5 rounded accent-blue-600" 
                       id="edit-req-photo" 
                     />
                     <label htmlFor="edit-req-photo" className="text-[9px] font-black text-slate-600 uppercase cursor-pointer">
                        Фото {!planFeatures.photoCapture && 'PRO'}
                     </label>
                  </div>
               </div>
            </div>

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
                 onClick={onResetDevicePairing}
                 className="w-full py-3 bg-white text-amber-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 border-amber-200 hover:bg-amber-100"
               >
                 Сбросить привязку устройства
               </button>
            </div>

            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest mt-2">Сохранить изменения</button>
         </form>
      </div>
    </div>
  );
};

export default memo(EmployeeEditModal);
