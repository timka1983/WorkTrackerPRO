
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, UserRole, WorkLog, Machine, PositionConfig } from './types';
import { STORAGE_KEYS, INITIAL_USERS, INITIAL_MACHINES, INITIAL_POSITIONS, INITIAL_LOGS, DEFAULT_PERMISSIONS } from './constants';
import Layout from './components/Layout';
import EmployeeView from './components/EmployeeView';
import EmployerView from './components/EmployerView';
import { db } from './lib/supabase';

const APP_VERSION = 'v1.8.0-PRO';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [positions, setPositions] = useState<PositionConfig[]>([]);
  
  const [selectedLoginUser, setSelectedLoginUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const initData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsSyncing(true);
    
    const cachedLogs = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);
    const cachedUsers = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
    const cachedMachines = localStorage.getItem(STORAGE_KEYS.MACHINES_LIST);
    const cachedPositions = localStorage.getItem(STORAGE_KEYS.POSITIONS_LIST);
    const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const lastUserId = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);

    if (!isRefresh) {
      if (cachedLogs) setLogs(JSON.parse(cachedLogs));
      
      let loadedUsers = INITIAL_USERS;
      if (cachedUsers) {
        loadedUsers = JSON.parse(cachedUsers);
        setUsers(loadedUsers);
      } else {
        setUsers(INITIAL_USERS);
      }

      if (lastUserId && !cachedCurrentUser) {
        const lastUser = loadedUsers.find(u => u.id === lastUserId);
        if (lastUser) setSelectedLoginUser(lastUser);
      }

      if (cachedMachines) setMachines(JSON.parse(cachedMachines));
      
      if (cachedPositions) {
        setPositions(JSON.parse(cachedPositions));
      } else {
        setPositions(INITIAL_POSITIONS);
      }

      if (cachedCurrentUser) setCurrentUser(JSON.parse(cachedCurrentUser));
    }

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
        if (!lastUserId) {
          const recheckLastId = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
          if (recheckLastId) {
             const lastUser = dbUsers.find(u => u.id === recheckLastId);
             if (lastUser) setSelectedLoginUser(lastUser);
          }
        }
      } else if (!cachedUsers && !isRefresh) {
        for (const u of INITIAL_USERS) await db.upsertUser(u);
      }

      if (dbMachines && dbMachines.length > 0) {
        setMachines(dbMachines);
        localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(dbMachines));
      } else if (!cachedMachines && !isRefresh) {
        setMachines(INITIAL_MACHINES);
        await db.saveMachines(INITIAL_MACHINES);
      }

      if (dbPositions && dbPositions.length > 0) {
        // Handle migration from string positions to full config objects
        const normalized = dbPositions.map((p: any) => 
          typeof p === 'string' 
            ? (INITIAL_POSITIONS.find(ip => ip.name === p) || { name: p, permissions: DEFAULT_PERMISSIONS }) 
            : p
        );
        setPositions(normalized);
        localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(normalized));
      }
    } catch (err) {
      console.warn("Cloud sync deferred: working in offline/cache mode.");
    } finally {
      if (!isRefresh) setIsInitialized(true);
      if (isRefresh) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    initData();
  }, [initData]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return DEFAULT_PERMISSIONS;
    if (currentUser.id === 'admin') return { ...DEFAULT_PERMISSIONS, isFullAdmin: true };
    const pos = positions.find(p => p.name === currentUser.position);
    return pos?.permissions || DEFAULT_PERMISSIONS;
  }, [currentUser, positions]);

  const isSelectedUserAdmin = useMemo(() => {
    if (!selectedLoginUser) return false;
    if (selectedLoginUser.id === 'admin') return true;
    const pos = positions.find(p => p.name === selectedLoginUser.position);
    return pos?.permissions?.isFullAdmin || pos?.permissions?.isLimitedAdmin;
  }, [selectedLoginUser, positions]);

  const handleRefresh = async () => {
    await initData(true);
  };

  const validateAndLogin = (pin: string, user: User) => {
    if (pin === user.pin) {
      setCurrentUser(user);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
      setPinInput('');
      setLoginError('');
    } else {
      setLoginError('Неверный PIN-код');
      setTimeout(() => setPinInput(''), 500);
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

  const handleLogsUpdate = useCallback((newLogs: WorkLog[]) => {
    const currentLogsMap = new Map(logs.map(l => [l.id, JSON.stringify(l)]));
    const changedOrNew = newLogs.filter(nl => currentLogsMap.get(nl.id) !== JSON.stringify(nl));

    setLogs(newLogs);
    localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(newLogs));
    changedOrNew.forEach(log => db.upsertLog(log));
  }, [logs]);

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

  const persistPositions = (newPositions: PositionConfig[]) => {
    setPositions(newPositions);
    localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(newPositions));
    db.savePositions(newPositions.map(p => p.name));
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
        await db.savePositions(data.positions.map((p: any) => typeof p === 'string' ? p : p.name));
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
                   Используйте ваш PIN-код. Для новых сотрудников по умолчанию <span className="underline">0000</span>.
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
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Введите 4 цифры для входа</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine if the current view should be Employer based on role OR position permissions
  const isEmployerAuthorized = currentUser.role === UserRole.EMPLOYER || userPermissions.isFullAdmin || userPermissions.isLimitedAdmin;

  return (
    <Layout user={currentUser} onLogout={handleLogout} onSwitchRole={handleSwitchRole} version={APP_VERSION}>
      {currentUser.role === UserRole.EMPLOYEE ? (
        <EmployeeView 
          user={currentUser} 
          logs={logs} 
          onLogUpdate={handleLogsUpdate} 
          machines={machines} 
          positions={positions} 
          onUpdateUser={handleUpdateUser} 
        />
      ) : (
        isEmployerAuthorized ? (
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
            onRefresh={handleRefresh}
            isSyncing={isSyncing}
          />
        ) : (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-slate-900 uppercase">Доступ ограничен</h2>
            <p className="text-slate-500 mt-2 font-medium">У вас нет прав для просмотра этого раздела.</p>
            <button onClick={() => handleSwitchRole(UserRole.EMPLOYEE)} className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs">Вернуться в Мой Табель</button>
          </div>
        )
      )}
    </Layout>
  );
};

export default App;
