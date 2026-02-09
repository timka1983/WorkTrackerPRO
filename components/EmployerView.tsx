
import React, { useState, useMemo } from 'react';
import { WorkLog, User, EntryType, UserRole, Machine, FIXED_POSITION_TURNER } from '../types';
import { formatDuration, getDaysInMonthArray, formatDurationShort, exportToCSV, formatTime } from '../utils';
import { format, isAfter } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { subDays } from 'date-fns/subDays';
import { ru } from 'date-fns/locale/ru';

interface EmployerViewProps {
  logs: WorkLog[];
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  machines: Machine[];
  onUpdateMachines: (machines: Machine[]) => void;
  positions: string[];
  onUpdatePositions: (positions: string[]) => void;
  onImportData: (data: string) => void;
  onLogUpdate: (logs: WorkLog[]) => void;
  onDeleteLog: (logId: string) => void;
}

const EmployerView: React.FC<EmployerViewProps> = ({ 
  logs, users, onAddUser, onUpdateUser, onDeleteUser, 
  machines, onUpdateMachines, positions, onUpdatePositions, onImportData, onLogUpdate, onDeleteLog
}) => {
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'matrix' | 'team' | 'analytics' | 'settings'>('analytics');
  const [editingLog, setEditingLog] = useState<{ userId: string; date: string } | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState({ name: '', position: positions[0] || '', department: '', pin: '0000', requirePhoto: false });
  const [newMachineName, setNewMachineName] = useState('');
  const [newPositionName, setNewPositionName] = useState('');

  const employees = users.filter(u => u.role === UserRole.EMPLOYEE);
  const days = getDaysInMonthArray(filterMonth);
  const today = startOfDay(new Date());

  const downloadPDF = () => {
    const element = document.getElementById('employer-matrix-report');
    if (!element) return;
    const opt = {
      margin: 5,
      filename: `timesheet_${filterMonth}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 1.2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    // @ts-ignore
    window.html2pdf().from(element).set(opt).save();
  };

  const dashboardStats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = logs.filter(l => l.date === todayStr);
    
    const activeShifts = todayLogs.filter(l => l.entryType === EntryType.WORK && !l.checkOut);
    const finishedToday = todayLogs.filter(l => l.entryType === EntryType.WORK && l.checkOut);
    
    const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
    const weekLogs = logs.filter(l => last7Days.includes(l.date) && l.entryType === EntryType.WORK);
    const totalWeeklyMinutes = weekLogs.reduce((s, l) => s + l.durationMinutes, 0);
    const avgWeeklyHours = (totalWeeklyMinutes / 60) / 7;

    const monthLogs = logs.filter(l => l.date.startsWith(filterMonth));
    const absenceCounts = employees.map(emp => {
      const absences = monthLogs.filter(l => l.userId === emp.id && (l.entryType === EntryType.SICK || l.entryType === EntryType.VACATION)).length;
      return { name: emp.name, count: absences };
    }).sort((a, b) => b.count - a.count).filter(a => a.count > 0).slice(0, 3);

    return { activeShifts, finishedToday, avgWeeklyHours, absenceCounts };
  }, [logs, employees, filterMonth]);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim()) return;
    const user: User = {
      id: Math.random().toString(36).substring(2, 11),
      name: newUser.name,
      position: newUser.position,
      department: newUser.department,
      pin: newUser.pin,
      role: UserRole.EMPLOYEE,
      requirePhoto: newUser.requirePhoto
    };
    onAddUser(user);
    setNewUser({ name: '', position: positions[0] || '', department: '', pin: '0000', requirePhoto: false });
  };

  const deleteLogItem = (logId: string) => {
    if (confirm('Удалить эту запись безвозвратно?')) {
      onDeleteLog(logId);
    }
  };

  const saveCorrection = (logId: string, val: number) => {
    const note = tempNotes[logId] !== undefined ? tempNotes[logId] : (logs.find(l => l.id === logId)?.correctionNote || '');
    const updated = logs.map(l => {
      if (l.id === logId) {
        return { 
          ...l, 
          durationMinutes: val, 
          isCorrected: true, 
          correctionNote: note,
          correctionTimestamp: new Date().toISOString()
        };
      }
      return l;
    });
    onLogUpdate(updated);
  };

  const toggleUserPhoto = (u: User) => {
    onUpdateUser({ ...u, requirePhoto: !u.requirePhoto });
  };

  const handleUpdateMachinesList = (newMachines: Machine[]) => onUpdateMachines(newMachines);
  const handleUpdatePositionsList = (newPos: string[]) => onUpdatePositions(newPos);

  const handleExportAll = () => {
    const fullData = { logs, users, machines, positions };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (confirm('Внимание! Это действие заменит текущую базу данных. Продолжить?')) {
        onImportData(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Full Size Photo Preview */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-[120] bg-slate-900/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewPhoto(null)}
        >
          <img src={previewPhoto} className="max-w-full max-h-full rounded-2xl shadow-2xl animate-scaleIn" alt="Preview" />
          <button className="absolute top-8 right-8 text-white text-4xl font-light">&times;</button>
        </div>
      )}

      {/* Edit Log Modal */}
      {editingLog && (
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
                          <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">
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
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 gap-4 shadow-sm no-print">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          {['analytics', 'matrix', 'team', 'settings'].map(tab => (
            <button 
              key={tab}
              onClick={() => setViewMode(tab as any)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${viewMode === tab ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {tab === 'analytics' ? 'Дашборд' : tab === 'matrix' ? 'Табель' : tab === 'team' ? 'Команда' : 'Настройки'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
           <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
           <button onClick={downloadPDF} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors" title="Скачать PDF">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </button>
        </div>
      </div>

      {viewMode === 'analytics' && (
        <div className="space-y-8 no-print">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Сейчас в работе</h3>
                   <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                </div>
                <div className="space-y-3">
                   {dashboardStats.activeShifts.length > 0 ? dashboardStats.activeShifts.map(s => {
                      const emp = users.find(u => u.id === s.userId);
                      const machine = machines.find(m => m.id === s.machineId);
                      return (
                        <div key={s.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                           <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">{emp?.name}</span>
                              {machine && (
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter mt-1 flex items-center gap-1">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                  {machine.name}
                                </span>
                              )}
                           </div>
                           <span className="text-[10px] font-black text-blue-600 bg-white px-2 py-0.5 rounded-lg border border-blue-100">{formatTime(s.checkIn)}</span>
                        </div>
                      );
                   }) : <p className="text-xs text-slate-400 italic py-4 text-center">Все отдыхают</p>}
                </div>
             </div>

             <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Смена (Сегодня)</h3>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                   {dashboardStats.finishedToday.length > 0 ? dashboardStats.finishedToday.map(s => {
                      const emp = users.find(u => u.id === s.userId);
                      return (
                        <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">{emp?.name}</span>
                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Начало: {formatTime(s.checkIn)} | Конец: {formatTime(s.checkOut)}</span>
                           </div>
                           <span className="text-[11px] font-black text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200">{formatDurationShort(s.durationMinutes)}</span>
                        </div>
                      );
                   }) : <p className="text-xs text-slate-400 italic py-4 text-center">Нет завершенных смен</p>}
                </div>
             </div>

             <div className="space-y-6">
                <div className="bg-slate-900 p-7 rounded-[2.2rem] text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                      <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                   </div>
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">Средняя выработка (7дн)</h3>
                   <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tabular-nums">{dashboardStats.avgWeeklyHours.toFixed(1)}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase">часов / день</span>
                   </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Топ пропусков</h3>
                   <div className="space-y-4">
                      {dashboardStats.absenceCounts.length > 0 ? dashboardStats.absenceCounts.map((a, i) => (
                        <div key={i} className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black text-xs">{i+1}</div>
                           <div className="flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{a.name}</p>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                 <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min((a.count / 10) * 100, 100)}%` }}></div>
                              </div>
                           </div>
                           <span className="text-[10px] font-black text-slate-400 tabular-nums">{a.count} дн.</span>
                        </div>
                      )) : <p className="text-xs text-slate-400 italic text-center py-4">Без пропусков в этом месяце</p>}
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {viewMode === 'matrix' && (
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden" id="employer-matrix-report">
          <div className="hidden print:block p-8 text-center border-b border-slate-900 print-monochrome">
             <h1 className="text-3xl font-black uppercase tracking-tighter">Сводный Табель ({filterMonth})</h1>
          </div>
          <div className="overflow-x-auto print-monochrome">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-30 bg-slate-50 px-3 py-4 text-left text-[10px] font-bold text-slate-600 uppercase border-r w-[140px] min-w-[140px] max-w-[140px]">Сотрудник / Ресурс</th>
                  {days.map(day => (
                    <th key={day.toString()} className={`px-0.5 py-2 text-center text-[9px] font-bold border-r min-w-[32px] ${[0, 6].includes(day.getDay()) ? 'bg-red-50/50 text-red-600' : 'text-slate-500'}`}>
                      <div className="flex flex-col items-center">
                        <span>{format(day, 'd')}</span>
                        <span className="text-[7px] uppercase opacity-60 font-medium">{format(day, 'eeeeee', { locale: ru })}</span>
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 bg-slate-50 px-4 py-4 text-center text-[10px] font-bold text-slate-600 uppercase border-l">ИТОГО</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const empLogs = logs.filter(l => l.userId === emp.id && l.date.startsWith(filterMonth));
                  const totalMinutes = empLogs.filter(l => l.checkOut || l.entryType !== EntryType.WORK).reduce((s, l) => s + l.durationMinutes, 0);
                  const isTurner = emp.position === FIXED_POSITION_TURNER;
                  const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId).map(l => l.machineId!))];

                  return (
                    <React.Fragment key={emp.id}>
                      <tr className="border-b border-slate-200 group bg-slate-50/30">
                        <td className="sticky left-0 z-10 bg-white border-r px-3 py-3 font-black text-slate-900 text-[11px] truncate w-[140px] min-w-[140px] max-w-[140px]">
                          {emp.name}
                          <div className="text-[8px] text-blue-600 font-black uppercase mt-0.5">{emp.position}</div>
                        </td>
                        {days.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-12"></td>;

                          const dayLogs = empLogs.filter(l => l.date === dateStr);
                          const workMins = dayLogs.filter(l => l.entryType === EntryType.WORK).reduce((s, l) => s + l.durationMinutes, 0);
                          const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
                          const anyCorrected = dayLogs.some(l => l.isCorrected);
                          
                          let content: React.ReactNode = null;
                          if (absence) {
                             content = <span className="font-black text-blue-600">{absence.entryType === EntryType.SICK ? 'Б' : absence.entryType === EntryType.VACATION ? 'О' : 'В'}{anyCorrected && '*'}</span>;
                          } else if (workMins > 0) {
                             const isPending = dayLogs.some(l => l.entryType === EntryType.WORK && !l.checkOut);
                             content = <span className={`text-[11px] font-black ${isPending ? 'text-blue-500 italic' : 'text-slate-900'}`}>{formatDurationShort(workMins)}{(isPending || anyCorrected) && '*'}</span>;
                          } else {
                             content = <span className="text-[10px] font-bold text-slate-300">В</span>;
                          }

                          return (
                            <td key={dateStr} onClick={() => setEditingLog({ userId: emp.id, date: dateStr })} className="border-r p-1 text-center h-12 tabular-nums cursor-pointer hover:bg-blue-50 transition-colors">
                              {content}
                            </td>
                          );
                        })}
                        <td className="sticky right-0 z-10 px-4 py-3 text-center font-black text-slate-900 text-xs bg-slate-50 border-l border-slate-300">{formatDuration(totalMinutes)}</td>
                      </tr>

                      {isTurner && usedMachineIds.map(mId => {
                         const machineName = machines.find(m => m.id === mId)?.name || 'Работа';
                         const mMinutes = empLogs.filter(l => l.machineId === mId).reduce((s, l) => s + l.durationMinutes, 0);
                         return (
                           <tr key={`${emp.id}-${mId}`} className="border-b border-slate-100 bg-white/50 text-slate-500">
                             <td className="sticky left-0 z-10 bg-white border-r px-4 py-2 font-bold text-[9px] uppercase italic text-slate-400 truncate w-[140px] min-w-[140px] max-w-[140px]">
                                ↳ {machineName}
                             </td>
                             {days.map(day => {
                               const dateStr = format(day, 'yyyy-MM-dd');
                               if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-10"></td>;
                               const machineLogs = empLogs.filter(l => l.date === dateStr && l.machineId === mId);
                               const minsOnMachine = machineLogs.reduce((s, l) => s + l.durationMinutes, 0);
                               const isCorrectedOnMachine = machineLogs.some(l => l.isCorrected);
                               return (
                                 <td key={dateStr} className="border-r p-1 text-center h-10 tabular-nums text-[10px] font-medium italic">
                                   {minsOnMachine > 0 ? (formatDurationShort(minsOnMachine) + (isCorrectedOnMachine ? '*' : '')) : '-'}
                                 </td>
                               );
                             })}
                             <td className="sticky right-0 z-10 px-4 py-2 text-center font-bold text-[10px] italic text-slate-400 bg-slate-50 border-l border-slate-200">{formatDurationShort(mMinutes)}</td>
                           </tr>
                         );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {viewMode === 'team' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24">
              <h3 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Новый сотрудник</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="ФИО сотрудника" className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
                <select value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white">
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="text" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/[^0-9]/g, '')})} placeholder="PIN (0000)" className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono" />
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                   <input type="checkbox" checked={newUser.requirePhoto} onChange={e => setNewUser({...newUser, requirePhoto: e.target.checked})} className="w-5 h-5 rounded accent-blue-600" id="req-photo" />
                   <label htmlFor="req-photo" className="text-xs font-black text-slate-600 uppercase cursor-pointer">Обязательное фото</label>
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest">Создать</button>
              </form>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
             {users.map(u => (
               <div key={u.id} className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center justify-between group shadow-sm transition-all hover:border-blue-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xl">{u.name.charAt(0)}</div>
                    <div>
                      <h4 className="font-bold text-slate-900">{u.name}</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">{u.position}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                       <label className="text-[8px] font-black text-slate-400 uppercase mb-1">PIN-код</label>
                       <input 
                         type="text" 
                         maxLength={4} 
                         value={u.pin} 
                         onChange={e => onUpdateUser({ ...u, pin: e.target.value.replace(/[^0-9]/g, '') })}
                         className="w-20 border-2 border-slate-100 rounded-xl px-3 py-1.5 text-xs font-mono font-black text-center text-blue-600 focus:border-blue-500 outline-none bg-slate-50" 
                       />
                    </div>
                    <button 
                      onClick={() => toggleUserPhoto(u)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${u.requirePhoto ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      {u.requirePhoto ? '📷 ФОТО ВКЛ' : '📷 ФОТО ВЫКЛ'}
                    </button>
                    {u.id !== 'admin' && (
                      <button onClick={() => { if(confirm(`Удалить ${u.name}?`)) onDeleteUser(u.id); }} className="p-3 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-2xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
               </div>
             ))}
          </div>
        </section>
      )}

      {viewMode === 'settings' && (
        <div className="space-y-8 no-print">
          <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8">Файлы и Бэкап</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">Система хранит данные в облаке Supabase и локально. Рекомендуется экспортировать JSON файл для бэкапа.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6 underline decoration-blue-500 decoration-4 underline-offset-8">Оборудование</h3>
              <div className="flex gap-2 mb-6">
                <input type="text" value={newMachineName} onChange={e => setNewMachineName(e.target.value)} placeholder="Название станка" className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all" />
                <button onClick={() => {
                  if (newMachineName.trim()) {
                    handleUpdateMachinesList([...machines, { id: 'm' + Date.now(), name: newMachineName }]);
                    setNewMachineName('');
                  }
                }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase">Добавить</button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {machines.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all">
                    <span className="text-sm font-bold text-slate-700">{m.name}</span>
                    <button onClick={() => { if(confirm('Удалить?')) handleUpdateMachinesList(machines.filter(x => x.id !== m.id)); }} className="text-slate-300 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6 underline decoration-blue-500 decoration-4 underline-offset-8">Должности</h3>
              <div className="flex gap-2 mb-6">
                <input type="text" value={newPositionName} onChange={e => setNewPositionName(e.target.value)} placeholder="Новая роль" className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all" />
                <button onClick={() => {
                  if (newPositionName.trim()) {
                    handleUpdatePositionsList([...positions, newPositionName]);
                    setNewPositionName('');
                  }
                }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase">Добавить</button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {positions.map(p => (
                  <div key={p} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all">
                    <span className={`text-sm font-bold ${p === FIXED_POSITION_TURNER ? 'text-blue-600' : 'text-slate-700'}`}>{p}</span>
                    {p !== FIXED_POSITION_TURNER && (
                      <button onClick={() => { if(confirm('Удалить?')) handleUpdatePositionsList(positions.filter(x => x !== p)); }} className="text-slate-300 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerView;
