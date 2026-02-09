
import React, { useState, useEffect } from 'react';
import { User, UserRole, WorkLog, Machine } from './types';
import { STORAGE_KEYS, INITIAL_USERS, INITIAL_MACHINES, INITIAL_POSITIONS, INITIAL_LOGS } from './constants';
import Layout from './components/Layout';
import EmployeeView from './components/EmployeeView';
import EmployerView from './components/EmployerView';
import { db } from './lib/supabase';

const APP_VERSION = 'v1.7.2';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  
  const [selectedLoginUser, setSelectedLoginUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initData = async () => {
      // 1. Сначала загружаем из LocalStorage для быстрого старта (кэш)
      const cachedLogs = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);
      const cachedUsers = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
      const cachedMachines = localStorage.getItem(STORAGE_KEYS.MACHINES_LIST);
      const cachedPositions = localStorage.getItem(STORAGE_KEYS.POSITIONS_LIST);
      const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);

      if (cachedLogs) setLogs(JSON.parse(cachedLogs));
      if (cachedUsers) setUsers(JSON.parse(cachedUsers));
      if (cachedMachines) setMachines(JSON.parse(cachedMachines));
      if (cachedPositions) setPositions(JSON.parse(cachedPositions));
      if (cachedCurrentUser) setCurrentUser(JSON.parse(cachedCurrentUser));

      // 2. Асинхронно подтягиваем актуальные данные из Supabase
      try {
        const [dbLogs, dbUsers, dbMachines, dbPositions] = await Promise.all([
          db.getLogs(),
          db.getUsers(),
          db.getMachines(),
          db.getPositions()
        ]);

        if (dbLogs) {
          setLogs(dbLogs);
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(dbLogs));
        }
        if (dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers);
          localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(dbUsers));
        } else if (!cachedUsers) {
          setUsers(INITIAL_USERS);
          INITIAL_USERS.forEach(u => db.upsertUser(u));
        }

        if (dbMachines && dbMachines.length > 0) {
          setMachines(dbMachines);
          localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(dbMachines));
        } else if (!cachedMachines) {
          setMachines(INITIAL_MACHINES);
          db.saveMachines(INITIAL_MACHINES);
        }

        if (dbPositions && dbPositions.length > 0) {
          setPositions(dbPositions);
          localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(dbPositions));
        } else if (!cachedPositions) {
          setPositions(INITIAL_POSITIONS);
          db.savePositions(INITIAL_POSITIONS);
        }
      } catch (err) {
        console.warn("Supabase connection failed, using local storage", err);
      }

      setIsInitialized(true);
    };

    initData();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLoginUser && pinInput === selectedLoginUser.pin) {
      setCurrentUser(selectedLoginUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(selectedLoginUser));
      setPinInput('');
      setLoginError('');
    } else {
      setLoginError('Неверный PIN-код');
      setPinInput('');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedLoginUser(null);
    setPinInput('');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  const handleSwitchRole = (role: UserRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      db.upsertUser(updatedUser);
    }
  };

  const handleLogsUpdate = (newLogs: WorkLog[]) => {
    setLogs(newLogs);
    localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(newLogs));
    // Апсертим все логи (новые или измененные)
    newLogs.forEach(log => db.upsertLog(log));
  };

  const handleDeleteLog = (logId: string) => {
    const newLogs = logs.filter(l => l.id !== logId);
    setLogs(newLogs);
    localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(newLogs));
    db.deleteLog(logId);
  };

  const persistUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(newUsers));
  };

  const handleAddUser = (user: User) => {
    const newUsers = [...users, user];
    persistUsers(newUsers);
    db.upsertUser(user);
  };

  const handleUpdateUser = (updatedUser: User) => {
    const newUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    persistUsers(newUsers);
    db.upsertUser(updatedUser);
    if (currentUser?.id === updatedUser.id) {
      const mergedUser = { ...currentUser, ...updatedUser };
      setCurrentUser(mergedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(mergedUser));
    }
  };

  const handleDeleteUser = (userId: string) => {
    const newUsers = users.filter(u => u.id !== userId);
    persistUsers(newUsers);
    db.deleteUser(userId);
  };

  const persistMachines = (newMachines: Machine[]) => {
    setMachines(newMachines);
    localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(newMachines));
    db.saveMachines(newMachines);
  };

  const persistPositions = (newPositions: string[]) => {
    setPositions(newPositions);
    localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(newPositions));
    db.savePositions(newPositions);
  };

  const handleImportData = async (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.users) {
        setUsers(data.users);
        localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(data.users));
        for (const u of data.users) await db.upsertUser(u);
      }
      if (data.logs) {
        setLogs(data.logs);
        localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(data.logs));
        for (const l of data.logs) await db.upsertLog(l);
      }
      if (data.machines) {
        setMachines(data.machines);
        localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(data.machines));
        await db.saveMachines(data.machines);
      }
      if (data.positions) {
        setPositions(data.positions);
        localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(data.positions));
        await db.savePositions(data.positions);
      }
      alert('Данные успешно импортированы и синхронизированы!');
      window.location.reload(); 
    } catch (e) {
      alert('Ошибка при импорте файла!');
    }
  };

  if (!isInitialized) return null;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{APP_VERSION}</span>
          </div>
          
          <div className="text-center mb-8">
            <div className="bg-blue-600 text-white p-4 rounded-3xl inline-block mb-4 shadow-xl shadow-blue-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">WorkTracker PRO</h1>
            <p className="text-slate-500 mt-2 font-medium">Система контроля времени</p>
          </div>

          {!selectedLoginUser ? (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Личный доступ</label>
                <select 
                  onChange={(e) => {
                    const user = users.find(u => u.id === e.target.value);
                    if (user) setSelectedLoginUser(user);
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
                   Используйте PIN-код <span className="underline">0000</span>.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6 animate-fadeIn">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-[2rem] mb-4 border border-blue-100">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                  {selectedLoginUser.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-900">{selectedLoginUser.name}</p>
                  <button type="button" onClick={() => setSelectedLoginUser(null)} className="text-[10px] text-blue-600 uppercase underline font-black">Сменить профиль</button>
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
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  className="absolute opacity-0 pointer-events-none"
                />
                {loginError && <p className="text-red-500 text-[11px] text-center mt-2 font-black uppercase tracking-widest">{loginError}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((n, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (n === 'del') setPinInput(prev => prev.slice(0, -1));
                      else if (typeof n === 'number' && pinInput.length < 4) setPinInput(prev => prev + n);
                    }}
                    className={`h-16 rounded-[1.5rem] font-black flex items-center justify-center transition-all ${n === '' ? 'pointer-events-none' : 'bg-slate-50 hover:bg-white border-2 border-slate-100 text-slate-800 text-xl'}`}
                  >
                    {n === 'del' ? '←' : n}
                  </button>
                ))}
              </div>
              <button 
                type="submit"
                disabled={pinInput.length !== 4}
                className="w-full py-5 bg-blue-600 disabled:opacity-50 text-white rounded-3xl font-black text-sm uppercase tracking-widest"
              >
                Войти
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} onSwitchRole={handleSwitchRole} version={APP_VERSION}>
      {currentUser.role === UserRole.EMPLOYEE ? (
        <EmployeeView user={currentUser} logs={logs} onLogUpdate={handleLogsUpdate} machines={machines} />
      ) : (
        <EmployerView 
          logs={logs} 
          users={users} 
          onAddUser={handleAddUser} 
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser} 
          machines={machines}
          onUpdateMachines={persistMachines}
          positions={positions}
          onUpdatePositions={persistPositions}
          onImportData={handleImportData}
          onLogUpdate={handleLogsUpdate}
          onDeleteLog={handleDeleteLog}
        />
      )}
    </Layout>
  );
};

export default App;
