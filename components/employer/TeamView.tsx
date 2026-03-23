import React, { useState } from 'react';
import { User, PositionConfig, PlanLimits, Organization, Machine, WorkLog, Branch } from '../../types';
import { Archive, Send, QrCode } from 'lucide-react';
import { ArchiveConfirmModal, ArchiveViewModal } from './ArchiveModals';
import { QRCodeSVG } from 'qrcode.react';
import { sendTelegramNotification } from '../../utils';

interface TeamViewProps {
  users: User[];
  positions: PositionConfig[];
  planLimits: PlanLimits;
  currentOrg: Organization | null;
  isUserLimitReached: boolean;
  newUser: { name: string; pin: string; position: string; department: string; birthday: string; requirePhoto: boolean; branchId?: string };
  setNewUser: (user: { name: string; pin: string; position: string; department: string; birthday: string; requirePhoto: boolean; branchId?: string }) => void;
  handleAddUser: (e: React.FormEvent) => void;
  dashboardStats: any;
  machines: Machine[];
  userPerms: any;
  handleForceFinish: (log: WorkLog) => void;
  setEditingEmployee: (user: User) => void;
  onDeleteUser: (id: string, reason?: string) => void;
  branches: Branch[];
  getArchivedUsers: () => Promise<User[] | null>;
  handleRestoreUser: (id: string) => Promise<{ error: any }>;
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
  onDeleteUser,
  branches,
  getArchivedUsers,
  handleRestoreUser
}) => {
  const [archiveConfirm, setArchiveConfirm] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: '',
    userName: ''
  });
  const [isArchiveViewOpen, setIsArchiveViewOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isTelegramQrModalOpen, setIsTelegramQrModalOpen] = useState(false);
  const [selectedUserForQr, setSelectedUserForQr] = useState<User | null>(null);

  const handleConfirmArchive = (reason: string) => {
    onDeleteUser(archiveConfirm.userId, reason);
    setArchiveConfirm({ isOpen: false, userId: '', userName: '' });
  };

  const appUrl = currentOrg ? `${window.location.origin}?orgId=${currentOrg.id}` : window.location.origin;
  // NOTE: Replace 'YourBotName' with your actual Telegram bot username
  const botUsername = 'YourBotName';
  const telegramBotUrl = `https://t.me/${botUsername}?start=${selectedUserForQr?.id || ''}`;

  const handleSendTelegram = (user: User) => {
    if (!currentOrg?.telegramSettings?.botToken) {
      alert('Телеграм бот не настроен в настройках организации.');
      return;
    }
    const chatId = user.telegramChatId || currentOrg.telegramSettings.chatId;
    if (!chatId) {
      alert('Не указан Telegram ID сотрудника или общий чат.');
      return;
    }
    sendTelegramNotification(
      currentOrg.telegramSettings.botToken,
      chatId,
      `Привет, ${user.name}! Твой QR-код для входа в WorkTracker PRO: ${appUrl}. Отсканируй его, чтобы быстро перейти к странице входа.`
    );
    alert('Ссылка на вход отправлена в Telegram!');
  };

  return (
    <section className="grid grid-cols-1 gap-8">
      <div className="space-y-8">
        <div className={`bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 sticky top-24 ${isUserLimitReached ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Новый сотрудник</h3>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUserLimitReached ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>
              {users.length} / {planLimits.maxUsers}
            </span>
          </div>
          
          {isUserLimitReached ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 text-center space-y-3">
               <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-tight">Достигнут лимит сотрудников для тарифа {currentOrg?.plan}</p>
               <button onClick={() => window.location.href='#pricing'} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl dark:shadow-slate-900/20 shadow-blue-200">Расширить лимит</button>
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="space-y-4">
              <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="ФИО сотрудника" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-medium outline-none bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none" />
              <select value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none">
                {positions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              
              {branches.length > 0 && (
                <select 
                  value={newUser.branchId || ''} 
                  onChange={e => setNewUser({...newUser, branchId: e.target.value})} 
                  className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                >
                  <option value="">Без филиала (Все)</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              <input type="text" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/[^0-9]/g, '')})} placeholder="PIN (0000)" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-mono bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none" />
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Дата рождения</label>
                <input 
                  type="date" 
                  value={newUser.birthday} 
                  onChange={e => setNewUser({...newUser, birthday: e.target.value})} 
                  className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none" 
                />
              </div>

              <div className={`flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-slate-100 dark:border-slate-800 ${!planLimits.features.photoCapture ? 'opacity-50' : ''}`}>
                <input 
                  disabled={!planLimits.features.photoCapture}
                  type="checkbox" 
                  checked={newUser.requirePhoto} 
                  onChange={e => setNewUser({...newUser, requirePhoto: e.target.checked})} 
                  className="w-5 h-5 rounded accent-blue-600" 
                  id="req-photo" 
                />
                <label htmlFor="req-photo" className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase cursor-pointer">
                   Обязательное фото {!planLimits.features.photoCapture && '(PRO)'}
                </label>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl dark:shadow-slate-900/20 shadow-blue-100 dark:shadow-none uppercase text-xs tracking-widest">Создать</button>
            </form>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 cursor-pointer hover:border-blue-300 transition-all" onClick={() => setIsQrModalOpen(true)}>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-widest mb-4 underline decoration-blue-500 decoration-4 underline-offset-8">QR-код для входа</h3>
          <div className="flex flex-col items-center gap-4">
            <QRCodeSVG value={appUrl} size={160} />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center font-medium">Нажмите, чтобы увеличить</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
         <div className="flex items-center justify-between px-2 col-span-1 md:col-span-2">
           <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Список сотрудников</h3>
           <button 
             onClick={() => setIsArchiveViewOpen(true)}
             className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200 transition-all text-[9px] font-black uppercase tracking-widest"
           >
             <Archive size={12} />
             Архив
           </button>
         </div>

         {users.filter(u => !u.isArchived).map(u => {
           const activeLogs = dashboardStats.activeLogsMap[u.id] || [];
           const isWorking = activeLogs.length > 0;
           return (
             <div 
               key={u.id} 
               className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-center justify-between group shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all gap-4 ${
                 isWorking 
                   ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400' 
                   : 'bg-slate-50/20 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800 hover:border-slate-200 opacity-90 hover:opacity-100'
               }`}
             >
                <div className="flex-1 flex items-center gap-4 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${
                      isWorking ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      {u.name.charAt(0)}
                    </div>
                    {isWorking && <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-600 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">{u.name}</h4>
                      {u.forcePinChange && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase rounded-full border border-amber-200 dark:border-amber-800">PIN Reset</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">{u.position}</p>
                       {branches.find(b => b.id === u.branchId) && (
                         <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded-full border border-slate-200 dark:border-slate-700 truncate max-w-[100px]">
                           {branches.find(b => b.id === u.branchId)?.name}
                         </span>
                       )}
                    </div>
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
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/30 group/stop shadow-md dark:shadow-slate-900/20"
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
                    onClick={() => { setSelectedUserForQr(u); setIsTelegramQrModalOpen(true); }}
                    className={`p-3 transition-all rounded-2xl ${
                      isWorking ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20' : 'text-slate-300 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                    title="QR-код для Telegram"
                  >
                    <QrCode size={20} />
                  </button>
                  <button 
                    onClick={() => setEditingEmployee(u)}
                    className={`p-3 transition-all rounded-2xl ${
                      isWorking ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20' : 'text-slate-300 hover:text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                    title="Редактировать"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  {u.id !== 'admin' && (
                    <button 
                      onClick={() => setArchiveConfirm({ isOpen: true, userId: u.id, userName: u.name })} 
                      className={`p-3 transition-all rounded-2xl ${
                        isWorking ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20' : 'text-slate-300 hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      }`}
                      title="Архивировать"
                    >
                      <Archive size={20} />
                    </button>
                  )}
                </div>
             </div>
           );
         })}
      </div>


      {isTelegramQrModalOpen && selectedUserForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsTelegramQrModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-2xl dark:shadow-slate-900/40" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Telegram для {selectedUserForQr.name}</h3>
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG value={telegramBotUrl} size={300} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium max-w-[250px]">Сотрудник должен отсканировать код, чтобы перейти к боту и привязать свой Telegram ID.</p>
            <button className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest" onClick={() => setIsTelegramQrModalOpen(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsQrModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-2xl dark:shadow-slate-900/40" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">QR-код для входа</h3>
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG value={appUrl} size={300} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium max-w-[250px]">Сотрудники могут отсканировать этот код, чтобы быстро перейти к странице входа.</p>
            <button className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest" onClick={() => setIsQrModalOpen(false)}>Закрыть</button>
          </div>
        </div>
      )}


      <ArchiveConfirmModal
        isOpen={archiveConfirm.isOpen}
        onClose={() => setArchiveConfirm({ isOpen: false, userId: '', userName: '' })}
        onConfirm={handleConfirmArchive}
        title="Архивация сотрудника"
        itemName={archiveConfirm.userName}
      />

      <ArchiveViewModal
        isOpen={isArchiveViewOpen}
        onClose={() => setIsArchiveViewOpen(false)}
        type="users"
        getArchivedItems={getArchivedUsers}
        onRestore={handleRestoreUser}
      />
    </section>
  );
};
