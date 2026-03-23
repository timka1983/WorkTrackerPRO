import React, { useState } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { format, isAfter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { UserMatrixRowCells } from './UserMatrixRowCells';
import { EntryType, Machine, WorkLog, Branch, Organization, User } from '../../types';
import { formatDurationShort, applyRounding } from '../../utils';
import { EmployeeScheduleModal } from './EmployeeScheduleModal';

interface MatrixViewProps {
  filterMonth: string;
  virtuosoData: any[];
  days: Date[];
  today: Date;
  expandedTurnerRows: Set<string>;
  toggleTurnerRow: (empId: string) => void;
  setEditingLog: (data: { userId: string; date: string }) => void;
  machines: Machine[];
  virtuosoComponents: any;
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
  branches: Branch[];
  currentOrg?: Organization | null;
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  filterMonth,
  virtuosoData,
  days,
  today,
  expandedTurnerRows,
  toggleTurnerRow,
  setEditingLog,
  machines,
  virtuosoComponents,
  logsLookup = {},
  branches,
  currentOrg,
  onRecalculate,
  isRecalculating
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-md dark:shadow-slate-900/20 border border-slate-200 dark:border-slate-800 overflow-hidden h-[700px] flex flex-col" id="employer-matrix-report">
      {selectedEmployee && (
        <EmployeeScheduleModal 
          user={selectedEmployee} 
          onClose={() => setSelectedEmployee(null)} 
          days={days} 
          userLogs={logsLookup[String(selectedEmployee.id).trim()]}
          roundShiftMinutes={currentOrg?.roundShiftMinutes}
        />
      )}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 no-print">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Сводный табель</span>
        </div>
        <button 
          onClick={onRecalculate}
          disabled={isRecalculating}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-md dark:shadow-slate-900/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
          Пересчитать график
        </button>
      </div>

      <div className="hidden print:block p-4 text-center border-b-2 border-slate-900 mb-4">
         <div className="text-xs font-bold uppercase tracking-widest mb-1">{currentOrg?.name}</div>
         <h1 className="text-2xl font-black uppercase tracking-tighter">Табель учета рабочего времени</h1>
         <div className="text-sm font-bold text-slate-600 uppercase tracking-widest mt-1">Отчетный период: {filterMonth}</div>
      </div>
      <div className="flex-1 overflow-auto print-monochrome custom-scrollbar print:overflow-visible print:h-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-40">
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="sticky left-0 z-50 bg-slate-50 dark:bg-slate-800 px-3 py-4 text-left text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase border-r dark:border-slate-700 w-[140px] min-w-[140px] max-w-[140px]">Сотрудник / Ресурс</th>
              {days.map(day => (
                <th key={day.toString()} className={`px-0.5 py-2 text-center text-[10px] font-bold border-r dark:border-slate-700 min-w-[32px] ${[0, 6].includes(day.getDay()) ? 'bg-red-50/50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  <div className="flex flex-col items-center">
                    <span>{format(day, 'd')}</span>
                    <span className="text-[7px] uppercase opacity-60 font-medium">{format(day, 'eeeeee', { locale: ru })}</span>
                  </div>
                </th>
              ))}
              <th className="sticky right-0 z-30 bg-slate-50 dark:bg-slate-800 px-4 py-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase border-l dark:border-slate-700">ИТОГО</th>
            </tr>
          </thead>
          <tbody>
            {virtuosoData.map((row, index) => {
              const rowClassName = row.type === 'employee' 
                ? "border-b border-slate-200 dark:border-slate-800 group bg-slate-50/30 dark:bg-slate-800/30" 
                : "border-b border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/10";

              if (row.type === 'employee') {
                const usedMachineIds = [...new Set(row.empLogs.filter((l: any) => l.machineId).map((l: any) => l.machineId!))];
                const isExpanded = expandedTurnerRows.has(row.emp.id);
                return (
                  <tr key={`emp-${row.emp.id}`} className={rowClassName}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r dark:border-slate-800 px-3 py-3 font-black text-slate-900 dark:text-slate-100 text-[13px] w-[140px] min-w-[140px] max-w-[140px]">
                      <div className="flex items-center justify-between group/name overflow-hidden">
                        <div className="flex items-center min-w-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setSelectedEmployee(row.emp)}>
                          <div className="flex flex-col leading-tight min-w-0">
                            <span className="truncate print:whitespace-normal">{row.emp.name.split(' ')[0]}</span>
                            {row.emp.name.split(' ').length > 1 && (
                              <span className="truncate print:whitespace-normal text-[11px] font-normal opacity-70 mt-0.5">
                                {row.emp.name.split(' ').slice(1).join(' ')}
                              </span>
                            )}
                          </div>
                          {row.emp.isArchived && <span className="flex-shrink-0 text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full ml-1">Архив</span>}
                        </div>

                        {usedMachineIds.length > 0 && (
                          <button 
                            onClick={() => toggleTurnerRow(row.emp.id)}
                            className={`flex-shrink-0 p-1 rounded-md transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'text-blue-500 hover:bg-blue-100'}`}
                          >
                            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="text-[8px] text-blue-600 dark:text-blue-400 font-black uppercase">{row.emp.position}</div>
                        {row.emp.branchId && branches.find(b => b.id === row.emp.branchId) && (
                          <div className="text-[7px] text-slate-400 font-bold uppercase truncate max-w-[60px]">
                            • {branches.find(b => b.id === row.emp.branchId)?.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <UserMatrixRowCells
                      emp={row.emp}
                      empLogs={row.empLogs}
                      userLogsLookup={logsLookup[String(row.emp.id).trim()]}
                      days={days}
                      today={today}
                      filterMonth={filterMonth}
                      setEditingLog={setEditingLog}
                      roundShiftMinutes={currentOrg?.roundShiftMinutes}
                    />
                  </tr>
                );
              } else {
                const machineName = machines.find(m => m.id === row.mId)?.name || 'Работа';
                
                // Calculate total for machine with rounding per day
                const mMinsTotal = days.reduce((total, day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const mLogs = row.empLogs.filter((l: any) => l.date === dateStr && l.machineId === row.mId && l.entryType === EntryType.WORK);
                  const mMins = mLogs.reduce((s: number, l: any) => s + l.durationMinutes, 0);
                  return total + applyRounding(mMins, currentOrg?.roundShiftMinutes);
                }, 0);
                
                return (
                  <tr key={`mach-${row.emp.id}-${row.mId}`} className={rowClassName}>
                    <td className="sticky left-0 z-10 bg-slate-50/80 dark:bg-slate-800/80 border-r dark:border-slate-800 px-3 py-2 print:pl-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 italic pl-6 truncate w-[140px] min-w-[140px] max-w-[140px]">
                      ↳ {machineName}
                    </td>
                    {days.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      if (isAfter(day, today)) return <td key={dateStr} className="border-r dark:border-slate-800 p-1 h-8"></td>;
                      const mLogs = row.empLogs.filter((l: any) => l.date === dateStr && l.machineId === row.mId && l.entryType === EntryType.WORK);
                      const mMins = mLogs.reduce((s: number, l: any) => s + l.durationMinutes, 0);
                      const roundedMins = applyRounding(mMins, currentOrg?.roundShiftMinutes);
                      const hasMLogs = mLogs.length > 0;
                      return (
                        <td key={dateStr} className="border-r dark:border-slate-800 p-1 text-center h-8 text-[9px] print:text-[7px] font-bold text-slate-400 tabular-nums italic">
                          {hasMLogs ? formatDurationShort(roundedMins) : ''}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 px-4 py-2 text-center font-bold text-slate-400 text-[10px] print:text-[8px] bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 italic">
                      {formatDurationShort(mMinsTotal)}
                    </td>
                  </tr>
                );
              }

            })}
          </tbody>
        </table>
      </div>

      <div className="hidden print:grid grid-cols-2 gap-12 mt-12 p-8">
        <div className="border-t border-black pt-2">
          <div className="text-[10px] font-bold uppercase">Руководитель подразделения</div>
          <div className="mt-4 border-b border-black w-full h-8"></div>
          <div className="text-[8px] text-slate-500 mt-1">(подпись, ФИО)</div>
        </div>
        <div className="border-t border-black pt-2">
          <div className="text-[10px] font-bold uppercase">Ответственный за табель</div>
          <div className="mt-4 border-b border-black w-full h-8"></div>
          <div className="text-[8px] text-slate-500 mt-1">(подпись, ФИО)</div>
        </div>
      </div>
    </section>
  );
};
