import React from 'react';
import { WorkLog, User, Machine, EntryType } from '../../types';
import { format } from 'date-fns';

interface LogEditModalProps {
  editingLog: { userId: string; date: string };
  setEditingLog: (log: { userId: string; date: string } | null) => void;
  logs: WorkLog[];
  users: User[];
  machines: Machine[];
  deleteLogItem: (id: string) => void;
  setPreviewPhoto: (photo: string | null) => void;
  formatTime: (dateStr: string) => string;
  saveCorrection: (id: string, durationMinutes: number, fine?: number) => void;
  tempNotes: Record<string, string>;
  setTempNotes: (notes: Record<string, string>) => void;
}

export const LogEditModal: React.FC<LogEditModalProps> = ({
  editingLog,
  setEditingLog,
  logs,
  users,
  machines,
  deleteLogItem,
  setPreviewPhoto,
  formatTime,
  saveCorrection,
  tempNotes,
  setTempNotes
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
               <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">Корректировка данных</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editingLog.date} — {users.find(u => u.id === editingLog.userId)?.name}</p>
            </div>
            <button onClick={() => { setEditingLog(null); setTempNotes({}); }} className="text-slate-400 hover:text-slate-900 text-3xl font-light transition-colors">&times;</button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30">
            {logs.filter(l => l.userId === editingLog.userId && l.date === editingLog.date).map(log => (
              <div key={log.id} className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-5 space-y-4 relative group">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                   <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border flex items-center gap-1 ${log.entryType === EntryType.WORK ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                         {log.isNightShift && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                         {log.entryType === EntryType.WORK ? (machines.find(m => m.id === log.machineId)?.name || 'Работа') : 'Пропуск'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">ID: {log.id.slice(0,6)}</span>
                   </div>
                   <button 
                    onClick={() => deleteLogItem(log.id)} 
                    className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                    title="Удалить запись"
                   >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div className="flex gap-3 h-28">
                         <div className="flex-1 flex flex-col gap-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase text-center">Начало работы</span>
                            {log.photoIn ? (
                               <div 
                                className="flex-1 rounded-xl border border-slate-100 overflow-hidden cursor-zoom-in group/photo relative"
                                onClick={() => setPreviewPhoto(log.photoIn!)}
                               >
                                  <img src={log.photoIn} className="w-full h-full object-cover grayscale-[0.2] group-hover/photo:grayscale-0 group-hover/photo:scale-110 transition-all duration-300" />
                                  <div className="absolute inset-0 bg-slate-900/0 group-hover/photo:bg-slate-900/20 transition-all flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                  </div>
                               </div>
                            ) : (
                               <div className="flex-1 rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center bg-slate-50">
                                  <span className="text-[10px] text-slate-300 font-bold">Нет фото</span>
                               </div>
                            )}
                         </div>
                         <div className="flex-1 flex flex-col gap-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase text-center">Конец работы</span>
                            {log.photoOut ? (
                               <div 
                                className="flex-1 rounded-xl border border-slate-100 overflow-hidden cursor-zoom-in group/photo relative"
                                onClick={() => setPreviewPhoto(log.photoOut!)}
                               >
                                  <img src={log.photoOut} className="w-full h-full object-cover grayscale-[0.2] group-hover/photo:grayscale-0 group-hover/photo:scale-110 transition-all duration-300" />
                                  <div className="absolute inset-0 bg-slate-900/0 group-hover/photo:bg-slate-900/20 transition-all flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                  </div>
                               </div>
                            ) : (
                               <div className="flex-1 rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center bg-slate-50">
                                  <span className="text-[10px] text-slate-300 font-bold">Нет фото</span>
                               </div>
                            )}
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                         <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span>Начало:</span> <span className="text-slate-900 ml-1">{log.checkIn ? formatTime(log.checkIn) : '--:--'}</span>
                         </div>
                         <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span>Конец:</span> <span className="text-slate-900 ml-1">{log.checkOut ? formatTime(log.checkOut) : '--:--'}</span>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Минуты работы</label>
                         <div className="relative">
                            <input 
                              type="number" 
                              defaultValue={log.durationMinutes} 
                              onBlur={(e) => saveCorrection(log.id, parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-black text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase">мин</span>
                         </div>
                      </div>
                      
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Штраф (₽)</label>
                         <input 
                            type="number" 
                            placeholder="0"
                            defaultValue={log.fine || ''} 
                            onBlur={(e) => saveCorrection(log.id, log.durationMinutes, parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-black text-red-600 outline-none focus:border-red-500 focus:bg-white transition-all"
                         />
                      </div>

                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Причина изменений</label>
                         <textarea 
                            placeholder="Опишите причину..."
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all min-h-[64px]"
                            defaultValue={log.correctionNote || ''}
                            onChange={(e) => setTempNotes({ ...tempNotes, [log.id]: e.target.value })}
                            onBlur={() => saveCorrection(log.id, log.durationMinutes)}
                         />
                      </div>
                   </div>
                </div>
                {log.correctionTimestamp && (
                  <div className="text-[7px] text-blue-400 font-black uppercase text-right tracking-widest mt-1 italic">
                    Последнее изменение: {format(new Date(log.correctionTimestamp), 'dd.MM.yyyy HH:mm')}
                  </div>
                )}
              </div>
            ))}
         </div>
         
         <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => { setEditingLog(null); setTempNotes({}); }} 
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
            >
              Завершить редактирование
            </button>
         </div>
      </div>
    </div>
  );
};
