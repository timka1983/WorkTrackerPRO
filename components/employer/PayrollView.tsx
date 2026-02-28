import React, { useState } from 'react';
import { User, WorkLog, PositionConfig, UserRole, Machine, EntryType } from '../../types';
import { calculateMonthlyPayroll, formatDurationShort } from '../../utils';
import { format } from 'date-fns';

interface PayrollViewProps {
  users: User[];
  logs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
  positions: PositionConfig[];
  filterMonth: string;
  handleExportAll: () => void;
  machines: Machine[];
  onAddGeneralBonus: (userIds: string[], amount: number, date: string, note: string) => void;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  users,
  logs,
  logsLookup = {},
  positions,
  filterMonth,
  handleExportAll,
  machines,
  onAddGeneralBonus
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusDate, setBonusDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bonusNote, setBonusNote] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const handleBonusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.size === 0 || !bonusAmount || !bonusDate) return;
    onAddGeneralBonus(Array.from(selectedUsers), Number(bonusAmount), bonusDate, bonusNote);
    setShowBonusModal(false);
    setBonusAmount('');
    setBonusNote('');
    setSelectedUsers(new Set());
  };

  const toggleUserSelection = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const employees = users.filter(u => u.role === UserRole.EMPLOYEE);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden relative">
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
         <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Расчет зарплаты</h2>
         <div className="flex gap-3">
           <button onClick={() => setShowBonusModal(true)} className="px-6 py-3 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-200 hover:shadow-green-300 active:scale-95">Общая премия</button>
           <button onClick={handleExportAll} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 hover:shadow-blue-200 active:scale-95">Экспорт</button>
         </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <th className="p-4">Сотрудник</th>
              <th className="p-4">Должность</th>
              <th className="p-4 text-center">Ставка</th>
              <th className="p-4 text-center">Часы (Обыч.)</th>
              <th className="p-4 text-center">Часы (Сверхуроч.)</th>
              <th className="p-4 text-center">Ночные смены</th>
              <th className="p-4 text-center">Больничные</th>
              <th className="p-4 text-center">Премии</th>
              <th className="p-4 text-center">Штрафы</th>
              <th className="p-4 text-right">Итого к выплате</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => {
               const userLogsMap = logsLookup[emp.id] || {};
               const empLogs: WorkLog[] = [];
               Object.keys(userLogsMap).forEach(date => {
                 if (date.startsWith(filterMonth)) {
                   empLogs.push(...userLogsMap[date]);
                 }
               });
               
               const payroll = calculateMonthlyPayroll(emp, empLogs, positions);
               const rate = emp.payroll?.rate ?? (positions.find(p => p.name === emp.position)?.payroll?.rate || 0);
               const type = emp.payroll?.type ?? (positions.find(p => p.name === emp.position)?.payroll?.type || 'hourly');
               
               const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId && l.entryType === EntryType.WORK).map(l => l.machineId!))];
               const isExpanded = expandedRows.has(emp.id);

               return (
                 <React.Fragment key={emp.id}>
                   <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                     <td className="p-4 text-sm font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          {emp.name}
                          {usedMachineIds.length > 0 && (
                            <button 
                              onClick={() => toggleRow(emp.id)}
                              className={`flex-shrink-0 p-1 rounded-md transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'text-blue-500 hover:bg-blue-100'}`}
                            >
                              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          )}
                        </div>
                     </td>
                     <td className="p-4 text-xs font-bold text-slate-500">{emp.position}</td>
                     <td className="p-4 text-center text-xs font-mono text-slate-600">
                        {rate} ₽
                        <span className="text-[8px] text-slate-400 block uppercase">
                          {type === 'hourly' ? '/час' : type === 'fixed' ? '/мес' : '/смена'}
                        </span>
                     </td>
                     <td className="p-4 text-center text-xs font-mono text-slate-600">{payroll.details.regularHours}</td>
                     <td className="p-4 text-center text-xs font-mono text-amber-600">{payroll.details.overtimeHours > 0 ? payroll.details.overtimeHours : '-'}</td>
                     <td className="p-4 text-center text-xs font-mono text-indigo-600">{payroll.details.nightShiftCount > 0 ? payroll.details.nightShiftCount : '-'}</td>
                     <td className="p-4 text-center text-xs font-mono text-teal-600">{payroll.details.sickDays > 0 ? payroll.details.sickDays : '-'}</td>
                     <td className="p-4 text-center text-xs font-mono text-green-600">{payroll.bonuses > 0 ? payroll.bonuses : '-'}</td>
                     <td className="p-4 text-center text-xs font-mono text-red-600">{payroll.fines > 0 ? payroll.fines : '-'}</td>
                     <td className="p-4 text-right font-black text-slate-900 text-sm">{payroll.totalSalary.toLocaleString('ru-RU')} ₽</td>
                   </tr>
                   {isExpanded && usedMachineIds.map(mId => {
                     const machineName = machines.find(m => m.id === mId)?.name || 'Работа';
                     const mLogs = empLogs.filter(l => l.machineId === mId && l.entryType === EntryType.WORK);
                     const mMins = mLogs.reduce((s, l) => s + l.durationMinutes, 0);
                     const mHours = (mMins / 60).toFixed(1);
                     
                     const posConfig = positions.find(p => p.name === emp.position);
                     const config = emp.payroll || posConfig?.payroll;
                     const mRate = config?.machineRates?.[mId] ?? config?.rate ?? 0;
                     const mPay = Math.round((mMins / 60) * mRate);

                     return (
                       <tr key={`${emp.id}-${mId}`} className="bg-slate-50/80 border-b border-slate-100">
                         <td className="p-3 pl-12 text-xs font-bold text-slate-500 italic" colSpan={2}>↳ {machineName}</td>
                         <td className="p-3 text-center text-xs font-mono text-slate-500">{mRate} ₽/час</td>
                         <td className="p-3 text-center text-xs font-mono text-slate-500">{mHours}</td>
                         <td colSpan={5}></td>
                         <td className="p-3 text-right text-xs font-bold text-slate-600">{mPay.toLocaleString('ru-RU')} ₽</td>
                       </tr>
                     );
                   })}
                 </React.Fragment>
               );
            })}
          </tbody>
        </table>
      </div>

      {showBonusModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">Общая премия</h3>
              <button onClick={() => setShowBonusModal(false)} className="text-slate-400 hover:text-slate-900 text-3xl font-light transition-colors">&times;</button>
            </div>
            <form onSubmit={handleBonusSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Сумма премии (₽)</label>
                <input 
                  required
                  type="number" 
                  value={bonusAmount}
                  onChange={e => setBonusAmount(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-green-600 outline-none focus:border-green-500 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Дата</label>
                <input 
                  required
                  type="date" 
                  value={bonusDate}
                  onChange={e => setBonusDate(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Комментарий (необязательно)</label>
                <input 
                  type="text" 
                  value={bonusNote}
                  onChange={e => setBonusNote(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
              
              <div className="space-y-1 pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Сотрудники</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (selectedUsers.size === employees.length) {
                        setSelectedUsers(new Set());
                      } else {
                        setSelectedUsers(new Set(employees.map(e => e.id)));
                      }
                    }}
                    className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                  >
                    {selectedUsers.size === employees.length ? 'Снять выбор' : 'Выбрать всех'}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto bg-slate-50 border-2 border-slate-100 rounded-xl p-2 space-y-1 custom-scrollbar">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.has(emp.id)}
                        onChange={() => toggleUserSelection(emp.id)}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-700">{emp.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={selectedUsers.size === 0 || !bonusAmount || !bonusDate}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-green-200 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                Начислить премию
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
