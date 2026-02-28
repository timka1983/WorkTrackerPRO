import React from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { format, isAfter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { UserMatrixRowCells } from './UserMatrixRowCells';
import { EntryType, Machine, WorkLog } from '../../types';
import { formatDurationShort } from '../../utils';

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
  logsLookup = {}
}) => {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-[700px] flex flex-col" id="employer-matrix-report">
      <div className="hidden print:block p-8 text-center border-b border-slate-900 print-monochrome">
         <h1 className="text-3xl font-black uppercase tracking-tighter">Сводный Табель ({filterMonth})</h1>
      </div>
      <div className="flex-1 print-monochrome">
        <TableVirtuoso
          style={{ height: '100%' }}
          data={virtuosoData}
          fixedHeaderContent={() => (
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
          )}
          itemContent={(index, row) => {
            if (row.type === 'employee') {
              const usedMachineIds = [...new Set(row.empLogs.filter((l: any) => l.machineId).map((l: any) => l.machineId!))];
              const isExpanded = expandedTurnerRows.has(row.emp.id);
              return (
                <React.Fragment>
                  <td className="sticky left-0 z-10 bg-white border-r px-3 py-3 font-black text-slate-900 text-[11px] truncate w-[140px] min-w-[140px] max-w-[140px]">
                    <div className="flex items-center justify-between group/name">
                      <span className="truncate pr-1">{row.emp.name}</span>
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
                      <div className="text-[8px] text-blue-600 font-black uppercase">{row.emp.position}</div>
                    </div>
                  </td>
                  <UserMatrixRowCells
                    emp={row.emp}
                    empLogs={row.empLogs}
                    userLogsLookup={logsLookup[row.emp.id]}
                    days={days}
                    today={today}
                    filterMonth={filterMonth}
                    setEditingLog={setEditingLog}
                  />
                </React.Fragment>
              );
            } else {
              const machineName = machines.find(m => m.id === row.mId)?.name || 'Работа';
              const mMinsTotal = row.empLogs.filter((l: any) => l.machineId === row.mId && l.entryType === EntryType.WORK).reduce((s: number, l: any) => s + l.durationMinutes, 0);
              
              return (
                <React.Fragment>
                  <td className="sticky left-0 z-10 bg-slate-50/80 border-r px-3 py-2 text-[10px] font-bold text-slate-500 italic pl-6 truncate w-[140px] min-w-[140px] max-w-[140px]">
                    ↳ {machineName}
                  </td>
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-8"></td>;
                    const mLogs = row.empLogs.filter((l: any) => l.date === dateStr && l.machineId === row.mId && l.entryType === EntryType.WORK);
                    const mMins = mLogs.reduce((s: number, l: any) => s + l.durationMinutes, 0);
                    const hasMLogs = mLogs.length > 0;
                    return (
                      <td key={dateStr} className="border-r p-1 text-center h-8 text-[9px] font-bold text-slate-400 tabular-nums italic">
                        {hasMLogs ? formatDurationShort(mMins) : ''}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 px-4 py-2 text-center font-bold text-slate-400 text-[10px] bg-slate-50 border-l border-slate-200 italic">
                    {formatDurationShort(mMinsTotal)}
                  </td>
                </React.Fragment>
              );
            }
          }}
          components={virtuosoComponents}
          context={{ data: virtuosoData }}
        />
      </div>
    </section>
  );
};
