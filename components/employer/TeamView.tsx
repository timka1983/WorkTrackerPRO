import React from 'react';
import { User, PositionConfig, PlanLimits, Organization, Machine, WorkLog } from '../../types';

interface TeamViewProps {
  users: User[];
  positions: PositionConfig[];
  planLimits: PlanLimits;
  currentOrg: Organization | null;
  isUserLimitReached: boolean;
  newUser: { name: string; pin: string; position: string; department: string; requirePhoto: boolean };
  setNewUser: (user: { name: string; pin: string; position: string; department: string; requirePhoto: boolean }) => void;
  handleAddUser: (e: React.FormEvent) => void;
  dashboardStats: any;
  machines: Machine[];
  userPerms: any;
  handleForceFinish: (log: WorkLog) => void;
  setEditingEmployee: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  users,
  positions,
  planLimits,
  currentOrg,
  isUserLimitReached,
  newUser,
  setNewUser,
  handleAddUser,
  dashboardStats,
  machines,
  userPerms,
  handleForceFinish,
  setEditingEmployee,
  onDeleteUser
}) => {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24 ${isUserLimitReached ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Новый сотрудник</h3>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUserLimitReached ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
              {users.length} / {planLimits.maxUsers}
            </span>
          </div>
          
          {isUserLimitReached ? (
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center space-y-3">
               <p className="text-[11px] font-bold text-blue-800 leading-tight">Достигнут лимит сотрудников для тарифа {currentOrg?.plan}</p>
               <button onClick={() => window.location.href='#pricing'} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">Расширить лимит</button>
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="space-y-4">
              <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="ФИО сотрудника" className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
              <select value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white">
                {positions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              <input type="text" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/[^0-9]/g, '')})} placeholder="PIN (0000)" className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono" />
              <div className={`flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 ${!planLimits.features.photoCapture ? 'opacity-50' : ''}`}>
                <input 
                  disabled={!planLimits.features.photoCapture}
                  type="checkbox" 
                  checked={newUser.requirePhoto} 
                  onChange={e => setNewUser({...newUser, requirePhoto: e.target.checked})} 
                  className="w-5 h-5 rounded accent-blue-600" 
                  id="req-photo" 
                />
                <label htmlFor="req-photo" className="text-xs font-black text-slate-600 uppercase cursor-pointer">
                   Обязательное фото {!planLimits.features.photoCapture && '(PRO)'}
                </label>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest">Создать</button>
            </form>
          )}
        </div>
      </div>
      <div className="lg:col-span-2 space-y-4">
         {users.map(u => {
           const activeLogs = dashboardStats.activeLogsMap[u.id] || [];
           const isWorking = activeLogs.length > 0;
           return (
             <div key={u.id} className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center justify-between group shadow-sm transition-all hover:border-blue-300">
                <div className="flex-1 flex items-center gap-4 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xl">{u.name.charAt(0)}</div>
                    {isWorking && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 border-2 border-white rounded-full animate-pulse"></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 truncate">{u.name}</h4>
                      {u.forcePinChange && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded-full border border-amber-200">PIN Reset</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">{u.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isWorking && (
                    <div className="flex gap-2 mr-2">
                      {activeLogs.map((log: any) => {
                        const machineName = machines.find(m => m.id === log.machineId)?.name || 'Работа';
                        return (
                          <div key={log.id} className="flex flex-col items-center gap-1">
                            {userPerms.isFullAdmin && (
                            <button 
                              onClick={() => handleForceFinish(log)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-100 group/stop shadow-sm"
                              title={`Принудительно остановить (${machineName})`}
                            >
                               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                               <span className="text-[10px] font-black uppercase tracking-tight hidden sm:block">Стоп</span>
                            </button>
                            )}
                            <span className="text-[7px] font-black text-red-400 uppercase tracking-tighter leading-none text-center max-w-[50px] truncate">{machineName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button 
                    onClick={() => setEditingEmployee(u)}
                    className="p-3 text-slate-300 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-2xl"
                    title="Редактировать"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  {u.id !== 'admin' && (
                    <button onClick={() => { if(confirm(`Удалить ${u.name}?`)) onDeleteUser(u.id); }} className="p-3 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-2xl">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
             </div>
           );
         })}
      </div>
    </section>
  );
};
