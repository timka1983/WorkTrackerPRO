import React from 'react';
import { User, UserRole, Organization, PlanType } from '../types';
import { STORAGE_KEYS } from '../constants';

interface LoginScreenProps {
  users: User[];
  selectedLoginUser: User | null;
  setSelectedLoginUser: (user: User | null) => void;
  pinInput: string;
  setPinInput: React.Dispatch<React.SetStateAction<string>>;
  loginError: string;
  setLoginError: (error: string) => void;
  validateAndLogin: (pin: string, user?: User) => void;
  setShowLanding: (show: boolean) => void;
  setShowResetModal: (show: boolean) => void;
  currentOrg: Organization | null;
  appVersion: string;
  globalAdminPin: string;
  setCurrentUser: (user: User) => void;
  isSelectedUserAdmin: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  selectedLoginUser,
  setSelectedLoginUser,
  pinInput,
  setPinInput,
  loginError,
  setLoginError,
  validateAndLogin,
  setShowLanding,
  setShowResetModal,
  currentOrg,
  appVersion,
  globalAdminPin,
  setCurrentUser,
  isSelectedUserAdmin
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 w-full max-w-md relative overflow-hidden">
        <button 
          onClick={() => setShowLanding(true)}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div className="absolute top-0 right-0 p-3">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{appVersion}</span>
        </div>
        
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white p-4 rounded-3xl inline-block mb-4 shadow-xl shadow-blue-100">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{currentOrg?.name || 'WorkTracker PRO'}</h1>
          <div className="flex justify-center mt-1">
             <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-blue-100">
                Тариф: {currentOrg?.plan || PlanType.FREE}
             </span>
          </div>
        </div>

        {!selectedLoginUser ? (
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Личный доступ</label>
              <select 
                onChange={(e) => {
                  const user = users.find(u => u.id === e.target.value);
                  if (user) {
                    setSelectedLoginUser(user);
                    localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
                  }
                }}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Выберите себя в списке...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} — {u.position}</option>
                ))}
              </select>
            </div>
            <div className="p-5 bg-blue-50 rounded-[2rem] border border-blue-100">
              <p className="text-[11px] text-blue-800 font-semibold leading-relaxed">
                 <span className="font-black uppercase block mb-1">Важно:</span> 
                 Используйте ваш PIN-код для входа в систему.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-[2rem] mb-4 border border-blue-100">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                {selectedLoginUser.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-900">{selectedLoginUser.name}</p>
                {isSelectedUserAdmin && (
                  <button type="button" onClick={() => { setSelectedLoginUser(null); setPinInput(''); }} className="text-[10px] text-blue-600 uppercase underline font-black">Сменить профиль</button>
                )}
              </div>
            </div>
            <div>
              <div className="flex justify-center gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pinInput.length > i ? 'bg-blue-600 border-blue-600 scale-125 shadow-xl' : 'border-slate-300'}`}></div>
                ))}
              </div>
              <input 
                type="password"
                inputMode="none"
                maxLength={4}
                value={pinInput}
                readOnly
                className="absolute opacity-0 pointer-events-none"
                tabIndex={-1}
              />
              {loginError && <p className="text-red-500 text-[11px] text-center mt-2 font-black uppercase tracking-widest">{loginError}</p>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (n === 'del') {
                      setPinInput(prev => prev.slice(0, -1));
                      setLoginError('');
                    }
                    else if (typeof n === 'number' && pinInput.length < 4) {
                      const newPin = pinInput + n;
                      setPinInput(newPin);
                      if (newPin.length === 4) {
                        validateAndLogin(newPin, selectedLoginUser);
                      }
                    }
                  }}
                  className={`h-16 rounded-[1.5rem] font-black flex items-center justify-center transition-all active:scale-95 ${n === '' ? 'pointer-events-none' : 'bg-slate-50 hover:bg-white border-2 border-slate-100 text-slate-800 text-xl'}`}
                >
                  {n === 'del' ? '←' : n}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-3 mt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Введите 4 цифры для входа</p>
              {selectedLoginUser.id === 'admin' && (
                <button 
                  onClick={() => setShowResetModal(true)}
                  className="text-[10px] text-blue-600 uppercase font-black hover:underline"
                >
                  Забыли PIN администратора?
                </button>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-center">
          <button 
            onClick={() => {
              const pin = prompt('Введите мастер-ключ для входа в Back-office:');
              if (!pin) return;

              // Special backdoor for iOS empty list issue:
              // If Global Admin PIN is entered here, try to force login as local admin
              if (pin === globalAdminPin && currentOrg) {
                const adminUser = users.find(u => u.id === 'admin');
                if (adminUser) {
                  // Force login as admin
                  const loginSessionUser = { ...adminUser, role: UserRole.EMPLOYER };
                  setCurrentUser(loginSessionUser);
                  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(loginSessionUser));
                  localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, adminUser.id);
                  setPinInput('');
                  setLoginError('');
                  setShowLanding(false);
                  return;
                }
              }

              validateAndLogin(pin, selectedLoginUser || undefined);
            }}
            className="text-[9px] text-slate-300 hover:text-indigo-400 transition-colors uppercase font-black tracking-tighter"
          >
            SaaS Back-office
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
