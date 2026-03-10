import React, { useState } from 'react';
import { Machine, PositionConfig, PlanLimits, Organization, FIXED_POSITION_TURNER, Branch } from '../../types';
import { DEFAULT_PERMISSIONS } from '../../constants';
import { db } from '../../lib/supabase';
import { BranchEditModal } from './BranchEditModal';

interface SettingsViewProps {
  planLimits: PlanLimits;
  nightShiftBonusMinutes: number;
  onUpdateNightBonus: (minutes: number) => void;
  currentOrg: Organization | null;
  onUpdateOrg: (org: Organization) => void;
  machines: Machine[];
  isMachineLimitReached: boolean;
  newMachineName: string;
  setNewMachineName: (name: string) => void;
  handleUpdateMachinesList: (machines: Machine[]) => void;
  editingMachineId: string | null;
  setEditingMachineId: (id: string | null) => void;
  editingMachineBranchId?: string;
  setEditingMachineBranchId?: (id: string | undefined) => void;
  editValue: string;
  setEditValue: (value: string) => void;
  saveMachineEdit: (id: string) => void;
  positions: PositionConfig[];
  newPositionName: string;
  setNewPositionName: (name: string) => void;
  onUpdatePositions: (positions: PositionConfig[]) => void;
  editingPositionName: string | null;
  setEditingPositionName: (name: string | null) => void;
  savePositionEdit: (name: string) => void;
  setConfiguringPosition: (pos: PositionConfig) => void;
  handleExportAll: () => void;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  branches: Branch[];
  onUpdateBranches: (branch: Branch) => void;
  onDeleteBranch: (branchId: string) => void;
  newMachineBranchId?: string;
  setNewMachineBranchId?: (id: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  planLimits,
  nightShiftBonusMinutes,
  onUpdateNightBonus,
  currentOrg,
  onUpdateOrg,
  machines,
  isMachineLimitReached,
  newMachineName,
  setNewMachineName,
  handleUpdateMachinesList,
  editingMachineId,
  setEditingMachineId,
  editingMachineBranchId,
  setEditingMachineBranchId,
  editValue,
  setEditValue,
  saveMachineEdit,
  positions,
  newPositionName,
  setNewPositionName,
  onUpdatePositions,
  editingPositionName,
  setEditingPositionName,
  savePositionEdit,
  setConfiguringPosition,
  handleExportAll,
  handleFileImport,
  branches,
  onUpdateBranches,
  onDeleteBranch,
  newMachineBranchId,
  setNewMachineBranchId
}) => {
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const handleSaveBranch = (branch: Branch) => {
    onUpdateBranches(branch);
  };

  return (
    <div className="space-y-8 no-print">
      {editingBranch !== undefined && (
        <BranchEditModal 
          editingBranch={editingBranch} 
          setEditingBranch={setEditingBranch} 
          onSave={handleSaveBranch} 
        />
      )}

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
         <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Филиалы</h3>
         
         <div className="flex justify-end mb-6">
            <button 
              onClick={() => setEditingBranch({ id: crypto.randomUUID(), organizationId: currentOrg?.id || '', name: '' })}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
            >
              Добавить филиал
            </button>
         </div>

         <div className="space-y-3">
            {branches.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold text-sm">Филиалы не добавлены</p>
                <p className="text-xs text-slate-400 mt-1">Добавьте филиалы, чтобы разделять сотрудников и настройки по локациям</p>
              </div>
            ) : (
              branches.map(branch => (
                <div key={branch.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{branch.name}</h4>
                    {branch.address && <p className="text-xs text-slate-500 mt-0.5">{branch.address}</p>}
                    {branch.locationSettings && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-500 font-bold uppercase tracking-wide">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Геолокация настроена
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingBranch(branch)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button 
                      onClick={() => onDeleteBranch(branch.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
         </div>
      </section>
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        {!planLimits.features.nightShift && (
           <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex items-center justify-center cursor-help" onClick={() => alert('Ночная смена доступна в PRO тарифе')}>
              <span className="bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl">Разблокировать в PRO</span>
           </div>
        )}
        <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Параметры смен</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (мин/час)</label>
                 <div className="flex items-center gap-4">
                    <input 
                       type="number" 
                       min="0"
                       max="60"
                       value={nightShiftBonusMinutes} 
                       onChange={e => onUpdateNightBonus(parseInt(e.target.value || '0'))}
                       className="w-24 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-blue-600 outline-none focus:border-blue-500 transition-all"
                    />
                    <span className="text-xs text-slate-500 font-medium italic leading-tight">
                       Количество бонусных минут, добавляемых за каждый отработанный час в режиме ночной смены.
                    </span>
                 </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                 <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-white transition-all">
                   <div>
                     <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">Округление 15 минут</p>
                     <p className="text-[9px] text-slate-400">Если отработано до 15 минут сверх часа — округлять до часа. Если 16+ минут — считать как есть.</p>
                   </div>
                   <input 
                     type="checkbox" 
                     checked={currentOrg?.roundShiftMinutes || false}
                     onChange={async (e) => {
                       if (currentOrg) {
                         const val = e.target.checked;
                         const updatedOrg = { ...currentOrg, roundShiftMinutes: val };
                         onUpdateOrg(updatedOrg);
                         try {
                           const { error } = await db.updateOrganization(currentOrg.id, { roundShiftMinutes: val });
                           if (error) throw error;
                         } catch (err: any) {
                           alert('Ошибка сохранения: ' + (err.message || err));
                           // Revert on error
                           onUpdateOrg({ ...currentOrg, roundShiftMinutes: !val });
                         }
                       }
                     }}
                     className="w-4 h-4 rounded accent-blue-600"
                   />
                 </label>
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Push-уведомления администратора</label>
              <div className="space-y-2">
                {[
                  { key: 'onShiftStart', label: 'Начало смены', desc: 'Уведомлять, когда сотрудник приступает к работе' },
                  { key: 'onShiftEnd', label: 'Конец смены', desc: 'Уведомлять о завершении работы' },
                  { key: 'onOvertime', label: 'Превышение лимита', desc: 'Уведомлять, если смена длится дольше нормы' },
                ].map(pref => (
                  <label key={pref.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-white transition-all">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{pref.label}</p>
                      <p className="text-[9px] text-slate-400">{pref.desc}</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={(currentOrg?.notificationSettings as any)?.[pref.key] || false}
                      onChange={(e) => {
                        const settings = {
                          ...(currentOrg?.notificationSettings || { onShiftStart: false, onShiftEnd: false, onOvertime: false }),
                          [pref.key]: e.target.checked
                        };
                        if (currentOrg) {
                          const updatedOrg = { ...currentOrg, notificationSettings: settings };
                          onUpdateOrg(updatedOrg);
                          db.updateOrganization(currentOrg.id, { notificationSettings: settings }).then(({ error }) => {
                            if (error) {
                              console.error('Failed to save notification settings:', error);
                            }
                          });
                        }
                      }}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                  </label>
                ))}
                <button 
                  onClick={async () => {
                    if ('Notification' in window) {
                      const permission = await Notification.requestPermission();
                      if (permission === 'granted') {
                        alert('Уведомления включены!');
                      }
                    } else {
                      alert('Ваш браузер не поддерживает Push-уведомления');
                    }
                  }}
                  className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Проверить разрешения браузера
                </button>
              </div>
           </div>
        </div>
      </section>

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
         <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Геолокация (Анти-фрод)</h3>
         
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm font-bold text-slate-800">Контроль местоположения</p>
                  <p className="text-xs text-slate-500">Запретить начало смены вне рабочей зоны</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.locationSettings?.enabled || false}
                    onChange={(e) => {
                       const newSettings = {
                          ...(currentOrg?.locationSettings || { latitude: 0, longitude: 0, radius: 100 }),
                          enabled: e.target.checked
                       };
                       if (currentOrg) {
                          onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                          db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                       }
                    }}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>

            {currentOrg?.locationSettings?.enabled && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Широта</label>
                     <input 
                        type="number" 
                        step="0.000001"
                        value={currentOrg.locationSettings.latitude}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.locationSettings!, latitude: parseFloat(e.target.value) };
                           onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                        }}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Долгота</label>
                     <input 
                        type="number" 
                        step="0.000001"
                        value={currentOrg.locationSettings.longitude}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.locationSettings!, longitude: parseFloat(e.target.value) };
                           onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                        }}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Радиус (метров)</label>
                     <input 
                        type="number" 
                        value={currentOrg.locationSettings.radius}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.locationSettings!, radius: parseInt(e.target.value) };
                           onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                        }}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                  
                  <div className="md:col-span-3">
                     <button 
                        onClick={() => {
                           if ('geolocation' in navigator) {
                              navigator.geolocation.getCurrentPosition(
                                 (position) => {
                                    const newSettings = {
                                       ...currentOrg.locationSettings!,
                                       latitude: position.coords.latitude,
                                       longitude: position.coords.longitude
                                    };
                                    onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                                    db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                                    alert('Координаты обновлены!');
                                 },
                                 (error) => alert('Ошибка получения геопозиции: ' + error.message)
                              );
                           } else {
                              alert('Геолокация не поддерживается');
                           }
                        }}
                        className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Установить текущее местоположение как рабочую зону
                     </button>
                  </div>
               </div>
            )}
         </div>
      </section>

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
         <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Telegram Уведомления</h3>
         
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm font-bold text-slate-800">Интеграция с Telegram</p>
                  <p className="text-xs text-slate-500">Получать уведомления о сменах в чат</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.telegramSettings?.enabled || false}
                    onChange={(e) => {
                       const newSettings = {
                          ...(currentOrg?.telegramSettings || { botToken: '', chatId: '' }),
                          enabled: e.target.checked
                       };
                       if (currentOrg) {
                          onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                          db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                       }
                    }}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>

            {currentOrg?.telegramSettings?.enabled && (
               <div className="grid grid-cols-1 gap-4 animate-fadeIn">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bot Token</label>
                     <input 
                        type="text" 
                        value={currentOrg.telegramSettings.botToken}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.telegramSettings!, botToken: e.target.value };
                           onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                        }}
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                     <p className="text-[10px] text-slate-400 mt-1">Создайте бота через @BotFather и скопируйте токен</p>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chat ID</label>
                     <div className="flex gap-2">
                        <input 
                           type="text" 
                           value={currentOrg.telegramSettings.chatId}
                           onChange={(e) => {
                              const newSettings = { ...currentOrg.telegramSettings!, chatId: e.target.value };
                              onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                              db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                           }}
                           placeholder="-100123456789"
                           className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                        />
                        <button 
                           onClick={async () => {
                              if (!currentOrg.telegramSettings?.botToken) {
                                 alert('Сначала введите Bot Token');
                                 return;
                              }
                              try {
                                 const res = await fetch(`https://api.telegram.org/bot${currentOrg.telegramSettings.botToken}/getUpdates`);
                                 const data = await res.json();
                                 if (data.ok && data.result.length > 0) {
                                    const lastMsg = data.result[data.result.length - 1];
                                    const chatId = lastMsg.message?.chat.id || lastMsg.channel_post?.chat.id;
                                    if (chatId) {
                                       const newSettings = { ...currentOrg.telegramSettings!, chatId: String(chatId) };
                                       onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                                       db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                                       alert(`Chat ID найден: ${chatId}`);
                                    } else {
                                       alert('Не удалось определить Chat ID. Напишите боту сообщение и попробуйте снова.');
                                    }
                                 } else {
                                    alert('Нет обновлений. Напишите боту сообщение и попробуйте снова.');
                                 }
                              } catch (e) {
                                 alert('Ошибка при запросе к Telegram API');
                              }
                           }}
                           className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200"
                        >
                           Найти ID
                        </button>
                     </div>
                     <p className="text-[10px] text-slate-400 mt-1">ID чата или группы, куда бот будет слать уведомления. Добавьте бота в группу и сделайте админом.</p>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Типы уведомлений</p>
                     
                     {[
                        { key: 'notifyOnShiftStart', label: 'Начало смены' },
                        { key: 'notifyOnShiftEnd', label: 'Конец смены' },
                        { key: 'notifyOnLimitExceeded', label: 'Превышение лимита (более 15 минут)' }
                     ].map(pref => (
                        <div key={pref.key} className="flex items-center justify-between">
                           <span className="text-xs font-bold text-slate-700">{pref.label}</span>
                           <label className="relative inline-flex items-center cursor-pointer scale-75">
                              <input 
                                 type="checkbox" 
                                 className="sr-only peer"
                                 checked={(currentOrg.telegramSettings as any)?.[pref.key] ?? true}
                                 onChange={(e) => {
                                    const newSettings = { 
                                       ...currentOrg.telegramSettings!, 
                                       [pref.key]: e.target.checked 
                                    };
                                    onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                                    db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                                 }}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                           </label>
                        </div>
                     ))}
                  </div>

                  <div>
                     <button 
                        onClick={async () => {
                           if (!currentOrg.telegramSettings?.botToken || !currentOrg.telegramSettings?.chatId) {
                              alert('Заполните все поля');
                              return;
                           }
                           try {
                              const res = await fetch(`https://api.telegram.org/bot${currentOrg.telegramSettings.botToken}/sendMessage`, {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                    chat_id: currentOrg.telegramSettings.chatId,
                                    text: '🔔 Тестовое уведомление от WorkTracker Pro'
                                 })
                              });
                              const data = await res.json();
                              if (data.ok) {
                                 alert('Сообщение отправлено!');
                              } else {
                                 alert('Ошибка отправки: ' + data.description);
                              }
                           } catch (e) {
                              alert('Ошибка сети');
                           }
                        }}
                        className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        Отправить тестовое сообщение
                     </button>
                  </div>
               </div>
            )}
         </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Оборудование</h3>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMachineLimitReached ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
               {machines.length} / {planLimits.maxMachines}
            </span>
          </div>
          
          <div className="flex gap-2 mb-6">
            <input 
               disabled={isMachineLimitReached}
               type="text" 
               value={newMachineName} 
               onChange={e => setNewMachineName(e.target.value)} 
               placeholder={isMachineLimitReached ? "Лимит тарифа исчерпан" : "Название станка"} 
               className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all disabled:bg-slate-50" 
            />
            {branches.length > 0 && setNewMachineBranchId && (
              <select
                disabled={isMachineLimitReached}
                value={newMachineBranchId}
                onChange={e => setNewMachineBranchId(e.target.value)}
                className="border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-blue-500 transition-all disabled:bg-slate-50"
              >
                <option value="">Без филиала</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button 
              disabled={isMachineLimitReached}
              onClick={() => {
                if (newMachineName.trim()) {
                  handleUpdateMachinesList([...machines, { id: 'm' + Date.now(), name: newMachineName, branchId: newMachineBranchId }]);
                  setNewMachineName('');
                  if (setNewMachineBranchId) setNewMachineBranchId('');
                }
              }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase disabled:bg-slate-300">Добавить</button>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {machines.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all">
                {editingMachineId === m.id ? (
                  <div className="flex-1 flex gap-2">
                     <input 
                       autoFocus 
                       className="flex-1 border-2 border-blue-200 rounded-xl px-3 py-1 text-sm outline-none" 
                       value={editValue} 
                       onChange={e => setEditValue(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && saveMachineEdit(m.id)}
                     />
                     {branches.length > 0 && setEditingMachineBranchId && (
                       <select
                         value={editingMachineBranchId || ''}
                         onChange={e => setEditingMachineBranchId(e.target.value || undefined)}
                         className="border-2 border-blue-200 rounded-xl px-2 py-1 text-xs font-bold bg-white outline-none"
                       >
                         <option value="">Без филиала</option>
                         {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                       </select>
                     )}
                     <button onClick={() => saveMachineEdit(m.id)} className="text-green-600 font-black px-2">OK</button>
                     <button onClick={() => setEditingMachineId(null)} className="text-slate-400 font-black px-2">X</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{m.name}</span>
                      {m.branchId && branches.find(b => b.id === m.branchId) && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-full border border-slate-200">
                          {branches.find(b => b.id === m.branchId)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setEditingMachineId(m.id); setEditValue(m.name); if (setEditingMachineBranchId) setEditingMachineBranchId(m.branchId); }} className="text-slate-300 hover:text-blue-500">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       </button>
                       <button onClick={() => { if(confirm('Удалить?')) handleUpdateMachinesList(machines.filter(x => x.id !== m.id)); }} className="text-slate-300 hover:text-red-500">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Должности и Функции</h3>
          <div className="flex gap-2 mb-6">
            <input type="text" value={newPositionName} onChange={e => setNewPositionName(e.target.value)} placeholder="Новая роль" className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all" />
            <button onClick={() => {
              if (newPositionName.trim()) {
                if (positions.some(p => p.name.toLowerCase() === newPositionName.trim().toLowerCase())) {
                  alert('Такая должность уже существует');
                  return;
                }
                onUpdatePositions([...positions, { name: newPositionName.trim(), permissions: DEFAULT_PERMISSIONS }]);
                setNewPositionName('');
              }
            }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase">Добавить</button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {positions.map(p => (
              <div key={p.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all group">
                {editingPositionName === p.name ? (
                  <div className="flex-1 flex gap-2">
                     <input 
                       autoFocus 
                       className="flex-1 border-2 border-blue-200 rounded-xl px-3 py-1 text-sm outline-none" 
                       value={editValue} 
                       onChange={e => setEditValue(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && savePositionEdit(p.name)}
                     />
                     <button onClick={() => savePositionEdit(p.name)} className="text-green-600 font-black px-2">OK</button>
                     <button onClick={() => setEditingPositionName(null)} className="text-slate-400 font-black px-2">X</button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                       <span className={`text-sm font-bold ${p.name === FIXED_POSITION_TURNER ? 'text-blue-600' : 'text-slate-700'}`}>{p.name}</span>
                    </div>
                    <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                       <button 
                         onClick={() => setConfiguringPosition(p)} 
                         className="p-2 text-slate-500 hover:text-blue-600"
                         title="Конструктор функций"
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                       </button>
                       {p.name !== FIXED_POSITION_TURNER && (
                         <>
                           <button onClick={() => { setEditingPositionName(p.name); setEditValue(p.name); }} className="p-2 text-slate-300 hover:text-blue-500">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           </button>
                           <button onClick={() => { if(confirm('Удалить должность?')) onUpdatePositions(positions.filter(x => x.name !== p.name)); }} className="text-slate-300 hover:text-red-500">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         </>
                       )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Файлы и Бэкап</h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">Система хранит данные в облаке Supabase и локально. Рекомендуется периодически экспортировать данные.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleExportAll} className="flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-3xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 uppercase text-xs tracking-widest">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Экспорт (JSON)
          </button>
          <label className="flex items-center justify-center gap-3 py-5 bg-blue-600 text-white rounded-3xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase text-xs tracking-widest cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Импорт (JSON)
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </section>
    </div>
  );
};
