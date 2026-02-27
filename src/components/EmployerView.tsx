
import React, { useState, useMemo, memo, useEffect } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { WorkLog, User, EntryType, UserRole, Machine, FIXED_POSITION_TURNER, PositionConfig, PositionPermissions, Organization, PlanType, Plan } from '../../types';
import { formatDurationShort, formatTime, calculateMinutes, getDaysInMonthArray, formatDuration } from '../../utils';
import { format, subDays, isAfter } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { ru } from 'date-fns/locale/ru';
import { DEFAULT_PERMISSIONS, STORAGE_KEYS, PLAN_LIMITS } from '../../constants';
import { db } from '../../lib/supabase';

// Sub-components
import CorrectionModal from './employer/CorrectionModal';
import EmployeeEditModal from './employer/EmployeeEditModal';
import PositionConfigModal from './employer/PositionConfigModal';

// --- Memoized User Row Component ---
const MemoizedUserMatrixRowCells = memo(({ 
  emp, 
  empLogs, 
  days, 
  today, 
  setEditingLog 
}: { 
  emp: User, 
  empLogs: WorkLog[], 
  days: Date[], 
  today: Date, 
  setEditingLog: (data: {userId: string, date: string}) => void 
}) => {
  const totalMinutes = useMemo(() => 
    empLogs.filter(l => l.checkOut || l.entryType !== EntryType.WORK).reduce((s, l) => s + l.durationMinutes, 0),
    [empLogs]
  );

  const logsByDate = useMemo(() => {
    const map: Record<string, WorkLog[]> = {};
    empLogs.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [empLogs]);

  return (
    <React.Fragment>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (isAfter(day, today)) {
          const planned = emp.plannedShifts?.[dateStr];
          return (
            <td key={dateStr} className="border-r p-1 h-12 text-center align-middle">
              {planned && (
                <span className={`text-[10px] font-black ${
                  planned === 'Р' ? 'text-blue-400' :
                  planned === 'В' ? 'text-slate-300' :
                  planned === 'Д' ? 'text-amber-400' :
                  planned === 'О' ? 'text-purple-400' :
                  planned === 'Н' ? 'text-indigo-400' : 'text-slate-300'
                }`}>
                  {planned}
                </span>
              )}
            </td>
          );
        }

        const dayLogs = logsByDate[dateStr] || [];
        const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
        const workMins = workEntries.reduce((s, l) => s + l.durationMinutes, 0);
        const hasWork = workEntries.length > 0;
        const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);
        const anyCorrected = dayLogs.some(l => l.isCorrected);
        const anyNight = dayLogs.some(l => l.isNightShift);
        
        let content: React.ReactNode = null;
        if (absence) {
           content = <span className="font-black text-blue-600">{absence.entryType === EntryType.SICK ? 'Б' : absence.entryType === EntryType.VACATION ? 'О' : 'В'}{anyCorrected && '*'}</span>;
        } else if (hasWork) {
           const isPending = workEntries.some(l => !l.checkOut);
           content = (
             <div className="flex flex-col items-center justify-center">
                <span className={`text-[11px] font-black ${isPending ? 'text-blue-500 italic' : 'text-slate-900'}`}>
                  {workMins > 0 ? formatDurationShort(workMins) : (isPending ? '--:--' : '0:00')}{(isPending || anyCorrected) && '*'}
                </span>
                {anyNight && <svg className="w-2 h-2 text-slate-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
             </div>
           );
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
    </React.Fragment>
  );
});

// --- Memoized Machine Row Component ---
const MemoizedMachineMatrixRowCells = memo(({ 
  mId, 
  empLogs, 
  days, 
  today 
}: { 
  mId: string, 
  empLogs: WorkLog[], 
  days: Date[], 
  today: Date 
}) => {
  const logsByDate = useMemo(() => {
    const map: Record<string, WorkLog[]> = {};
    empLogs.filter(l => l.machineId === mId && l.entryType === EntryType.WORK).forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [empLogs, mId]);

  const totalMinutes = useMemo(() => 
    Object.values(logsByDate).flat().reduce((s, l) => s + l.durationMinutes, 0),
    [logsByDate]
  );

  return (
    <React.Fragment>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-8"></td>;
        
        const mLogs = logsByDate[dateStr] || [];
        const mMins = mLogs.reduce((s, l) => s + l.durationMinutes, 0);
        const hasMLogs = mLogs.length > 0;
        
        return (
          <td key={dateStr} className="border-r p-1 text-center h-8 text-[9px] font-bold text-slate-400 tabular-nums italic">
            {hasMLogs ? formatDurationShort(mMins) : ''}
          </td>
        );
      })}
      <td className="sticky right-0 z-10 px-4 py-2 text-center font-bold text-slate-400 text-[10px] bg-slate-50 border-l border-slate-200 italic">
        {formatDurationShort(totalMinutes)}
      </td>
    </React.Fragment>
  );
});

interface EmployerViewProps {
  logs: WorkLog[];
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  machines: Machine[];
  onUpdateMachines: (machines: Machine[]) => void;
  positions: PositionConfig[];
  onUpdatePositions: (positions: PositionConfig[]) => void;
  onImportData: (data: string) => void;
  onLogsUpsert: (logs: WorkLog[]) => void;
  activeShiftsMap?: Record<string, any>;
  onActiveShiftsUpdate: (userId: string, shifts: any) => void;
  onDeleteLog: (logId: string) => void;
  onRefresh?: () => Promise<void>;
  isSyncing?: boolean;
  nightShiftBonusMinutes: number;
  onUpdateNightBonus: (minutes: number) => void;
  currentOrg: Organization | null;
  plans: Plan[];
  onUpdateOrg: (org: Organization) => void;
  currentUser?: User | null;
  onMonthChange?: (month: string) => void;
}

const EmployerView: React.FC<EmployerViewProps> = ({ 
  logs, users, onAddUser, onUpdateUser, onDeleteUser, 
  machines, onUpdateMachines, positions, onUpdatePositions, onImportData, onLogsUpsert, activeShiftsMap = {}, onActiveShiftsUpdate, onDeleteLog,
  onRefresh, isSyncing = false, nightShiftBonusMinutes, onUpdateNightBonus, currentOrg, plans, onUpdateOrg, currentUser: propCurrentUser, onMonthChange
}) => {
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'matrix' | 'team' | 'analytics' | 'settings' | 'billing'>('analytics');
  const [editingLog, setEditingLog] = useState<{ userId: string; date: string } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [editingPositionName, setEditingPositionName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [configuringPosition, setConfiguringPosition] = useState<PositionConfig | null>(null);
  const [expandedTurnerRows, setExpandedTurnerRows] = useState<Set<string>>(new Set());

  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [newUser, setNewUser] = useState({ name: '', position: positions[0]?.name || '', department: '', pin: '0000', requirePhoto: false });
  const [newMachineName, setNewMachineName] = useState('');
  const [newPositionName, setNewPositionName] = useState('');
  
  const [serverStats, setServerStats] = useState<{ avgWeeklyHours: number, absenceCounts: any[] } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentOrg) return;
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
      const stats = await db.getDashboardStats(currentOrg.id, filterMonth, last7Days);
      if (stats) {
        setServerStats({
          avgWeeklyHours: (stats.total_weekly_minutes / 60) / 7,
          absenceCounts: stats.top_absences || []
        });
      } else {
        setServerStats(null);
      }
    };
    fetchStats();
  }, [currentOrg, filterMonth, logs]);

  const employees = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const dashboardStats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = logs.filter(l => l.date === todayStr);
    
    // Собираем активные смены из двух источников: из логов и из карты активных смен
    const activeFromLogs = logs.filter(l => l.entryType === EntryType.WORK && !l.checkOut);
    const activeFromMap: WorkLog[] = [];
    
    Object.values(activeShiftsMap).forEach(userShifts => {
      if (userShifts && typeof userShifts === 'object') {
        Object.values(userShifts).forEach(s => {
          if (s && typeof s === 'object' && !(s as any).checkOut) {
            activeFromMap.push(s as any);
          }
        });
      }
    });

    // Объединяем, удаляя дубликаты по ID
    const activeLogIds = new Set(activeFromLogs.map(l => l.id));
    const activeShifts = [...activeFromLogs, ...activeFromMap.filter(l => !activeLogIds.has(l.id))];

    const finishedToday = todayLogs.filter(l => l.entryType === EntryType.WORK && l.checkOut);
    
    let avgWeeklyHours = 0;
    let absenceCounts: any[] = [];

    if (serverStats) {
      avgWeeklyHours = serverStats.avgWeeklyHours;
      absenceCounts = serverStats.absenceCounts;
    } else {
      // Fallback local calculation
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
      const weekLogs = logs.filter(l => last7Days.includes(l.date) && l.entryType === EntryType.WORK);
      const totalWeeklyMinutes = weekLogs.reduce((s, l) => s + l.durationMinutes, 0);
      avgWeeklyHours = (totalWeeklyMinutes / 60) / 7;

      const monthLogs = logs.filter(l => l.date.startsWith(filterMonth));
      absenceCounts = employees.map(emp => {
        const absences = monthLogs.filter(l => l.userId === emp.id && (l.entryType === EntryType.SICK || l.entryType === EntryType.VACATION)).length;
        return { name: emp.name, count: absences };
      }).sort((a, b) => b.count - a.count).filter(a => a.count > 0).slice(0, 3);
    }

    const activeLogsMap: Record<string, WorkLog[]> = {};
    activeShifts.forEach(log => {
      if (!activeLogsMap[log.userId]) activeLogsMap[log.userId] = [];
      activeLogsMap[log.userId].push(log);
    });

    return { activeShifts, finishedToday, avgWeeklyHours, absenceCounts, activeLogsMap, todayStr };
  }, [logs, employees, filterMonth, activeShiftsMap, serverStats]);
  const planLimits = useMemo(() => {
    if (!currentOrg) return PLAN_LIMITS[PlanType.FREE];
    const dynamicPlan = plans.find(p => p.type === currentOrg.plan);
    return dynamicPlan ? dynamicPlan.limits : PLAN_LIMITS[currentOrg.plan];
  }, [currentOrg, plans]);

  const isUserLimitReached = users.length >= planLimits.maxUsers;
  const isMachineLimitReached = machines.length >= planLimits.maxMachines;

  const days = getDaysInMonthArray(filterMonth);
  const today = startOfDay(new Date());

  const currentUser = useMemo(() => {
    if (propCurrentUser) return propCurrentUser;
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return cached ? JSON.parse(cached) as User : null;
    } catch (e) {
      return null;
    }
  }, [propCurrentUser, users]);

  const userPerms = useMemo(() => {
    if (currentUser?.id === 'admin') return { isFullAdmin: true, isLimitedAdmin: false };
    const pos = positions.find(p => p.name === currentUser?.position);
    return pos?.permissions || DEFAULT_PERMISSIONS;
  }, [currentUser, positions]);

  const toggleTurnerRow = (empId: string) => {
    const newSet = new Set(expandedTurnerRows);
    if (newSet.has(empId)) newSet.delete(empId);
    else newSet.add(empId);
    setExpandedTurnerRows(newSet);
  };

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


  // Функция для принудительного завершения смены администратором
  const handleForceFinish = async (log: WorkLog) => {
    const empName = users.find(u => u.id === log.userId)?.name || 'сотрудника';
    const mName = machines.find(m => m.id === log.machineId)?.name || 'Работа';
    
    if (!confirm(`Вы действительно хотите принудительно завершить смену (${mName}) для ${empName}? Таймер сотрудника будет остановлен, оборудование станет свободным.`)) return;

    const now = new Date();
    // Рассчитываем длительность смены до текущего момента
    const duration = log.checkIn ? calculateMinutes(log.checkIn, now.toISOString()) : 0;
    
    // Создаем объект завершенного лога
    const completedLog: WorkLog = {
      ...log,
      checkOut: now.toISOString(),
      durationMinutes: Math.max(0, duration),
      isCorrected: true,
      correctionNote: `Смена (${mName}) завершена администратором принудительно`,
      correctionTimestamp: now.toISOString()
    };

    // 1. Обновляем основной список логов. 
    // Наша обновленная функция handleLogsUpsert в App.tsx теперь автоматически 
    // находит и удаляет завершенные смены из карты активных смен (activeShiftsMap).
    onLogsUpsert([completedLog]);
  };

  const logsByUserId = useMemo(() => {
    const map: Record<string, WorkLog[]> = {};
    logs.forEach(l => {
      if (l.date.startsWith(filterMonth)) {
        if (!map[l.userId]) map[l.userId] = [];
        map[l.userId].push(l);
      }
    });
    return map;
  }, [logs, filterMonth]);

  const virtuosoData = useMemo(() => {
    const rows: any[] = [];
    employees.forEach(emp => {
      const empLogs = logsByUserId[emp.id] || [];
      rows.push({ type: 'employee', emp, empLogs });
      if (expandedTurnerRows.has(emp.id)) {
        const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId).map(l => l.machineId!))];
        usedMachineIds.forEach(mId => {
          rows.push({ type: 'machine', emp, mId, empLogs });
        });
      }
    });
    return rows;
  }, [employees, expandedTurnerRows, logsByUserId]);

  const virtuosoComponents = useMemo(() => ({
    Table: (props: any) => <table {...props} className="w-full border-collapse" />,
    TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => <tbody {...props} ref={ref} />),
    TableRow: (props: any) => {
      const index = props['data-index'];
      const row = props.context?.data?.[index];
      const className = row?.type === 'employee' 
        ? "border-b border-slate-200 group bg-slate-50/30" 
        : "border-b border-slate-100 bg-blue-50/20";
      return <tr {...props} className={className} />;
    }
  }), []);

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
      requirePhoto: newUser.requirePhoto,
      forcePinChange: false
    };
    onAddUser(user);
    setNewUser({ name: '', position: positions[0]?.name || '', department: '', pin: '0000', requirePhoto: false });
  };

  const deleteLogItem = (logId: string) => {
    if (confirm('Удалить эту запись безвозвратно?')) {
      onDeleteLog(logId);
    }
  };

  const handlePermissionToggle = (key: keyof PositionPermissions) => {
    if (!configuringPosition) return;

    // Проверка лимитов фич тарифа
    if (key === 'canUseNightShift' && !planLimits.features.nightShift) {
       alert("Ночная смена доступна только в тарифе PRO");
       return;
    }
    if (key === 'defaultRequirePhoto' && !planLimits.features.photoCapture) {
       alert("Фотофиксация доступна только в тарифе PRO");
       return;
    }

    const updated = {
      ...configuringPosition,
      permissions: {
        ...configuringPosition.permissions,
        [key]: !configuringPosition.permissions[key]
      }
    };
    setConfiguringPosition(updated);
    const newPositions = positions.map(p => p.name === updated.name ? updated : p);
    onUpdatePositions(newPositions);
  };

  const tabs = useMemo(() => {
    const allTabs = [
      { id: 'analytics', label: 'Дашборд' },
      { id: 'matrix', label: 'Табель' },
      { id: 'team', label: 'Команда' },
      { id: 'billing', label: 'Биллинг' },
      { id: 'settings', label: 'Настройки' }
    ];
    if (userPerms.isFullAdmin) return allTabs;
    if (userPerms.isLimitedAdmin) return allTabs.filter(t => ['analytics', 'matrix'].includes(t.id));
    return allTabs;
  }, [userPerms]);

  const handleResetDevicePairing = () => {
    if (confirm('Сбросить привязку профиля на этом устройстве? На этом планшете/телефоне система снова потребует выбрать пользователя при входе.')) {
      localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
      alert('Привязка сброшена.');
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !currentOrg) return;
    setIsApplyingPromo(true);
    setPromoMessage(null);
    
    try {
      const promos = await db.getPromoCodes();
      const promo = promos?.find((p: any) => p.code.toUpperCase() === promoCode.toUpperCase() && p.isActive);
      
      if (!promo) {
        setPromoMessage({ text: 'Промокод не найден или неактивен', type: 'error' });
        return;
      }
      
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
        setPromoMessage({ text: 'Лимит использований промокода исчерпан', type: 'error' });
        return;
      }
      
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        setPromoMessage({ text: 'Срок действия промокода истек', type: 'error' });
        return;
      }

      // Применяем промокод
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + promo.durationDays);
      
      const updateData = {
        plan: promo.planType,
        status: 'active' as const,
        expiryDate: expiryDate.toISOString()
      };

      const { error } = await db.updateOrganization(currentOrg.id, updateData);
      if (error) {
        const msg = typeof error === 'string' ? error : error.message;
        setPromoMessage({ text: 'Ошибка при активации: ' + msg, type: 'error' });
        return;
      }
      
      // Обновляем локальное состояние немедленно
      if (onUpdateOrg) {
        onUpdateOrg({
          ...currentOrg,
          ...updateData
        });
      }
      
      // Обновляем счетчик использований
      await db.savePromoCode({ 
        ...promo, 
        usedCount: promo.usedCount + 1,
        lastUsedBy: currentOrg.name || currentOrg.id,
        lastUsedAt: new Date().toISOString()
      });
      
      setPromoMessage({ text: `Промокод успешно применен! Тариф ${promo.planType} активирован на ${promo.durationDays} дней.`, type: 'success' });
      setPromoCode('');
      
      if (onRefresh) await onRefresh();
    } catch (err) {
      setPromoMessage({ text: 'Ошибка при активации промокода', type: 'error' });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName.trim() || isMachineLimitReached) return;
    onUpdateMachines([...machines, { id: Math.random().toString(36).substr(2, 9), name: newMachineName.trim() }]);
    setNewMachineName('');
  };

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPositionName.trim()) return;
    onUpdatePositions([...positions, { name: newPositionName.trim(), permissions: { ...DEFAULT_PERMISSIONS, isFullAdmin: false, isLimitedAdmin: false } }]);
    setNewPositionName('');
  };

  const handleExport = () => {
    const data = { logs, users, machines, positions, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm('Вы уверены? Это действие может перезаписать текущие данные.')) {
          onImportData(data);
        }
      } catch (err) {
        alert('Ошибка при чтении файла');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-[120] bg-slate-900/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewPhoto(null)}
        >
          <img src={previewPhoto} className="max-w-full max-h-full rounded-2xl shadow-2xl animate-scaleIn" alt="Preview" />
          <button className="absolute top-8 right-8 text-white text-4xl font-light">&times;</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 gap-4 shadow-sm no-print">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setViewMode(tab.id as any)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${viewMode === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
           {onRefresh && (
              <button 
                onClick={() => onRefresh()} 
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`} 
                title="Обновить данные"
              >
                <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
           )}
           <input type="month" value={filterMonth} onChange={(e) => {
             setFilterMonth(e.target.value);
             if (onMonthChange) onMonthChange(e.target.value);
           }} className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
           <button onClick={downloadPDF} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors" title="Скачать PDF">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </button>
        </div>
      </div>

      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                В сети ({dashboardStats.activeShifts.length})
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {dashboardStats.activeShifts.length > 0 ? dashboardStats.activeShifts.map(s => {
                  const emp = users.find(u => u.id === s.userId);
                  const machine = machines.find(m => m.id === s.machineId);
                  return (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          {s.isNightShift && (
                            <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                            </svg>
                          )}
                          {emp?.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                          {machine?.name || 'Работа'} • {formatTime(s.checkIn)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      </div>
                    </div>
                  );
                }) : <p className="text-xs text-slate-400 italic py-4 text-center">Нет активных смен</p>}
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
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          {s.isNightShift && (
                            <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                            </svg>
                          )}
                          {emp?.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                          Начало: {formatTime(s.checkIn)} | Конец: {formatTime(s.checkOut)}
                        </span>
                      </div>
                      <span className="text-[11px] font-black text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        {formatDurationShort(s.durationMinutes)}
                      </span>
                    </div>
                  );
                }) : <p className="text-xs text-slate-400 italic py-4 text-center">Нет завершенных смен</p>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 p-7 rounded-[2.2rem] text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">Средняя выработка (7дн)</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tabular-nums">{(serverStats?.avgWeeklyHours || 0).toFixed(1)}</span>
                <span className="text-xs font-bold text-slate-400 uppercase">часов / день</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Топ пропусков</h3>
              <div className="space-y-4">
                {(serverStats?.absenceCounts || []).length > 0 ? (serverStats?.absenceCounts || []).map((a: any, i: number) => (
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
      )}

      {viewMode === 'matrix' && (
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-[700px] flex flex-col" id="employer-matrix-report">
          <div className="hidden print:block p-8 text-center border-b border-slate-900 print-monochrome">
             <h1 className="text-3xl font-black uppercase tracking-tighter">Сводный Табель ({filterMonth})</h1>
          </div>
          <div className="flex-1 print:block print-monochrome">
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
                      <MemoizedUserMatrixRowCells
                        emp={row.emp}
                        empLogs={row.empLogs}
                        days={days}
                        today={today}
                        setEditingLog={setEditingLog}
                      />
                    </React.Fragment>
                  );
                } else {
                  const machineName = machines.find(m => m.id === row.mId)?.name || 'Работа';
                  
                  return (
                    <React.Fragment>
                      <td className="sticky left-0 z-10 bg-slate-50/80 border-r px-3 py-2 text-[10px] font-bold text-slate-500 italic pl-6 truncate w-[140px] min-w-[140px] max-w-[140px]">
                        ↳ {machineName}
                      </td>
                      <MemoizedMachineMatrixRowCells 
                        mId={row.mId}
                        empLogs={row.empLogs}
                        days={days}
                        today={today}
                      />
                    </React.Fragment>
                  );
                }
              }}
              components={virtuosoComponents}
              context={{ data: virtuosoData }}
            />
          </div>
        </section>
      )}

      {viewMode === 'team' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24 ${isUserLimitReached ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Новый сотрудник</h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUserLimitReached ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                  {users.length} / {planLimits.maxUsers}
                </span>
              </div>
              
              {isUserLimitReached ? (
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center space-y-3">
                   <p className="text-[11px] font-bold text-blue-800 leading-tight">Достигнут лимит сотрудников для тарифа {currentOrg?.plan}</p>
                   <button onClick={() => window.location.href='#pricing'} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">Расширить лимит</button>
                </div>
              ) : (
                <form onSubmit={handleAddUser} className="space-y-4">
                  <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="ФИО сотрудника" className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
                  <select value={newUser.position} onChange={e => setNewUser({...newUser, position: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white">
                    {positions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                  <input type="text" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/[^0-9]/g, '')})} placeholder="PIN (0000)" className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono" />
                  <div className={`flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 ${!planLimits.features.photoCapture ? 'opacity-50' : ''}`}>
                    <input 
                      disabled={!planLimits.features.photoCapture}
                      type="checkbox" 
                      checked={newUser.requirePhoto} 
                      onChange={e => setNewUser({...newUser, requirePhoto: e.target.checked})} 
                      className="w-5 h-5 rounded accent-blue-600" 
                      id="req-photo" 
                    />
                    <label htmlFor="req-photo" className="text-xs font-black text-slate-600 uppercase cursor-pointer">
                       Обязательное фото {!planLimits.features.photoCapture && '(PRO)'}
                    </label>
                  </div>
                  <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest">Создать</button>
                </form>
              )}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
             {users.map(u => {
               const activeLogs = dashboardStats.activeLogsMap[u.id] || [];
               const isWorking = activeLogs.length > 0;
               return (
                 <div key={u.id} className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center justify-between group shadow-sm transition-all hover:border-blue-300">
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xl">{u.name.charAt(0)}</div>
                        {isWorking && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 border-2 border-white rounded-full animate-pulse"></span>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 truncate">{u.name}</h4>
                          {u.forcePinChange && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded-full border border-amber-200">PIN Reset</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">{u.position}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isWorking && (
                        <div className="flex gap-2 mr-2">
                          {activeLogs.map((log: WorkLog) => {
                            const machineName = machines.find(m => m.id === log.machineId)?.name || 'Работа';
                            return (
                              <div key={log.id} className="flex flex-col items-center gap-1">
                                {userPerms.isFullAdmin && (
                                <button 
                                  onClick={() => handleForceFinish(log)}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-100 group/stop shadow-sm"
                                  title={`Принудительно остановить (${machineName})`}
                                >
                                   <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                                   <span className="text-[10px] font-black uppercase tracking-tight hidden sm:block">Стоп</span>
                                </button>
                                )}
                                <span className="text-[7px] font-black text-red-400 uppercase tracking-tighter leading-none text-center max-w-[50px] truncate">{machineName}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button 
                        onClick={() => setEditingEmployee(u)}
                        className="p-3 text-slate-300 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-2xl"
                        title="Редактировать"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      {u.id !== 'admin' && (
                        <button onClick={() => { if(confirm(`Удалить ${u.name}?`)) onDeleteUser(u.id); }} className="p-3 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-2xl">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                 </div>
               );
             })}
          </div>
        </section>
      )}

      {viewMode === 'billing' && (
        <div className="space-y-8 no-print animate-fadeIn">
          <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.82v-1.91c-1.52-.35-2.82-1.3-3.27-2.7h1.82c.45.75 1.2 1.25 2.1 1.25 1.1 0 2-.9 2-2s-.9-2-2-2c-2.1 0-3.9-1.8-3.9-3.9s1.8-3.9 3.9-3.9V5h2.82v1.91c1.52.35 2.82 1.3 3.27 2.7h-1.82c-.45-.75-1.2-1.25-2.1-1.25-1.1 0-2 .9-2 2s.9 2 2 2c2.1 0 3.9 1.8 3.9 3.9s-1.8 3.9-3.9 3.9z"/></svg>
            </div>
            
            <div className="relative z-10">
              <h3 className="font-black text-slate-900 mb-2 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Ваш тарифный план</h3>
              <div className="flex items-baseline gap-3 mt-6">
                <span className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{currentOrg?.plan || PlanType.FREE}</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">Активен</span>
                {currentOrg?.expiryDate && (
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                    До: {format(new Date(currentOrg.expiryDate), 'dd.MM.yyyy')}
                  </span>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 max-w-md">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Активация промокода</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    placeholder="Введите код..."
                    className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-widest outline-none focus:border-blue-500 transition-all"
                  />
                  <button 
                    onClick={handleApplyPromo}
                    disabled={isApplyingPromo || !promoCode.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-slate-200 disabled:shadow-none transition-all"
                  >
                    {isApplyingPromo ? '...' : 'ОК'}
                  </button>
                </div>
                {promoMessage && (
                  <p className={`mt-3 text-[10px] font-bold uppercase tracking-tight px-4 py-2 rounded-xl ${promoMessage.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                    {promoMessage.text}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Сотрудники</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{users.length}</span>
                    <span className="text-sm font-bold text-slate-400">/ {planLimits.maxUsers}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${users.length / planLimits.maxUsers > 0.9 ? 'bg-red-500' : 'bg-blue-600'}`} 
                      style={{ width: `${Math.min((users.length / planLimits.maxUsers) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Оборудование</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{machines.length}</span>
                    <span className="text-sm font-bold text-slate-400">/ {planLimits.maxMachines}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${machines.length / planLimits.maxMachines > 0.9 ? 'bg-red-500' : 'bg-blue-600'}`} 
                      style={{ width: `${Math.min((machines.length / planLimits.maxMachines) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Функционал</p>
                  <div className="space-y-2 mt-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.photoCapture ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <span className={`text-[10px] font-bold uppercase ${planLimits.features.photoCapture ? 'text-slate-700' : 'text-slate-400'}`}>Фотофиксация</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.nightShift ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <span className={`text-[10px] font-bold uppercase ${planLimits.features.nightShift ? 'text-slate-700' : 'text-slate-400'}`}>Ночные смены</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.advancedAnalytics ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <span className={`text-[10px] font-bold uppercase ${planLimits.features.advancedAnalytics ? 'text-slate-700' : 'text-slate-400'}`}>Аналитика</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[PlanType.FREE, PlanType.PRO, PlanType.BUSINESS].map((planType) => {
              const dynamicPlan = plans.find(p => p.type === planType);
              const limits = dynamicPlan ? dynamicPlan.limits : PLAN_LIMITS[planType];
              const isCurrent = currentOrg?.plan === planType;
              
              return (
                <div key={planType} className={`bg-white p-8 rounded-[2.5rem] border-2 transition-all flex flex-col ${isCurrent ? 'border-blue-600 shadow-xl shadow-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl">{dynamicPlan?.name || planType}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {planType === PlanType.FREE ? 'Для малого бизнеса' : planType === PlanType.PRO ? 'Для растущих команд' : 'Для крупных предприятий'}
                      </p>
                    </div>
                    {isCurrent && <span className="text-[8px] font-black bg-blue-600 text-white px-2 py-1 rounded-full uppercase">Текущий</span>}
                  </div>
                  
                  <div className="mb-8 space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{limits.maxUsers === 1000 ? 'Безлимитно' : `${limits.maxUsers} сотрудников`}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Макс. пользователей</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{limits.maxMachines === 1000 ? 'Безлимитно' : `${limits.maxMachines} станков`}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Оборудование</p>
                      </div>
                    </div>

                    <div className="pt-4 space-y-2 border-t border-slate-50">
                      {[
                        { label: 'Фотофиксация', enabled: limits.features.photoCapture },
                        { label: 'Ночные смены', enabled: limits.features.nightShift },
                        { label: 'Аналитика', enabled: limits.features.advancedAnalytics },
                        { label: 'Облачная синхронизация', enabled: true },
                        { label: 'Техподдержка 24/7', enabled: planType !== PlanType.FREE },
                      ].map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <svg className={`w-3 h-3 ${feat.enabled ? 'text-green-500' : 'text-slate-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                          <span className={`text-[10px] font-bold uppercase ${feat.enabled ? 'text-slate-600' : 'text-slate-300 line-through'}`}>{feat.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    disabled={isCurrent}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg shadow-slate-100 hover:shadow-blue-100 active:scale-95'}`}
                  >
                    {isCurrent ? 'Ваш тариф' : 'Выбрать тариф'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'settings' && (
        <div className="space-y-8 no-print">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Оборудование / Ресурсы</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMachineLimitReached ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                    {machines.length} / {planLimits.maxMachines}
                  </span>
                </div>
                <form onSubmit={handleAddMachine} className="flex gap-2 mb-6">
                  <input 
                    disabled={isMachineLimitReached}
                    type="text" 
                    value={newMachineName} 
                    onChange={e => setNewMachineName(e.target.value)} 
                    placeholder={isMachineLimitReached ? "Лимит достигнут" : "Название (напр. Станок №1)"} 
                    className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all" 
                  />
                  <button disabled={isMachineLimitReached} type="submit" className="px-6 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50">Добавить</button>
                </form>
                <div className="grid grid-cols-1 gap-2">
                  {machines.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <span className="text-sm font-bold text-slate-700">{m.name}</span>
                      <button onClick={() => onUpdateMachines(machines.filter(x => x.id !== m.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6">Должности</h3>
                <form onSubmit={handleAddPosition} className="flex gap-2 mb-6">
                  <input type="text" value={newPositionName} onChange={e => setNewPositionName(e.target.value)} placeholder="Название должности" className="flex-1 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all" />
                  <button type="submit" className="px-6 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Добавить</button>
                </form>
                <div className="space-y-3">
                  {positions.map(p => (
                    <div key={p.name} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-black text-slate-900 text-xs uppercase tracking-widest">{p.name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setConfiguringPosition(p)} className="text-blue-500 hover:text-blue-600 p-1 bg-blue-50 rounded-lg transition-colors" title="Настроить права">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
                          <button onClick={() => onUpdatePositions(positions.filter(x => x.name !== p.name))} className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={p.permissions.isFullAdmin} onChange={e => {
                              const newPos = positions.map(x => x.name === p.name ? {...x, permissions: {...x.permissions, isFullAdmin: e.target.checked}} : x);
                              onUpdatePositions(newPos);
                            }} className="w-4 h-4 rounded accent-blue-600" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Полный админ</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={p.permissions.isLimitedAdmin} onChange={e => {
                              const newPos = positions.map(x => x.name === p.name ? {...x, permissions: {...x.permissions, isLimitedAdmin: e.target.checked}} : x);
                              onUpdatePositions(newPos);
                            }} className="w-4 h-4 rounded accent-blue-600" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Огр. админ</span>
                         </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100">
                <h3 className="font-black uppercase text-xs tracking-[0.2em] mb-6 opacity-80">Настройки смен</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                     <div>
                       <p className="text-sm font-black">Ночной бонус</p>
                       <p className="text-[10px] opacity-60 font-bold uppercase mt-1">Авто-определение ночных смен</p>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded-lg">22:00 - 06:00</span>
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                     <div>
                       <p className="text-sm font-black">Уведомления</p>
                       <p className="text-[10px] opacity-60 font-bold uppercase mt-1">Telegram / WhatsApp</p>
                     </div>
                     <button className="px-4 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Настроить</button>
                  </div>
                </div>
              </div>

              {currentOrg && (
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6">Организация</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Название</label>
                      <input 
                        type="text" 
                        value={currentOrg.name} 
                        onChange={e => onUpdateOrg({...currentOrg, name: e.target.value})}
                        className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Текущий тариф</span>
                        <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest">{currentOrg.plan}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Резервное копирование</h3>
            <p className="text-slate-500 text-sm mb-10 leading-relaxed">Экспортируйте все данные в JSON файл для локального хранения или переноса на другое устройство.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={handleExport} className="px-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:scale-105 transition-all">Экспортировать всё</button>
              <label className="px-10 py-5 bg-white border-2 border-slate-100 text-slate-900 rounded-[1.5rem] font-black uppercase text-xs tracking-widest cursor-pointer hover:bg-slate-50 transition-all">
                Импортировать
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          </section>
        </div>
      )}

      {editingLog && (
        <CorrectionModal 
          editingLog={editingLog}
          logs={logs}
          users={users}
          machines={machines}
          onClose={() => setEditingLog(null)}
          onLogsUpsert={onLogsUpsert}
          onDeleteLog={onDeleteLog}
          onPreviewPhoto={setPreviewPhoto}
        />
      )}

      {editingEmployee && (
        <EmployeeEditModal 
          editingEmployee={editingEmployee}
          positions={positions}
          planFeatures={planLimits.features}
          onClose={() => setEditingEmployee(null)}
          onUpdateEmployee={onUpdateUser}
          onResetDevicePairing={handleResetDevicePairing}
          setEditingEmployee={setEditingEmployee}
        />
      )}

      {configuringPosition && (
        <PositionConfigModal 
          configuringPosition={configuringPosition}
          planFeatures={planLimits.features}
          onClose={() => setConfiguringPosition(null)}
          onTogglePermission={handlePermissionToggle}
          onUpdateMaxShiftDuration={(hours) => {
            const next = {
              ...configuringPosition,
              permissions: {
                ...configuringPosition.permissions,
                maxShiftDurationMinutes: hours > 0 ? hours * 60 : undefined
              }
            };
            setConfiguringPosition(next);
            onUpdatePositions(positions.map(p => p.name === next.name ? next : p));
          }}
        />
      )}
    </div>
  );
};

export default EmployerView;
