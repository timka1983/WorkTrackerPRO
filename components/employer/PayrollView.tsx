import React, { useState, useEffect } from 'react';
import { User, WorkLog, PositionConfig, UserRole, Machine, EntryType, Branch, Organization, PayrollSnapshot, PayrollPayment, PaymentType, PlanLimits, PayrollPeriod, PayrollStatus } from '../../types';
import { calculateMonthlyPayroll, getEffectivePayrollConfig, formatDurationShort, calculateMinutes } from '../../utils';
import { format } from 'date-fns';
import { ScheduleModal } from '../employee/ScheduleModal';
import { generatePayslipPDF } from '../../utils/pdfGenerator';
import { ChevronDown, ChevronUp, RefreshCw, Save, CheckCircle2, Plus, Trash2, Wallet, Coins, Calendar, FileText, History } from 'lucide-react';
import { db } from '../../lib/supabase';
import { DEFAULT_PAYROLL_CONFIG } from '../../constants';

interface PayrollViewProps {
  users: User[];
  onUpdateUser: (user: User) => void;
  logs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
  positions: PositionConfig[];
  filterMonth: string;
  setFilterMonth: (month: string) => void;
  handleExportAll: () => void;
  machines: Machine[];
  onAddGeneralBonus: (userIds: string[], amount: number, date: string, note: string) => void;
  branches: Branch[];
  currentOrg?: Organization | null;
  payments: PayrollPayment[];
  onSavePayment: (payment: PayrollPayment) => void;
  onDeletePayment: (id: string) => void;
  onLogsUpsert: (logs: WorkLog[]) => void;
  onRecalculate: () => void;
  isRecalculating: boolean;
  planLimits: PlanLimits;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  users,
  onUpdateUser,
  logs,
  logsLookup = {},
  positions,
  filterMonth,
  setFilterMonth,
  handleExportAll,
  machines,
  onAddGeneralBonus,
  branches,
  currentOrg,
  payments,
  onSavePayment,
  onDeletePayment,
  onLogsUpsert,
  onRecalculate,
  isRecalculating,
  planLimits
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.ADVANCE);
  const [paymentComment, setPaymentComment] = useState('');
  const [selectedUserForPayment, setSelectedUserForPayment] = useState<User | null>(null);
  const [selectedUserForPaymentHistory, setSelectedUserForPaymentHistory] = useState<User | null>(null);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusDate, setBonusDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bonusNote, setBonusNote] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const [selectedUserForSchedule, setSelectedUserForSchedule] = useState<User | null>(null);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null); // New state

  const [snapshots, setSnapshots] = useState<PayrollSnapshot[]>([]);
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const fetchData = async () => {
    if (!currentOrg) return;
    const [data, periodData] = await Promise.all([
      db.getPayrollSnapshots(currentOrg.id, filterMonth),
      db.getPayrollPeriod(currentOrg.id, filterMonth)
    ]);
    setSnapshots(data);
    setPayrollPeriod(periodData);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrg, filterMonth]);

  const employees = users.filter(u => {
    if (u.role !== UserRole.EMPLOYEE) return false;
    
    const periodStartDate = `${filterMonth}-01`;
    const periodEndDate = `${filterMonth}-31`;
    
    // If created after the period ends, they shouldn't be here
    if (u.createdAt && u.createdAt > periodEndDate) return false;
    
    // If archived before the period starts, they shouldn't be here
    if (u.isArchived && u.archivedAt && u.archivedAt < periodStartDate) return false;
    
    return true;
  });

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const toggleAllRows = () => {
    if (expandedRows.size > 0) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(employees.map(e => e.id)));
    }
  };

  const formatMinsToHHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}.${m.toString().padStart(2, '0')}`;
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

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planLimits.features.payments) {
      alert('Модуль авансов и выплат доступен только в тарифе BUSINESS.');
      return;
    }
    if (!selectedUserForPayment || !paymentAmount || !paymentDate || !currentOrg) return;
    
    const payment: PayrollPayment = {
      id: crypto.randomUUID(),
      userId: selectedUserForPayment.id,
      organizationId: currentOrg.id,
      amount: Number(paymentAmount),
      date: paymentDate,
      type: paymentType,
      comment: paymentComment,
      createdAt: new Date().toISOString()
    };
    
    onSavePayment(payment);
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentComment('');
  };

  const handleRecalculate = async () => {
    await onRecalculate();
    await fetchData();
  };

  const toggleUserSelection = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const isPaid = payrollPeriod?.status === PayrollStatus.PAID;

  const handleStatusChange = async (newStatus: PayrollStatus) => {
    if (!currentOrg) return;
    if (newStatus === PayrollStatus.PAID) {
      if (!confirm('Вы уверены, что хотите закрыть финансовый период? После этого данные будут заблокированы для изменений.')) {
        return;
      }
    }
    setIsChangingStatus(true);
    try {
      const period: PayrollPeriod = {
        id: `${currentOrg.id}-${filterMonth}`,
        organizationId: currentOrg.id,
        month: filterMonth,
        status: newStatus,
        closedAt: newStatus === PayrollStatus.PAID ? new Date().toISOString() : undefined,
        closedBy: newStatus === PayrollStatus.PAID ? 'admin' : undefined
      };
      await db.savePayrollPeriod(period);
      setPayrollPeriod(period);
    } catch (e) {
      console.error(e);
      alert('Ошибка при изменении статуса');
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl dark:shadow-slate-900/20 border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 flex-wrap gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Расчет зарплаты</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest">Отчетный период: {filterMonth}</p>
            </div>
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 mt-2">
              <button 
                onClick={() => handleStatusChange(PayrollStatus.DRAFT)}
                disabled={isChangingStatus || isPaid}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${(!payrollPeriod || payrollPeriod.status === PayrollStatus.DRAFT) ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'} ${isPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Черновик
              </button>
              <button 
                onClick={() => handleStatusChange(PayrollStatus.APPROVED)}
                disabled={isChangingStatus || isPaid}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${payrollPeriod?.status === PayrollStatus.APPROVED ? 'bg-blue-600 text-white' : 'text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'} ${isPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Утверждено
              </button>
              <button 
                onClick={() => handleStatusChange(PayrollStatus.PAID)}
                disabled={isChangingStatus || isPaid}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${payrollPeriod?.status === PayrollStatus.PAID ? 'bg-green-600 text-white' : 'text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'} ${isPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Оплачено
              </button>
            </div>
          </div>
         <div className="flex gap-3">
           <button 
             onClick={handleRecalculate} 
             disabled={isRecalculating || isPaid}
             className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl dark:shadow-slate-900/20 shadow-indigo-100 dark:shadow-none hover:shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
             Пересчитать табель
           </button>
           <button onClick={() => setShowBonusModal(true)} disabled={isPaid} className="px-3 py-3 md:px-6 md:py-3 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-xl dark:shadow-slate-900/20 shadow-green-200 dark:shadow-none hover:shadow-green-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            <span className="hidden md:inline">Общая премия</span>
            <Coins className="w-5 h-5 md:hidden" />
          </button>
          <button onClick={handleExportAll} className="px-3 py-3 md:px-6 md:py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl dark:shadow-slate-900/20 shadow-slate-200 dark:shadow-none hover:shadow-blue-200 active:scale-95">
            <span className="hidden md:inline">Экспорт</span>
            <FileText className="w-5 h-5 md:hidden" />
          </button>
         </div>
      </div>
      
      {selectedUserForSchedule && (
        <ScheduleModal
          isOpen={!!selectedUserForSchedule}
          onClose={() => setSelectedUserForSchedule(null)}
          user={selectedUserForSchedule}
          onUpdateUser={onUpdateUser}
          currentMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          readOnly={true}
          logsLookup={logsLookup}
        />
      )}

      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">
                <div className="flex items-center gap-2">
                  <span>Сотрудник</span>
                  <button 
                    onClick={toggleAllRows}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400"
                    title={expandedRows.size > 0 ? "Свернуть все" : "Раскрыть все"}
                  >
                    {expandedRows.size > 0 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </th>
              <th className="p-4">Должность</th>
              <th className="p-4 text-center w-16"></th>
              <th className="p-4 text-center">Ставка</th>
              <th className="p-4 text-center">Часы</th>
              <th className="p-4 text-center">Часы (Сверхуроч.)</th>
              <th className="p-4 text-center">Ночные смены</th>
              <th className="p-4 text-center">Больничные</th>
              <th className="p-4 text-center">Премии</th>
              <th className="p-4 text-center">Штрафы</th>
              {planLimits.features.payments && <th className="p-4 text-center">Выплаты</th>}
              <th className="p-4 text-center">Итого часов</th>
              <th className="p-4 text-right">Начислено</th>
              {planLimits.features.payments && <th className="p-4 text-right">К выплате</th>}
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
               
               const snapshot = snapshots.find(s => s.userId === emp.id);
               const payroll = snapshot ? snapshot.details : calculateMonthlyPayroll(emp, empLogs, positions, currentOrg || undefined);
               const effectiveConfig = getEffectivePayrollConfig(emp, positions);
               const rate = snapshot ? snapshot.rateUsed : effectiveConfig.rate;
               const type = snapshot ? snapshot.rateType : effectiveConfig.type;
               
               const userPayments = payments.filter(p => p.userId === emp.id && p.date.startsWith(filterMonth));
               const totalPaid = userPayments.reduce((sum, p) => sum + p.amount, 0);
               const balance = payroll.totalSalary - totalPaid;

               const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId && l.entryType === EntryType.WORK).map(l => l.machineId!))];
               const hasSubRows = usedMachineIds.length > 0 || userPayments.length > 0;
               const isExpanded = expandedRows.has(emp.id);

               return (
                 <React.Fragment key={emp.id}>
                   <tr className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${snapshot ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}>
                     <td className="p-4 text-sm font-bold text-slate-900 dark:text-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => setSelectedUserForSchedule(emp)}>
                            <div className="flex items-center gap-1">
                              <span>{emp.name}</span>
                              {emp.isArchived && <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full ml-1">Архив</span>}
                              {snapshot && (
                                <span title={`Сохранено: ${format(new Date(snapshot.calculatedAt), 'dd.MM HH:mm')}`}>
                                  <CheckCircle2 size={12} className="text-indigo-500" />
                                </span>
                              )}
                            </div>
                            {emp.branchId && branches.find(b => b.id === emp.branchId) && (
                              <span className="text-[8px] text-slate-400 font-black uppercase tracking-tighter">
                                {branches.find(b => b.id === emp.branchId)?.name}
                              </span>
                            )}
                          </div>
                          {hasSubRows && (
                            <button 
                              onClick={() => toggleRow(emp.id)}
                              className={`flex-shrink-0 p-1 rounded-md transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/20'}`}
                            >
                              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          )}
                        </div>
                     </td>
                     <td className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400">{emp.position}</td>
                     <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => {
                              if (!planLimits.features.payments) {
                                alert('Модуль авансов и выплат доступен только в тарифе BUSINESS.');
                                return;
                              }
                              setSelectedUserForPayment(emp); 
                              setShowPaymentModal(true); 
                            }}
                            disabled={isPaid}
                            className={`p-2 rounded-xl transition-all ${planLimits.features.payments ? 'text-indigo-400 hover:text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} ${isPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={isPaid ? "Финансовый период закрыт" : planLimits.features.payments ? "Внести выплату" : "Внести выплату (Требуется тариф BUSINESS)"}
                          >
                            <Coins size={18} />
                          </button>
                          <button 
                            onClick={() => setSelectedUserForPaymentHistory(emp)}
                            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                            title="История выплат"
                          >
                            <History size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              const userPayments = payments.filter(p => p.userId === emp.id && p.date.startsWith(filterMonth));
                              generatePayslipPDF(emp, payroll, filterMonth, userPayments, machines);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            title="Скачать расчетный листок"
                          >
                            <FileText size={18} />
                          </button>
                        </div>
                      </td>
                     <td className="p-4 text-center text-xs font-mono text-slate-600 dark:text-slate-300">
                        {rate} ₽
                        <span className="text-[8px] text-slate-400 dark:text-slate-400 block uppercase">
                          {type === 'hourly' ? '/час' : type === 'fixed' ? '/мес' : '/смена'}
                        </span>
                     </td>
                      <td className="p-4 text-center text-xs font-mono text-slate-600 dark:text-slate-300">
                        {formatMinsToHHMM(empLogs.filter(l => !l.machineId && l.entryType === EntryType.WORK).reduce((sum, l) => sum + l.durationMinutes, 0))}
                      </td>
                      <td className="p-4 text-center text-xs font-mono text-amber-600 dark:text-amber-400">{payroll.details.overtimeHours > 0 ? payroll.details.overtimeHours.toFixed(2) : '-'}</td>
                      <td className="p-4 text-center text-xs font-mono text-indigo-600 dark:text-indigo-400">{payroll.details.nightShiftCount > 0 ? payroll.details.nightShiftCount : '-'}</td>
                      <td className="p-4 text-center text-xs font-mono text-teal-600 dark:text-teal-400">{payroll.details.sickDays > 0 ? payroll.details.sickDays : '-'}</td>
                      <td className="p-4 text-center text-xs font-mono text-green-600 dark:text-green-400">{payroll.bonuses > 0 ? payroll.bonuses : '-'}</td>
                      <td className="p-4 text-center text-xs font-mono text-red-600 dark:text-red-400">{payroll.fines > 0 ? payroll.fines : '-'}</td>
                      {planLimits.features.payments && <td className="p-4 text-center text-xs font-mono text-indigo-600 dark:text-indigo-400">{totalPaid > 0 ? totalPaid : '-'}</td>}
                      <td className="p-4 text-center text-xs font-mono text-slate-900 dark:text-slate-100 font-bold">
                        {formatMinsToHHMM(empLogs.filter(l => l.entryType === EntryType.WORK).reduce((sum, l) => sum + l.durationMinutes, 0))}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-500 dark:text-slate-400 text-xs">{payroll.totalSalary.toLocaleString('ru-RU')} ₽</td>
                      {planLimits.features.payments && (
                        <td className={`p-4 text-right font-black text-sm ${balance > 0 ? 'text-slate-900 dark:text-slate-100' : balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-400'}`}>
                          {balance.toLocaleString('ru-RU')} ₽
                        </td>
                      )}
                   </tr>
                   {isExpanded && usedMachineIds.map(mId => {
                     const machineName = machines.find(m => m.id === mId)?.name || 'Работа';
                     const mLogs = empLogs.filter(l => l.machineId === mId && l.entryType === EntryType.WORK);
                     const mMins = mLogs.reduce((s, l) => s + l.durationMinutes, 0);
                     const mHours = formatMinsToHHMM(mMins);
                     
                     const config = getEffectivePayrollConfig(emp, positions);
                     const mRate = config?.machineRates?.[mId] ?? config?.rate ?? 0;
                     const mPay = Math.round((mMins / 60) * mRate);

                     return (
                        <tr key={`${emp.id}-${mId}`} className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                          <td className="p-3 pl-12 text-xs font-bold text-slate-500 dark:text-slate-400 italic" colSpan={3}>↳ {machineName}</td>
                          <td className="p-3 text-center text-xs font-mono text-slate-500 dark:text-slate-400">{mRate} ₽/час</td>
                          <td className="p-3 text-center text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">{mHours}</td>
                          <td colSpan={planLimits.features.payments ? 6 : 5}></td>
                          <td className="p-3 text-center text-xs font-mono text-slate-300 dark:text-slate-600">-</td>
                          <td className="p-3 text-right text-xs font-bold text-slate-600 dark:text-slate-400">{mPay.toLocaleString('ru-RU')} ₽</td>
                          {planLimits.features.payments && <td></td>}
                        </tr>
                     );
                   })}
                   {isExpanded && userPayments.length > 0 && userPayments.map((p, idx) => (
                     <tr key={`${emp.id}-pay-${idx}`} className="bg-indigo-50/30 dark:bg-indigo-900/10 border-b border-slate-100 dark:border-slate-800">
                       <td className="p-3 pl-12 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 italic" colSpan={3}>
                         ↳ {p.type === 'advance' ? 'Аванс' : p.type === 'salary' ? 'Зарплата' : 'Выплата'} ({format(new Date(p.date), 'dd.MM')})
                         {p.comment && <span className="ml-2 font-normal text-slate-400 dark:text-slate-400">({p.comment})</span>}
                       </td>
                       <td colSpan={planLimits.features.payments ? 7 : 6}></td>
                       <td className="p-3 text-right text-[10px] font-bold text-indigo-600 dark:text-indigo-400">-{p.amount.toLocaleString('ru-RU')} ₽</td>
                       {planLimits.features.payments && <td></td>}
                     </tr>
                   ))}
                 </React.Fragment>
               );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden p-4 space-y-4">
        {employees.map(emp => {
           const userLogsMap = logsLookup[emp.id] || {};
           const empLogs: WorkLog[] = [];
           Object.keys(userLogsMap).forEach(date => {
             if (date.startsWith(filterMonth)) {
               empLogs.push(...userLogsMap[date]);
             }
           });
           const snapshot = snapshots.find(s => s.userId === emp.id);
           const payroll = snapshot ? snapshot.details : calculateMonthlyPayroll(emp, empLogs, positions, currentOrg || undefined);
           
           return (
             <div key={emp.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 space-y-3 cursor-pointer" onClick={() => setSelectedUserForDetails(emp)}>
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{emp.name}</span>
                    {emp.isArchived && <span className="flex-shrink-0 text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">Архив</span>}
                  </div>
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{emp.position}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500 dark:text-slate-400">Начислено:</span>
                 <span className="font-bold text-slate-900 dark:text-slate-100">{payroll.totalSalary.toLocaleString('ru-RU')} ₽</span>
               </div>
             </div>
           );
        })}
      </div>

      {selectedUserForDetails && (
        <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl dark:shadow-slate-900/40 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-lg">{selectedUserForDetails.name}</h3>
                {selectedUserForDetails.isArchived && <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">Архив</span>}
              </div>
              <button onClick={() => setSelectedUserForDetails(null)} className="text-slate-400 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 text-3xl font-light transition-colors">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
              {(() => {
                const userLogsMap = logsLookup[selectedUserForDetails.id] || {};
                const empLogs: WorkLog[] = [];
                Object.keys(userLogsMap).forEach(date => {
                  if (date.startsWith(filterMonth)) {
                    empLogs.push(...userLogsMap[date]);
                  }
                });
                const snapshot = snapshots.find(s => s.userId === selectedUserForDetails.id);
                const payroll = snapshot ? snapshot.details : calculateMonthlyPayroll(selectedUserForDetails, empLogs, positions, currentOrg || undefined);
                const effectiveConfig = getEffectivePayrollConfig(selectedUserForDetails, positions);
                const rate = snapshot ? snapshot.rateUsed : effectiveConfig.rate;
                const type = snapshot ? snapshot.rateType : effectiveConfig.type;

                const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId && l.entryType === EntryType.WORK).map(l => l.machineId!))];
                const userPayments = payments.filter(p => p.userId === selectedUserForDetails.id && p.date.startsWith(filterMonth));
                const totalPaid = userPayments.reduce((sum, p) => sum + p.amount, 0);
                const balance = payroll.totalSalary - totalPaid;

                const fields = [
                  { label: 'Должность', value: selectedUserForDetails.position },
                  { label: 'Ставка', value: `${rate} ${type === 'hourly' ? '₽/час' : type === 'fixed' ? '₽/мес' : '₽/смена'}` },
                  { label: 'Часы', value: formatMinsToHHMM(empLogs.filter(l => !l.machineId && l.entryType === EntryType.WORK).reduce((sum, l) => sum + l.durationMinutes, 0)) },
                  { label: 'Сверхурочные', value: payroll.details.overtimeHours > 0 ? payroll.details.overtimeHours.toFixed(2) : '-' },
                  { label: 'Ночные смены', value: payroll.details.nightShiftCount > 0 ? payroll.details.nightShiftCount : '-' },
                  { label: 'Больничные', value: payroll.details.sickDays > 0 ? payroll.details.sickDays : '-' },
                  { label: 'Премии', value: payroll.bonuses > 0 ? payroll.bonuses : '-' },
                  { label: 'Штрафы', value: payroll.fines > 0 ? payroll.fines : '-' },
                  { 
                    label: 'Итого начислено', 
                    value: `${payroll.totalSalary.toLocaleString('ru-RU')} ₽`, 
                    className: 'font-black text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-2 -mx-2 transition-colors text-[10px]',
                    onClick: () => {
                      const el = document.getElementById('payment-history-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                  },
                  { label: 'Выплачено', value: `${totalPaid.toLocaleString('ru-RU')} ₽`, className: 'text-indigo-600 dark:text-indigo-400 text-[10px]' },
                  { label: 'Остаток', value: `${balance.toLocaleString('ru-RU')} ₽`, className: `font-black ${balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}` }
                ];

                const machineBreakdown = usedMachineIds.map(mId => {
                  const machineName = machines.find(m => m.id === mId)?.name || 'Работа';
                  const mLogs = empLogs.filter(l => l.machineId === mId && l.entryType === EntryType.WORK);
                  const mMins = mLogs.reduce((s, l) => s + l.durationMinutes, 0);
                  const config = getEffectivePayrollConfig(selectedUserForDetails, positions);
                  const mRate = config?.machineRates?.[mId] ?? config?.rate ?? 0;
                  return { name: machineName, hours: formatMinsToHHMM(mMins), rate: mRate };
                });

                return (
                  <>
                    {fields.map((f: any, i) => (
                      <React.Fragment key={i}>
                        <div 
                          onClick={f.onClick}
                          className={`flex justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800 ${f.className || ''}`}
                        >
                          <span className="text-slate-500 dark:text-slate-400">{f.label}:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{f.value}</span>
                        </div>
                        {f.label === 'Часы' && machineBreakdown.length > 0 && (
                          <div className="py-1 space-y-1">
                            {machineBreakdown.map((m, idx) => (
                              <div key={idx} className="flex justify-between text-[10px] py-1 pl-4 pr-2 text-slate-400 italic">
                                <span>↳ {m.name} ({m.rate} ₽/ч)</span>
                                <span className="font-bold">{m.hours}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    ))}

                    {userPayments.length > 0 && (
                      <div id="payment-history-section" className="pt-2 space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">История выплат</p>
                        <div className="max-h-24 overflow-y-auto custom-scrollbar pr-1">
                          {userPayments.map((p, idx) => (
                            <div key={idx} className="flex justify-between text-[10px] py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                              <span className="text-slate-500 dark:text-slate-400">{p.type === 'advance' ? 'Аванс' : p.type === 'salary' ? 'Зарплата' : 'Выплата'} ({format(new Date(p.date), 'dd.MM')})</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">-{p.amount} ₽</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={() => {
                        setSelectedUserForSchedule(selectedUserForDetails);
                        setSelectedUserForDetails(null);
                      }}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Табель
                    </button>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => {
                          if (!planLimits.features.payments) {
                            alert('Модуль авансов и выплат доступен только в тарифе BUSINESS.');
                            return;
                          }
                          setSelectedUserForPayment(selectedUserForDetails);
                          setShowPaymentModal(true);
                          // Don't close details modal immediately to avoid focus loss/confusion
                          // setSelectedUserForDetails(null); 
                        }}
                        className="py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all"
                      >
                        + Аванс
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedUsers(new Set([selectedUserForDetails.id]));
                          setShowBonusModal(true);
                          setSelectedUserForDetails(null);
                        }}
                        className="py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-100 dark:hover:bg-green-900/40 transition-all"
                      >
                        + Премия
                      </button>
                    </div>
                    <button 
                      onClick={() => {
                        const userLogsMap = logsLookup[selectedUserForDetails.id] || {};
                        const empLogs: WorkLog[] = [];
                        Object.keys(userLogsMap).forEach(date => {
                          if (date.startsWith(filterMonth)) {
                            empLogs.push(...userLogsMap[date]);
                          }
                        });
                        const snapshot = snapshots.find(s => s.userId === selectedUserForDetails.id);
                        const payroll = snapshot ? snapshot.details : calculateMonthlyPayroll(selectedUserForDetails, empLogs, positions, currentOrg || undefined);
                        const userPayments = payments.filter(p => p.userId === selectedUserForDetails.id && p.date.startsWith(filterMonth));
                        generatePayslipPDF(selectedUserForDetails, payroll, filterMonth, userPayments, machines);
                      }}
                      className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2 mt-3"
                    >
                      <FileText size={14} />
                      Скачать расчетный листок
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showBonusModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl dark:shadow-slate-900/40 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
              <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-lg">Общая премия</h3>
              <button onClick={() => setShowBonusModal(false)} className="text-slate-400 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 text-3xl font-light transition-colors">&times;</button>
            </div>
            <form onSubmit={handleBonusSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Сумма премии (₽)</label>
                <input 
                  required
                  type="number" 
                  value={bonusAmount}
                  onChange={e => setBonusAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-black text-green-600 dark:text-green-400 outline-none focus:border-green-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Дата</label>
                <input 
                  required
                  type="date" 
                  value={bonusDate}
                  onChange={e => setBonusDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Комментарий (необязательно)</label>
                <input 
                  type="text" 
                  value={bonusNote}
                  onChange={e => setBonusNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
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
                    className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase hover:underline"
                  >
                    {selectedUsers.size === employees.length ? 'Снять выбор' : 'Выбрать всех'}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl p-2 space-y-1 custom-scrollbar shadow-sm dark:shadow-none">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.has(emp.id)}
                        onChange={() => toggleUserSelection(emp.id)}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{emp.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={selectedUsers.size === 0 || !bonusAmount || !bonusDate}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl dark:shadow-slate-900/20 shadow-green-200 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                Начислить премию
              </button>
            </form>
          </div>
        </div>
      )}
      {showPaymentModal && selectedUserForPayment && (
        <div className="fixed inset-0 z-[210] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl dark:shadow-slate-900/40 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Wallet size={20} />
                </div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-lg">Внести выплату</h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 text-3xl font-light transition-colors">&times;</button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Сотрудник</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedUserForPayment.name}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Сумма (₽)</label>
                <input 
                  required
                  type="number" 
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Дата</label>
                  <input 
                    required
                    type="date" 
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Тип</label>
                  <select 
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as PaymentType)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
                  >
                    <option value={PaymentType.ADVANCE}>Аванс</option>
                    <option value={PaymentType.SALARY}>Зарплата</option>
                    <option value={PaymentType.BONUS}>Премия</option>
                    <option value={PaymentType.FINE}>Штраф</option>
                    <option value={PaymentType.OTHER}>Прочее</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Комментарий</label>
                <input 
                  type="text" 
                  value={paymentComment}
                  onChange={e => setPaymentComment(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm dark:shadow-none"
                  placeholder="Например: Аванс за март"
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl dark:shadow-slate-900/20 shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 mt-4"
              >
                Сохранить выплату
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedUserForPaymentHistory && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl dark:shadow-slate-900/40 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-lg">История выплат</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest">{selectedUserForPaymentHistory.name} • {filterMonth}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserForPaymentHistory(null)} className="text-slate-400 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 text-3xl font-light transition-colors">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {payments.filter(p => p.userId === selectedUserForPaymentHistory.id && p.date.startsWith(filterMonth)).length > 0 ? (
                <div className="space-y-3">
                  {payments
                    .filter(p => p.userId === selectedUserForPaymentHistory.id && p.date.startsWith(filterMonth))
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                            payment.type === PaymentType.ADVANCE ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                            payment.type === PaymentType.BONUS ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' :
                            payment.type === PaymentType.SALARY ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
                            payment.type === PaymentType.FINE ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {payment.type === PaymentType.ADVANCE ? 'А' :
                             payment.type === PaymentType.BONUS ? 'П' :
                             payment.type === PaymentType.SALARY ? 'З' : 
                             payment.type === PaymentType.FINE ? 'Ш' : '?' }
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                                {payment.type === PaymentType.ADVANCE ? 'Аванс' :
                                 payment.type === PaymentType.BONUS ? 'Премия' :
                                 payment.type === PaymentType.SALARY ? 'Зарплата' : 
                                 payment.type === PaymentType.FINE ? 'Штраф' : 'Выплата'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400">{format(new Date(payment.date), 'dd.MM.yyyy')}</span>
                            </div>
                            {payment.comment && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{payment.comment}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100">{payment.amount.toLocaleString()} ₽</span>
                          <button 
                            onClick={() => {
                              if (isPaid) return;
                              if (confirm('Удалить запись о выплате?')) {
                                onDeletePayment(payment.id);
                              }
                            }}
                            disabled={isPaid}
                            className={`p-2 rounded-xl transition-all ${isPaid ? 'text-slate-200 dark:text-slate-700 cursor-not-allowed' : 'text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100'}`}
                            title={isPaid ? "Финансовый период закрыт" : "Удалить"}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="text-slate-300 dark:text-slate-600" size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest">Выплат не найдено</p>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Всего выплачено</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  {payments
                    .filter(p => p.userId === selectedUserForPaymentHistory.id && p.date.startsWith(filterMonth))
                    .reduce((sum, p) => sum + p.amount, 0)
                    .toLocaleString()} ₽
                </span>
              </div>
              <button 
                onClick={() => setSelectedUserForPaymentHistory(null)}
                className="px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-600 transition-all active:scale-95 shadow-xl dark:shadow-slate-900/20 shadow-slate-200 dark:shadow-none"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
