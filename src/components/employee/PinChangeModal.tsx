import React, { memo } from 'react';
import { User } from '../../../types';

interface PinChangeModalProps {
  user: User;
  pinState: { old: string; new: string; confirm: string };
  setPinState: (state: any) => void;
  pinError: string;
  handlePinChangeSubmit: (e: React.FormEvent) => void;
  setShowPinChange: (val: boolean) => void;
}

const PinChangeModal: React.FC<PinChangeModalProps> = ({
  user,
  pinState,
  setPinState,
  pinError,
  handlePinChangeSubmit,
  setShowPinChange
}) => {
  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 border border-slate-200">
         <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Смена PIN-кода</h3>
              {user.forcePinChange && <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Необходима смена пароля</p>}
            </div>
            {!user.forcePinChange && (
              <button onClick={() => setShowPinChange(false)} className="text-slate-400 text-2xl">&times;</button>
            )}
         </div>
         <form onSubmit={handlePinChangeSubmit} className="space-y-4">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Текущий PIN</label>
               <input 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                  value={pinState.old}
                  onChange={e => setPinState({...pinState, old: e.target.value.replace(/[^0-9]/g, '')})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center"
               />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Новый PIN (4 цифры)</label>
               <input 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                  value={pinState.new}
                  onChange={e => setPinState({...pinState, new: e.target.value.replace(/[^0-9]/g, '')})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center text-blue-600"
               />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Повторите новый PIN</label>
               <input 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                  value={pinState.confirm}
                  onChange={e => setPinState({...pinState, confirm: e.target.value.replace(/[^0-9]/g, '')})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center text-blue-600"
               />
            </div>
            {pinError && <p className="text-red-500 text-[10px] font-black text-center uppercase">{pinError}</p>}
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 mt-4 active:scale-95 transition-all">Обновить PIN</button>
         </form>
      </div>
    </div>
  );
};

export default memo(PinChangeModal);
