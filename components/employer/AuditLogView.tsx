import React, { useState, useMemo, useEffect } from 'react';
import { History, Search, Filter, User as UserIcon, Calendar, Clock, ArrowRight } from 'lucide-react';
import { getAuditLogs, AuditLogEntry } from '../../lib/audit';
import { User, Organization } from '../../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AuditLogViewProps {
  currentOrg: Organization | null;
  users: User[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentOrg, users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchLogs = async () => {
      if (!currentOrg) return;
      setIsLoading(true);
      const data = await getAuditLogs(currentOrg.id);
      setLogs(data);
      setIsLoading(false);
    };
    fetchLogs();
  }, [currentOrg]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.targetUserName && log.targetUserName.toLowerCase().includes(searchTerm.toLowerCase()));
        
      const matchesAction = filterAction === 'all' || log.action === filterAction;
      
      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, filterAction]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(l => l.action));
    return Array.from(actions);
  }, [logs]);

  const getActionColor = (action: string) => {
    if (action.includes('удаление') || action.includes('delete')) return 'text-red-600 dark:text-red-400 bg-red-50 border-red-100';
    if (action.includes('изменение') || action.includes('edit') || action.includes('update')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 border-amber-100';
    if (action.includes('добавление') || action.includes('create') || action.includes('add')) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 border-emerald-100';
    return 'text-blue-600 dark:text-blue-400 bg-blue-50 border-blue-100';
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      'edit_user': 'Изменение профиля',
      'delete_shift': 'Удаление смены',
      'edit_shift': 'Изменение смены',
      'add_shift': 'Добавление смены',
      'edit_position': 'Изменение должности',
      'add_user': 'Добавление сотрудника',
      'delete_user': 'Удаление сотрудника',
      'edit_payroll': 'Изменение ставки/зарплаты'
    };
    return map[action] || action;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <History className="w-6 h-6" />
            </div>
            Журнал аудита
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            История действий администраторов и изменений в системе
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по имени или деталям..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
          </div>
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 appearance-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer outline-none"
            >
              <option value="all">Все действия</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{getActionLabel(action)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Загрузка журнала...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Записи не найдены</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:shadow-lg dark:shadow-slate-900/20 transition-all group flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="flex items-center gap-4 min-w-[200px]">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <UserIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{log.adminName}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm', { locale: ru })}
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                    {log.targetUserName && (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          {log.targetUserName}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {log.details}
                  </p>
                  {log.changes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg font-mono">
                      <span className="font-bold text-slate-700 dark:text-slate-200">Изменения:</span> {log.changes}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
