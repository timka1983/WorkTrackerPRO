
import React, { useState, useMemo, memo, useEffect, useCallback } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { WorkLog, User, EntryType, UserRole, Machine, FIXED_POSITION_TURNER, PositionConfig, PositionPermissions, Organization, PlanType, Plan, PayrollConfig } from '../types';
import { formatDuration, getDaysInMonthArray, formatDurationShort, exportToCSV, formatTime, calculateMinutes, calculateMonthlyPayroll } from '../utils';
import { format, isAfter } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { subDays } from 'date-fns/subDays';
import { ru } from 'date-fns/locale/ru';
import { DEFAULT_PERMISSIONS, STORAGE_KEYS, PLAN_LIMITS, DEFAULT_PAYROLL_CONFIG } from '../constants';
import { db } from '../lib/supabase';

// --- Memoized Row Component ---
const MemoizedUserMatrixRowCells = memo(({ 
  emp, 
  empLogs, 
  days, 
  today, 
  filterMonth, 
  setEditingLog 
}: { 
  emp: User, 
  empLogs: WorkLog[], 
  days: Date[], 
  today: Date, 
  filterMonth: string, 
  setEditingLog: (data: {userId: string, date: string}) => void 
}) => {
  const totalMinutes = empLogs.filter(l => l.checkOut || l.entryType !== EntryType.WORK).reduce((s, l) => s + l.durationMinutes, 0);

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

        const dayLogs = empLogs.filter(l => l.date === dateStr);
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
// --- End Memoized Row Component ---

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
  getNow: () => Date;
}

const EmployerView: React.FC<EmployerViewProps> = ({ 
  logs, users, onAddUser, onUpdateUser, onDeleteUser, 
  machines, onUpdateMachines, positions, onUpdatePositions, onImportData, onLogsUpsert, activeShiftsMap = {}, onActiveShiftsUpdate, onDeleteLog,
  onRefresh, isSyncing = false, nightShiftBonusMinutes, onUpdateNightBonus, currentOrg, plans, onUpdateOrg, currentUser: propCurrentUser, onMonthChange, getNow
}) => {
  const [filterMonth, setFilterMonth] = useState(format(getNow(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll'>('analytics');
  const [editingLog, setEditingLog] = useState<{ userId: string; date: string } | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
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
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(getNow(), i), 'yyyy-MM-dd'));
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
  }, [currentOrg, filterMonth, logs, getNow]);

  const employees = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Расчет текущих лимитов
  const planLimits = useMemo(() => {
    if (!currentOrg) return PLAN_LIMITS[PlanType.FREE];
    const dynamicPlan = plans.find(p => p.type === currentOrg.plan);
    return dynamicPlan ? dynamicPlan.limits : PLAN_LIMITS[currentOrg.plan];
  }, [currentOrg, plans]);

  const isUserLimitReached = users.length >= planLimits.maxUsers;
  const isMachineLimitReached = machines.length >= planLimits.maxMachines;

  const days = getDaysInMonthArray(filterMonth);
  const today = startOfDay(getNow());

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

  const dashboardStats = useMemo(() => {
    const todayStr = format(getNow(), 'yyyy-MM-dd');
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
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(getNow(), i), 'yyyy-MM-dd'));
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
  }, [logs, employees, filterMonth, activeShiftsMap, serverStats, getNow]);

  // Функция для принудительного завершения смены администратором
  const handleForceFinish = async (log: WorkLog) => {
    const empName = users.find(u => u.id === log.userId)?.name || 'сотрудника';
    const mName = machines.find(m => m.id === log.machineId)?.name || 'Работа';
    
    if (!confirm(`Вы действительно хотите принудительно завершить смену (${mName}) для ${empName}? Таймер сотрудника будет остановлен, оборудование станет свободным.`)) return;

    const now = getNow();
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

  const virtuosoData = useMemo(() => {
    const rows: any[] = [];
    employees.forEach(emp => {
      const empLogs = logs.filter(l => l.userId === emp.id && l.date.startsWith(filterMonth));
      rows.push({ type: 'employee', emp, empLogs });
      if (expandedTurnerRows.has(emp.id)) {
        const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId).map(l => l.machineId!))];
        usedMachineIds.forEach(mId => {
          rows.push({ type: 'machine', emp, mId, empLogs });
        });
      }
    });
    return rows;
  }, [employees, expandedTurnerRows, logs, filterMonth]);

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

  const saveCorrection = (logId: string, val: number, fine?: number) => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;
    
    const note = tempNotes[logId] !== undefined ? tempNotes[logId] : (log.correctionNote || '');
    const updatedLog = { 
      ...log, 
      durationMinutes: val, 
      isCorrected: true, 
      correctionNote: note,
      correctionTimestamp: getNow().toISOString(),
      fine: fine !== undefined ? fine : log.fine
    };
    
    onLogsUpsert([updatedLog]);
  };

  const handleUpdateMachinesList = (newMachines: Machine[]) => onUpdateMachines(newMachines);
  
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

  const handleUpdatePayrollConfig = (key: keyof PayrollConfig, value: any) => {
    if (!configuringPosition) return;
    const currentPayroll = configuringPosition.payroll || DEFAULT_PAYROLL_CONFIG;
    const updated = {
      ...configuringPosition,
      payroll: {
        ...currentPayroll,
        [key]: value
      }
    };
    setConfiguringPosition(updated);
    const newPositions = positions.map(p => p.name === updated.name ? updated : p);
    onUpdatePositions(newPositions);
  };

  const handleUpdateEmployeePayroll = (key: keyof PayrollConfig, value: any) => {
    if (!editingEmployee) return;
    // If user has no payroll override, start with position default or global default
    const basePayroll = editingEmployee.payroll || 
                        positions.find(p => p.name === editingEmployee.position)?.payroll || 
                        DEFAULT_PAYROLL_CONFIG;
                        
    setEditingEmployee({
      ...editingEmployee,
      payroll: {
        ...basePayroll,
        [key]: value
      }
    });
  };

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

  const saveEmployeeEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      onUpdateUser(editingEmployee);
      setEditingEmployee(null);
    }
  };

  const saveMachineEdit = (id: string) => {
    if (!editValue.trim()) return;
    const newMachines = machines.map(m => m.id === id ? { ...m, name: editValue } : m);
    handleUpdateMachinesList(newMachines);
    setEditingMachineId(null);
    setEditValue('');
  };

  const savePositionEdit = (oldName: string) => {
    if (!editValue.trim() || oldName === FIXED_POSITION_TURNER) return;
    const newPositions = positions.map(p => p.name === oldName ? { ...p, name: editValue } : p);
    onUpdatePositions(newPositions);
    users.forEach(u => {
      if (u.position === oldName) {
        onUpdateUser({ ...u, position: editValue });
      }
    });
    setEditingPositionName(null);
    setEditValue('');
  };

  const tabs = useMemo(() => {
    const allTabs = [
      { id: 'analytics', label: 'Дашборд' },
      { id: 'matrix', label: 'Табель' },
      { id: 'payroll', label: 'Зарплата' },
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

      {configuringPosition && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                   <h3 className="font-black text-slate-900 uppercase tracking-tight">Конструктор функций</h3>
                   <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{configuringPosition.name}</p>
                </div>
                <button onClick={() => setConfiguringPosition(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light transition-colors">&times;</button>
             </div>
             <div className="p-8 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {[
                  { key: 'isFullAdmin', label: 'Администратор', desc: 'Должность обладает всеми правами Администратора' },
                  { key: 'isLimitedAdmin', label: 'Менеджер', desc: 'Доступ только к вкладкам Дашборд и Табель' },
                  { key: 'useMachines', label: 'Работа на станках', desc: 'Возможность выбирать оборудование при начале смены' },
                  { key: 'multiSlot', label: 'Мульти-слот (3 карточки)', desc: 'Одновременная работа на 3 станках (для токарей)' },
                  { key: 'canUseNightShift', label: 'Ночная смена', desc: 'Возможность включать ночной режим работы с бонусом времени', isPro: true },
                  { key: 'viewSelfMatrix', label: 'Вкладка «Мой Табель»', desc: 'Доступ сотрудника к своей статистике' },
                  { key: 'markAbsences', label: 'Регистрация пропусков', desc: 'Возможность отмечать Б, О, В самостоятельно' },
                  { key: 'defaultRequirePhoto', label: 'Обязательное фото', desc: 'Фотофиксация при каждом начале/конце смены', isPro: true },
                ].map((item) => {
                  const isBlocked = (item.key === 'canUseNightShift' && !planLimits.features.nightShift) || 
                                    (item.key === 'defaultRequirePhoto' && !planLimits.features.photoCapture);
                  
                  return (
                    <label key={item.key} className={`flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white transition-all group ${isBlocked ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                      <div className="flex-1 pr-4">
                         <div className="flex items-center gap-2">
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.label}</p>
                           {isBlocked && <span className="text-[7px] font-black bg-blue-600 text-white px-1 py-0.5 rounded uppercase">PRO</span>}
                         </div>
                         <p className="text-[9px] font-bold text-slate-400 leading-tight mt-0.5">{item.desc}</p>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={(configuringPosition.permissions as any)[item.key]} 
                          onChange={() => handlePermissionToggle(item.key as any)}
                        />
                        <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-sm ${isBlocked ? 'bg-slate-300' : ''}`}></div>
                      </div>
                    </label>
                  );
                })}

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 mt-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">Финансовые условия (по умолчанию)</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Тип оплаты</label>
                    <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                      {(['hourly', 'fixed', 'shift'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => handleUpdatePayrollConfig('type', type)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(configuringPosition.payroll?.type || DEFAULT_PAYROLL_CONFIG.type) === type ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {type === 'hourly' ? 'Почасовая' : type === 'fixed' ? 'Оклад' : 'За смену'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ставка (₽)</label>
                       <input 
                         type="number" 
                         value={configuringPosition.payroll?.rate ?? DEFAULT_PAYROLL_CONFIG.rate}
                         onChange={e => handleUpdatePayrollConfig('rate', Number(e.target.value))}
                         className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Коэф. переработок</label>
                       <input 
                         type="number" 
                         step="0.1"
                         value={configuringPosition.payroll?.overtimeMultiplier ?? DEFAULT_PAYROLL_CONFIG.overtimeMultiplier}
                         onChange={e => handleUpdatePayrollConfig('overtimeMultiplier', Number(e.target.value))}
                         className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                       />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (₽)</label>
                     <input 
                       type="number" 
                       value={configuringPosition.payroll?.nightShiftBonus ?? DEFAULT_PAYROLL_CONFIG.nightShiftBonus}
                       onChange={e => handleUpdatePayrollConfig('nightShiftBonus', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Макс. длительность смены (часов)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      min="0"
                      max="24"
                      value={configuringPosition.permissions.maxShiftDurationMinutes ? configuringPosition.permissions.maxShiftDurationMinutes / 60 : ''}
                      onChange={(e) => {
                        const hours = parseInt(e.target.value || '0');
                        const next = {
                          ...configuringPosition,
                          permissions: {
                            ...configuringPosition.permissions,
                            maxShiftDurationMinutes: hours > 0 ? hours * 60 : undefined
                          }
                        };
                        setConfiguringPosition(next);
                        // Also update in the main list to ensure it saves
                        onUpdatePositions(positions.map(p => p.name === next.name ? next : p));
                      }}
                      placeholder="Без ограничений"
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Часов</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight">Смена будет автоматически завершена или подсвечена при превышении этого времени.</p>
                </div>
                <button 
                  onClick={() => setConfiguringPosition(null)} 
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl hover:bg-slate-800 transition-all active:scale-95 sticky bottom-0"
                >
                  Готово
                </button>
             </div>
          </div>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Редактировать сотрудника</h3>
                <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-900 text-2xl font-light">&times;</button>
             </div>
             <form onSubmit={saveEmployeeEdit} className="p-8 space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ФИО</label>
                   <input 
                     required 
                     type="text" 
                     value={editingEmployee.name} 
                     onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} 
                     className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" 
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Должность</label>
                   <select 
                     value={editingEmployee.position} 
                     onChange={e => setEditingEmployee({...editingEmployee, position: e.target.value})} 
                     className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white"
                   >
                     {positions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">PIN-код</label>
                      <input 
                        type="text" 
                        maxLength={4} 
                        value={editingEmployee.pin} 
                        onChange={e => setEditingEmployee({...editingEmployee, pin: e.target.value.replace(/[^0-9]/g, '')})} 
                        className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono font-black text-blue-600" 
                      />
                   </div>
                   <div className="flex flex-col justify-end">
                      <div className={`flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 h-[52px] ${!planLimits.features.photoCapture ? 'opacity-50' : ''}`}>
                         <input 
                           disabled={!planLimits.features.photoCapture}
                           type="checkbox" 
                           checked={editingEmployee.requirePhoto} 
                           onChange={e => setEditingEmployee({...editingEmployee, requirePhoto: e.target.checked})} 
                           className="w-5 h-5 rounded accent-blue-600" 
                           id="edit-req-photo" 
                         />
                         <label htmlFor="edit-req-photo" className="text-[9px] font-black text-slate-600 uppercase cursor-pointer">
                            Фото {!planLimits.features.photoCapture && 'PRO'}
                         </label>
                      </div>
                   </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Финансы (Персонально)</p>
                   
                   <div className="space-y-1">
                    <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                      {(['hourly', 'fixed', 'shift'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleUpdateEmployeePayroll('type', type)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(editingEmployee.payroll?.type || positions.find(p => p.name === editingEmployee.position)?.payroll?.type || DEFAULT_PAYROLL_CONFIG.type) === type ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {type === 'hourly' ? 'Почасовая' : type === 'fixed' ? 'Оклад' : 'За смену'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ставка (₽)</label>
                       <input 
                         type="number" 
                         value={editingEmployee.payroll?.rate ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.rate || DEFAULT_PAYROLL_CONFIG.rate)}
                         onChange={e => handleUpdateEmployeePayroll('rate', Number(e.target.value))}
                         className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Коэф. переработок</label>
                       <input 
                         type="number" 
                         step="0.1"
                         value={editingEmployee.payroll?.overtimeMultiplier ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.overtimeMultiplier || DEFAULT_PAYROLL_CONFIG.overtimeMultiplier)}
                         onChange={e => handleUpdateEmployeePayroll('overtimeMultiplier', Number(e.target.value))}
                         className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                       />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (₽)</label>
                     <input 
                       type="number" 
                       value={editingEmployee.payroll?.nightShiftBonus ?? (positions.find(p => p.name === editingEmployee.position)?.payroll?.nightShiftBonus || DEFAULT_PAYROLL_CONFIG.nightShiftBonus)}
                       onChange={e => handleUpdateEmployeePayroll('nightShiftBonus', Number(e.target.value))}
                       className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                     />
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-3">
                   <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest text-center">Безопасность и доступ</p>
                   <button 
                     type="button" 
                     onClick={() => setEditingEmployee({...editingEmployee, forcePinChange: true})}
                     className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${editingEmployee.forcePinChange ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-100'}`}
                   >
                     {editingEmployee.forcePinChange ? 'PIN будет сброшен при входе' : 'Сбросить PIN при входе'}
                   </button>
                   <button 
                     type="button" 
                     onClick={handleResetDevicePairing}
                     className="w-full py-3 bg-white text-amber-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 border-amber-200 hover:bg-amber-100"
                   >
                     Сбросить привязку устройства
                   </button>
                </div>

                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest mt-2">Сохранить изменения</button>
             </form>
          </div>
        </div>
      )}

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
                  <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-5 space-y-4 relative group">
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
                      const machineName = machine?.name || 'Работа';
                      const isOld = s.date !== dashboardStats.todayStr;
                      
                      return (
                        <div key={s.id} className={`group/item flex justify-between items-center p-3 rounded-xl border transition-all ${isOld ? 'bg-red-50 border-red-200 hover:bg-white shadow-sm' : 'bg-blue-50 border-blue-100 hover:bg-white'}`}>
                           <div className="flex-1 pr-2">
                              <span className={`text-xs font-bold block truncate ${isOld ? 'text-red-900' : 'text-slate-700'}`}>{emp?.name}</span>
                              <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 flex items-center gap-1 ${isOld ? 'text-red-500' : 'text-blue-500'}`}>
                                {s.isNightShift && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                                {machineName}
                              </span>
                           </div>
                           <div className="flex items-center gap-2">
                             <div className="flex flex-col items-end">
                               {isOld && (
                                 <span className="text-[8px] font-black text-red-600 uppercase mb-0.5 tracking-tighter">
                                   Начало: {format(new Date(s.date), 'dd.MM')}
                                 </span>
                               )}
                               <span className={`text-[10px] font-black bg-white px-2 py-0.5 rounded-lg border ${isOld ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-100'}`}>
                                 {formatTime(s.checkIn)}
                               </span>
                             </div>
                             <div className="flex flex-col items-center gap-1">
                                {userPerms.isFullAdmin && (
                                <button 
                                   onClick={() => handleForceFinish(s)}
                                   className={`hidden group-hover/item:flex items-center justify-center p-1.5 text-white rounded-lg transition-colors shadow-sm ${isOld ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}
                                   title="Принудительно завершить"
                                >
                                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                )}
                                <span className={`hidden group-hover/item:block text-[6px] font-black uppercase leading-none tracking-tighter ${isOld ? 'text-red-600' : 'text-red-400'}`}>СТОП {machineName.split(' ')[0]}</span>
                             </div>
                           </div>
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
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                 {s.isNightShift && <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                                 {emp?.name}
                              </span>
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
                      <MemoizedUserMatrixRowCells
                        emp={row.emp}
                        empLogs={row.empLogs}
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
                          {activeLogs.map(log => {
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

      {viewMode === 'payroll' && (
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
                   const empLogs = logs.filter(l => l.userId === emp.id && l.date.startsWith(filterMonth));
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
      )}

      {viewMode === 'settings' && (
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
                                  // Rollback if needed, but usually we just log it
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
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724(0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
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
      )}
    </div>
  );
};

export default EmployerView;
