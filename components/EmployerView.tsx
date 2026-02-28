
import React, { useState, useMemo, useEffect } from 'react';
import { WorkLog, User, EntryType, UserRole, Machine, FIXED_POSITION_TURNER, PositionConfig, PositionPermissions, Organization, PlanType, Plan, PayrollConfig } from '../types';
import { getDaysInMonthArray, formatTime, calculateMinutes } from '../utils';
import { format } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { subDays } from 'date-fns/subDays';
import { DEFAULT_PERMISSIONS, STORAGE_KEYS, PLAN_LIMITS, DEFAULT_PAYROLL_CONFIG } from '../constants';
import { db } from '../lib/supabase';
import { SettingsView } from './employer/SettingsView';
import { BillingView } from './employer/BillingView';
import { PayrollView } from './employer/PayrollView';
import { AnalyticsView } from './employer/AnalyticsView';
import { TeamView } from './employer/TeamView';
import { MatrixView } from './employer/MatrixView';
import { PositionConfigModal } from './employer/PositionConfigModal';
import { EmployeeEditModal } from './employer/EmployeeEditModal';
import { LogEditModal } from './employer/LogEditModal';
import { PhotoPreviewModal } from './employer/PhotoPreviewModal';

interface EmployerViewProps {
  logs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
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
  logs, logsLookup = {}, users, onAddUser, onUpdateUser, onDeleteUser, 
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
  const canUsePayroll = planLimits.features.payroll;

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
    
    // Use logsLookup for faster access to today's logs
    const todayLogs: WorkLog[] = [];
    if (logsLookup) {
      Object.values(logsLookup).forEach(userDates => {
        if (userDates[todayStr]) {
          todayLogs.push(...userDates[todayStr]);
        }
      });
    }
    
    // Собираем активные смены из двух источников: из логов и из карты активных смен
    const activeFromLogs: WorkLog[] = [];
    if (logsLookup) {
      Object.values(logsLookup).forEach(userDates => {
        Object.values(userDates).forEach(dateLogs => {
          dateLogs.forEach(l => {
            if (l.entryType === EntryType.WORK && !l.checkOut) {
              activeFromLogs.push(l);
            }
          });
        });
      });
    }

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
      const weekLogs: WorkLog[] = [];
      const monthLogs: WorkLog[] = [];
      
      employees.forEach(emp => {
        const userLogsMap = logsLookup[emp.id] || {};
        Object.keys(userLogsMap).forEach(date => {
          if (last7Days.includes(date)) {
            weekLogs.push(...userLogsMap[date].filter(l => l.entryType === EntryType.WORK));
          }
          if (date.startsWith(filterMonth)) {
            monthLogs.push(...userLogsMap[date]);
          }
        });
      });

      const totalWeeklyMinutes = weekLogs.reduce((s, l) => s + l.durationMinutes, 0);
      avgWeeklyHours = (totalWeeklyMinutes / 60) / 7;

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
  }, [logsLookup, employees, filterMonth, activeShiftsMap, serverStats, getNow]);

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
      const userLogsMap = logsLookup[emp.id] || {};
      const empLogs: WorkLog[] = [];
      
      // Get only logs for the current filterMonth
      Object.keys(userLogsMap).forEach(date => {
        if (date.startsWith(filterMonth)) {
          empLogs.push(...userLogsMap[date]);
        }
      });

      rows.push({ type: 'employee', emp, empLogs });
      if (expandedTurnerRows.has(emp.id)) {
        const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId).map(l => l.machineId!))];
        usedMachineIds.forEach(mId => {
          rows.push({ type: 'machine', emp, mId, empLogs });
        });
      }
    });
    return rows;
  }, [employees, expandedTurnerRows, logsLookup, filterMonth]);

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
        <PhotoPreviewModal previewPhoto={previewPhoto} setPreviewPhoto={setPreviewPhoto} />
      )}

      {configuringPosition && (
        <PositionConfigModal
          configuringPosition={configuringPosition}
          setConfiguringPosition={setConfiguringPosition}
          planLimits={planLimits}
          handlePermissionToggle={handlePermissionToggle}
          canUsePayroll={canUsePayroll}
          handleUpdatePayrollConfig={handleUpdatePayrollConfig}
          positions={positions}
          onUpdatePositions={onUpdatePositions}
        />
      )}

      {editingEmployee && (
        <EmployeeEditModal
          editingEmployee={editingEmployee}
          setEditingEmployee={setEditingEmployee}
          saveEmployeeEdit={saveEmployeeEdit}
          positions={positions}
          planLimits={planLimits}
          canUsePayroll={canUsePayroll}
          handleUpdateEmployeePayroll={handleUpdateEmployeePayroll}
          handleResetDevicePairing={handleResetDevicePairing}
        />
      )}

      {editingLog && (
        <LogEditModal
          editingLog={editingLog}
          setEditingLog={setEditingLog}
          logs={logs}
          users={users}
          machines={machines}
          deleteLogItem={deleteLogItem}
          setPreviewPhoto={setPreviewPhoto}
          formatTime={formatTime}
          saveCorrection={saveCorrection}
          tempNotes={tempNotes}
          setTempNotes={setTempNotes}
        />
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
        <AnalyticsView
          dashboardStats={dashboardStats}
          users={users}
          machines={machines}
          userPerms={userPerms}
          handleForceFinish={handleForceFinish}
        />
      )}

      {viewMode === 'matrix' && (
        <MatrixView
          filterMonth={filterMonth}
          virtuosoData={virtuosoData}
          days={days}
          today={today}
          expandedTurnerRows={expandedTurnerRows}
          toggleTurnerRow={toggleTurnerRow}
          setEditingLog={setEditingLog}
          machines={machines}
          virtuosoComponents={virtuosoComponents}
          logsLookup={logsLookup}
        />
      )}

      {viewMode === 'team' && (
        <TeamView
          users={users}
          positions={positions}
          planLimits={planLimits}
          currentOrg={currentOrg}
          isUserLimitReached={isUserLimitReached}
          newUser={newUser}
          setNewUser={setNewUser}
          handleAddUser={handleAddUser}
          dashboardStats={dashboardStats}
          machines={machines}
          userPerms={userPerms}
          handleForceFinish={handleForceFinish}
          setEditingEmployee={setEditingEmployee}
          onDeleteUser={onDeleteUser}
        />
      )}

      {viewMode === 'billing' && (
        <BillingView
          currentOrg={currentOrg}
          plans={plans}
          planLimits={planLimits}
          users={users}
          machines={machines}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          isApplyingPromo={isApplyingPromo}
          handleApplyPromo={handleApplyPromo}
          promoMessage={promoMessage}
        />
      )}

      {viewMode === 'payroll' && (
        <PayrollView
          users={users}
          logs={logs}
          logsLookup={logsLookup}
          positions={positions}
          filterMonth={filterMonth}
          handleExportAll={handleExportAll}
        />
      )}

      {viewMode === 'settings' && (
        <SettingsView
          planLimits={planLimits}
          nightShiftBonusMinutes={nightShiftBonusMinutes}
          onUpdateNightBonus={onUpdateNightBonus}
          currentOrg={currentOrg}
          onUpdateOrg={onUpdateOrg}
          machines={machines}
          isMachineLimitReached={isMachineLimitReached}
          newMachineName={newMachineName}
          setNewMachineName={setNewMachineName}
          handleUpdateMachinesList={handleUpdateMachinesList}
          editingMachineId={editingMachineId}
          setEditingMachineId={setEditingMachineId}
          editValue={editValue}
          setEditValue={setEditValue}
          saveMachineEdit={saveMachineEdit}
          positions={positions}
          newPositionName={newPositionName}
          setNewPositionName={setNewPositionName}
          onUpdatePositions={onUpdatePositions}
          editingPositionName={editingPositionName}
          setEditingPositionName={setEditingPositionName}
          savePositionEdit={savePositionEdit}
          setConfiguringPosition={setConfiguringPosition}
          handleExportAll={handleExportAll}
          handleFileImport={handleFileImport}
        />
      )}
    </div>
  );
};

export default EmployerView;
