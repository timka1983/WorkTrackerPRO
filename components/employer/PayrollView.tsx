import React from 'react';
import { User, WorkLog, PositionConfig, UserRole } from '../../types';
import { calculateMonthlyPayroll } from '../../utils';

interface PayrollViewProps {
  users: User[];
  logs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
  positions: PositionConfig[];
  filterMonth: string;
  handleExportAll: () => void;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  users,
  logs,
  logsLookup = {},
  positions,
  filterMonth,
  handleExportAll
}) => {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
         <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Расчет зарплаты</h2>
         <button onClick={handleExportAll} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 hover:shadow-blue-200 active:scale-95">Экспорт</button>
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
              <th className="p-4 text-center">Штрафы</th>
              <th className="p-4 text-right">Итого к выплате</th>
            </tr>
          </thead>
          <tbody>
            {users.filter(u => u.role === UserRole.EMPLOYEE).map(emp => {
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
               
               return (
                 <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                   <td className="p-4 font-bold text-slate-900">{emp.name}</td>
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
                   <td className="p-4 text-center text-xs font-mono text-red-600">{payroll.fines > 0 ? payroll.fines : '-'}</td>
                   <td className="p-4 text-right font-black text-slate-900 text-lg">{payroll.totalSalary.toLocaleString('ru-RU')} ₽</td>
                 </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
