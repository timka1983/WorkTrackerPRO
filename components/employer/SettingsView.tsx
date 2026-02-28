import React from 'react';
import { Machine, PositionConfig, PlanLimits, Organization, FIXED_POSITION_TURNER } from '../../types';
import { DEFAULT_PERMISSIONS } from '../../constants';
import { db } from '../../lib/supabase';

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
  handleFileImport
}) => {
  return (
    <div className="space-y-8 no-print">
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
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (часов)</label>
                 <div className="flex items-center gap-4">
                    <input 
                       type="number" 
                       min="0"
                       max="24"
                       value={nightShiftBonusMinutes / 60} 
                       onChange={e => onUpdateNightBonus(parseInt(e.target.value || '0') * 60)}
                       className="w-24 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-blue-600 outline-none focus:border-blue-500 transition-all"
                    />
                    <span className="text-xs text-slate-500 font-medium italic leading-tight">
                       Количество часов, которые будут автоматически прибавлены к табелю, если сотрудник включит режим ночной смены.
                    </span>
                 </div>
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
            <button 
              disabled={isMachineLimitReached}
              onClick={() => {
                if (newMachineName.trim()) {
                  handleUpdateMachinesList([...machines, { id: 'm' + Date.now(), name: newMachineName }]);
                  setNewMachineName('');
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
                     <button onClick={() => saveMachineEdit(m.id)} className="text-green-600 font-black px-2">OK</button>
                     <button onClick={() => setEditingMachineId(null)} className="text-slate-400 font-black px-2">X</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-bold text-slate-700">{m.name}</span>
                    <div className="flex gap-2">
                       <button onClick={() => { setEditingMachineId(m.id); setEditValue(m.name); }} className="text-slate-300 hover:text-blue-500">
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
                onUpdatePositions([...positions, { name: newPositionName, permissions: DEFAULT_PERMISSIONS }]);
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
