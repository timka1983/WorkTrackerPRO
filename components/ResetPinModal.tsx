import React, { useState } from 'react';
import { Organization } from '../types';
import { db } from '../lib/supabase';

interface ResetPinModalProps {
  currentOrg: Organization | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ResetPinModal: React.FC<ResetPinModalProps> = ({ currentOrg, onClose, onSuccess }) => {
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'newPin'>('email');
  const [resetStatus, setResetStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [tempNewPin, setTempNewPin] = useState('');

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    
    if (resetStep === 'email') {
      if (!currentOrg?.email) {
        setResetStatus({ text: 'Email для этой организации не настроен. Обратитесь в поддержку.', type: 'error' });
        return;
      }
      
      if (resetEmailInput.toLowerCase() === currentOrg.email.toLowerCase()) {
        setResetStep('newPin');
      } else {
        setResetStatus({ text: 'Email не совпадает с данными организации.', type: 'error' });
      }
    } else {
      if (tempNewPin.length !== 4) {
        setResetStatus({ text: 'PIN должен состоять из 4 цифр.', type: 'error' });
        return;
      }
      
      try {
        await db.resetAdminPin(currentOrg!.id, tempNewPin);
        setResetStatus({ text: 'Пароль администратора успешно изменен!', type: 'success' });
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } catch (err) {
        setResetStatus({ text: 'Ошибка при сбросе пароля.', type: 'error' });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Сброс PIN админа</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
        </div>
        
        <form onSubmit={handleResetRequest} className="space-y-6">
          {resetStep === 'email' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Введите email организации для подтверждения личности.
              </p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Email организации</label>
                <input 
                  type="email"
                  required
                  value={resetEmailInput}
                  onChange={e => setResetEmailInput(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Email подтвержден. Введите новый 4-значный PIN.
              </p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Новый PIN</label>
                <input 
                  type="text"
                  maxLength={4}
                  required
                  value={tempNewPin}
                  onChange={e => setTempNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0000"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center text-blue-600"
                />
              </div>
            </div>
          )}

          {resetStatus && (
            <p className={`text-[10px] font-bold text-center uppercase p-2 rounded-lg ${resetStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {resetStatus.text}
            </p>
          )}

          <button 
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 active:scale-95 transition-all"
          >
            {resetStep === 'email' ? 'Подтвердить Email' : 'Сбросить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPinModal;
