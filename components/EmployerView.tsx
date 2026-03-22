
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { WorkLog, User, EntryType, UserRole, Machine, FIXED_POSITION_TURNER, PositionConfig, PositionPermissions, Organization, PlanType, Plan, PayrollConfig, PlanLimits, Branch, PayrollPeriod, PayrollStatus, PayrollSnapshot } from '../types';
import { getDaysInMonthArray, formatTime, calculateMinutes, calculateMonthlyPayroll, getEffectivePayrollConfig } from '../utils';
import { format, startOfDay, subDays } from 'date-fns';
import { DEFAULT_PERMISSIONS, STORAGE_KEYS, PLAN_LIMITS, DEFAULT_PAYROLL_CONFIG } from '../constants';
import { db } from '../lib/supabase';
import { SettingsView } from './employer/SettingsView';
import { BillingView } from './employer/BillingView';
import { AuditLogView } from './employer/AuditLogView';
import { PayrollView } from './employer/PayrollView';
import { AnalyticsView } from './employer/AnalyticsView';
import { TeamView } from './employer/TeamView';
import { MatrixView } from './employer/MatrixView';
import { PositionConfigModal } from './employer/PositionConfigModal';
import { EmployeeEditModal } from './employer/EmployeeEditModal';
import { LogEditModal } from './employer/LogEditModal';
import { PhotoPreviewModal } from './employer/PhotoPreviewModal';
import { SupportChat } from './employer/SupportChat';
import { DocumentationView } from './DocumentationView';
import { logAuditAction } from '../lib/audit';
import { MessageSquare } from 'lucide-react';

interface EmployerViewProps {
  logs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string, reason?: string) => void;
  machines: Machine[];
  onUpdateMachines: (machines: Machine[], deletedMachineInfo?: { id: string, reason: string }[]) => void;
  positions: PositionConfig[];
  onUpdatePositions: (positions: PositionConfig[]) => void;
  branches: Branch[];
  onUpdateBranches: (branch: Branch) => void;
  onDeleteBranch: (branchId: string) => void;
  onImportData: (data: string) => void;
  onLogsUpsert: (logs: WorkLog[]) => void;
  activeShiftsMap?: Record<string, any>;
  onActiveShiftsUpdate: (userId: string, shifts: any) => void;
  onDeleteLog: (logId: string) => void;
  onRefresh?: () => Promise<void>;
  forceCleanAll?: () => void;
  onCleanupDatabase?: () => Promise<void>;
  onRemoveBase64Photos?: () => Promise<void>;
  onRunDiagnostics?: () => Promise<void>;
  onMergeDuplicates?: () => Promise<void>;
  onFixDbStructure?: () => Promise<void>;
  isSyncing?: boolean;
  nightShiftBonusMinutes: number;
  onUpdateNightBonus: (minutes: number) => void;
  currentOrg: Organization | null;
  plans: Plan[];
  onUpdateOrg: (org: Organization) => void;
  currentUser?: User | null;
  onMonthChange?: (month: string) => void;
  payments: any[];
  onSavePayment: (payment: any) => void;
  onDeletePayment: (id: string) => void;
  getArchivedUsers: () => Promise<User[] | null>;
  getArchivedMachines: () => Promise<Machine[] | null>;
  onRestoreUser: (id: string) => Promise<{ error: any }>;
  onRestoreMachine: (id: string) => Promise<{ error: any }>;
  getNow: () => Date;
  viewMode: 'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit' | 'instructions';
  setViewMode: (mode: 'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit' | 'instructions') => void;
  unreadSupportMessages?: number;
  onResetUnread?: (orgId?: string) => void;
}

const EmployerView: React.FC<EmployerViewProps> = ({ 
  logs, logsLookup = {}, users, onAddUser, onUpdateUser, onDeleteUser, 
  machines, onUpdateMachines, positions, onUpdatePositions, branches, onUpdateBranches, onDeleteBranch, onImportData, onLogsUpsert, activeShiftsMap = {}, onActiveShiftsUpdate, onDeleteLog,
  onRefresh, forceCleanAll, onCleanupDatabase, onRemoveBase64Photos, onRunDiagnostics, onMergeDuplicates, onFixDbStructure, isSyncing = false, nightShiftBonusMinutes, onUpdateNightBonus, currentOrg, plans, onUpdateOrg, currentUser: propCurrentUser, onMonthChange, payments, onSavePayment, onDeletePayment, getArchivedUsers, getArchivedMachines, onRestoreUser, onRestoreMachine, getNow, viewMode, setViewMode, unreadSupportMessages = 0, onResetUnread
}) => {
  const [filterMonth, setFilterMonth] = useState(format(getNow(), 'yyyy-MM'));
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<{ userId: string; date: string } | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [editingMachineBranchId, setEditingMachineBranchId] = useState<string | undefined>(undefined);
  const [editingPositionName, setEditingPositionName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [configuringPosition, setConfiguringPosition] = useState<PositionConfig | null>(null);
  const [expandedTurnerRows, setExpandedTurnerRows] = useState<Set<string>>(new Set());
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [newUser, setNewUser] = useState<{ name: string; position: string; department: string; pin: string; requirePhoto: boolean; branchId?: string }>({ name: '', position: positions[0]?.name || '', department: '', pin: '0000', requirePhoto: false, branchId: '' });
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineBranchId, setNewMachineBranchId] = useState('');
  const [newPositionName, setNewPositionName] = useState('');
  
  const [serverStats, setServerStats] = useState<{ avgWeeklyHours: number, absenceCounts: any[] } | null>(null);
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentOrg) return;
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(getNow(), i), 'yyyy-MM-dd'));
      const [stats, period] = await Promise.all([
        db.getDashboardStats(currentOrg.id, filterMonth, last7Days),
        db.getPayrollPeriod(currentOrg.id, filterMonth)
      ]);
      if (stats) {
        setServerStats({
          avgWeeklyHours: (stats.total_weekly_minutes / 60) / 7,
          absenceCounts: stats.top_absences || []
        });
      } else {
        setServerStats(null);
      }
      setPayrollPeriod(period);
    };
    fetchStats();
  }, [currentOrg, filterMonth, logs, getNow]);

  const isPaid = payrollPeriod?.status === PayrollStatus.PAID;

  const filteredUsers = useMemo(() => {
    if (!selectedBranchId) return users;
    return users.filter(u => u.branchId === selectedBranchId);
  }, [users, selectedBranchId]);

  useEffect(() => {
    console.log('All users:', users);
  }, [users]);

  const employees = useMemo(() => {
    return [...filteredUsers].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredUsers]);

  const filteredMachines = useMemo(() => {
    const periodStartDate = `${filterMonth}-01`;
    const periodEndDate = `${filterMonth}-31`;
    
    return machines.filter(m => {
      if (selectedBranchId && m.branchId !== selectedBranchId) return false;
      
      // If created after the period ends, they shouldn't be here
      if (m.createdAt && m.createdAt > periodEndDate) return false;
      
      // If archived before the period starts, they shouldn't be here
      if (m.isArchived && m.archivedAt && m.archivedAt < periodStartDate) return false;
      
      return true;
    });
  }, [machines, selectedBranchId, filterMonth]);

  // Расчет текущих лимитов
  const planLimits = useMemo(() => {
    const rawPlan = currentOrg?.plan || PlanType.FREE;
    const currentPlanType = String(rawPlan).toUpperCase() as PlanType;
    const baseLimits = PLAN_LIMITS[currentPlanType] || PLAN_LIMITS[PlanType.FREE];
    
    const dynamicPlan = plans.find(p => p.type.toUpperCase() === currentPlanType);
    if (!dynamicPlan) return baseLimits;

    // Merge dynamic limits with base limits to ensure all features are present
    return {
      ...baseLimits,
      ...dynamicPlan.limits,
      features: {
        ...baseLimits.features,
        ...(dynamicPlan.limits?.features || {})
      }
    };
  }, [currentOrg, plans]);

  const isUserLimitReached = users.length >= planLimits.maxUsers;
  const isMachineLimitReached = machines.length >= planLimits.maxMachines;
  const canUsePayroll = planLimits.features.payroll;

  useEffect(() => {
    if (viewMode === 'payroll' && !canUsePayroll) {
      setViewMode('analytics');
    }
  }, [viewMode, canUsePayroll]);

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

  const handleSetEditingLog = (data: { userId: string; date: string } | null) => {
    if (data && isPaid) {
      alert('Финансовый период закрыт. Изменение данных заблокировано.');
      return;
    }
    setEditingLog(data);
  };

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Detailed Logs
    const detailedData: any[] = [];
    employees.forEach(emp => {
      const userLogsMap = logsLookup[emp.id] || {};
      Object.keys(userLogsMap).forEach(date => {
        if (date.startsWith(filterMonth)) {
          userLogsMap[date].forEach(log => {
             detailedData.push({
               'Сотрудник': emp.name,
               'Должность': emp.position,
               'Дата': date,
               'Тип': log.entryType === EntryType.WORK ? 'Смена' : (log.entryType === EntryType.SICK ? 'Больничный' : 'Отпуск'),
               'Начало': log.checkIn ? formatTime(log.checkIn) : '-',
               'Конец': log.checkOut ? formatTime(log.checkOut) : '-',
               'Длительность (мин)': log.durationMinutes,
               'Длительность (ч)': (log.durationMinutes / 60).toFixed(2),
               'Оборудование': machines.find(m => m.id === log.machineId)?.name || '-',
               'Заметка': log.correctionNote || '-'
             });
          });
        }
      });
    });
    
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, wsDetailed, "Детально");

    // Sheet 2: Matrix (Timesheet)
    const matrixData: any[] = [];
    
    employees.forEach(emp => {
       const row: any = { 'Сотрудник': emp.name };
       let totalMinutes = 0;
       
       days.forEach(day => {
         const dateStr = format(day, 'yyyy-MM-dd');
         const dayLogs = logsLookup[emp.id]?.[dateStr] || [];
         const dayMinutes = dayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
         totalMinutes += dayMinutes;
         
         // Format cell value
         let cellValue: string | number = '';
         if (dayMinutes > 0) {
           cellValue = Number((dayMinutes / 60).toFixed(1));
         } else {
            const nonWork = dayLogs.find(l => l.entryType !== EntryType.WORK);
            if (nonWork) {
               cellValue = nonWork.entryType === EntryType.SICK ? 'Б' : 'О';
            }
         }
         row[day.getDate().toString()] = cellValue;
       });
       
       row['Итого (ч)'] = Number((totalMinutes / 60).toFixed(1));
       matrixData.push(row);
    });
    
    const wsMatrix = XLSX.utils.json_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Табель");

    XLSX.writeFile(wb, `timesheet_${filterMonth}.xlsx`);
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
    
    // Собираем активные смены из двух источников: из логов и из карты активных смен
    const activeFromLogs: WorkLog[] = [];
    if (logsLookup) {
      filteredUsers.forEach(u => {
        const userDates = logsLookup[u.id];
        if (userDates) {
          Object.values(userDates).forEach(dateLogs => {
            dateLogs.forEach(l => {
              if (l.entryType === EntryType.WORK && !l.checkOut) {
                activeFromLogs.push(l);
              }
            });
          });
        }
      });
    }

    const activeFromMap: WorkLog[] = [];
    
    filteredUsers.forEach(u => {
      const userShifts = activeShiftsMap[u.id];
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

    const finishedToday = logs.filter(l => 
      l.entryType === EntryType.WORK && 
      l.checkOut && 
      l.checkOut.startsWith(todayStr)
    );

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

      let totalWeeklyMinutes = 0;
      last7Days.forEach(date => {
        employees.forEach(emp => {
          const dayLogs = (logsLookup[emp.id] || {})[date] || [];
          const workLogs = dayLogs.filter(l => l.entryType === EntryType.WORK);
          const machineTotals: Record<string, number> = {};
          workLogs.forEach(l => {
            const mid = l.machineId || 'unknown';
            machineTotals[mid] = (machineTotals[mid] || 0) + l.durationMinutes;
          });
          totalWeeklyMinutes += Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
        });
      });
      avgWeeklyHours = (totalWeeklyMinutes / 60) / 7;

      absenceCounts = employees.map(emp => {
        const absences = monthLogs.filter(l => l.userId === emp.id && (l.entryType === EntryType.SICK || l.entryType === EntryType.VACATION)).length;
        return { name: emp.name, count: absences };
      }).sort((a, b) => b.count - a.count).filter(a => a.count > 0).slice(0, 3);
    }

    const activeLogsMap: Record<string, WorkLog[]> = {};
    const orphanedActiveShifts: WorkLog[] = [];
    
    activeShifts.forEach(log => {
      if (!activeLogsMap[log.userId]) activeLogsMap[log.userId] = [];
      activeLogsMap[log.userId].push(log);
      
      if (!employees.some(e => e.id === log.userId)) {
        orphanedActiveShifts.push(log);
      }
    });

    return { activeShifts, finishedToday, avgWeeklyHours, absenceCounts, activeLogsMap, todayStr, orphanedActiveShifts };
  }, [logs, logsLookup, employees, filterMonth, activeShiftsMap, serverStats, getNow, filteredUsers]);

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

      // Keep if not archived, OR if archived but still within the period (created before end of period)
      // Actually, the user wants them to appear if they were created before the period ends, 
      // and they were not archived before the period started.
      const periodStartDate = `${filterMonth}-01`;
      const periodEndDate = `${filterMonth}-31`;
      
      const createdBeforePeriodEnd = emp.createdAt && emp.createdAt <= periodEndDate;
      const archivedBeforePeriodStart = emp.isArchived && emp.archivedAt && emp.archivedAt < periodStartDate;
      
      if (emp.isArchived && empLogs.length === 0 && (archivedBeforePeriodStart || !createdBeforePeriodEnd)) {
        return;
      }

      rows.push({ type: 'employee', emp, empLogs });
      if (expandedTurnerRows.has(emp.id)) {
        const usedMachineIds = [...new Set(empLogs.filter(l => l.machineId).map(l => l.machineId!))];
        usedMachineIds.forEach(mId => {
          rows.push({ type: 'machine', emp, mId, empLogs });
        });
      }
    });

    // Add orphaned users who have active shifts
    if (!selectedBranchId) {
      dashboardStats.orphanedActiveShifts.forEach(log => {
        if (!rows.some(r => r.type === 'employee' && r.emp.id === log.userId)) {
          const tempUser: User = {
            id: log.userId,
            name: `[?] ID: ${log.userId.substring(0, 5)}...`,
            role: UserRole.EMPLOYEE,
            position: 'Неизвестно (Ошибка привязки)',
            pin: '????',
            organizationId: currentOrg?.id || ''
          };
          const userLogsMap = logsLookup[log.userId] || {};
          const empLogs: WorkLog[] = [];
          Object.keys(userLogsMap).forEach(date => {
            if (date.startsWith(filterMonth)) {
              empLogs.push(...userLogsMap[date]);
            }
          });
          rows.push({ type: 'employee', emp: tempUser, empLogs, isOrphaned: true });
        }
      });
    }

    return rows;
  }, [employees, expandedTurnerRows, logsLookup, filterMonth, dashboardStats.orphanedActiveShifts, currentOrg, selectedBranchId]);

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
    if (currentOrg && currentUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'add_user',
        `Добавлен новый сотрудник ${user.name} (${user.position})`,
        user.id,
        user.name,
        `Имя: ${user.name}, Должность: ${user.position}, Отдел: ${user.department || 'Нет'}, PIN: ${user.pin}, Фотофиксация: ${user.requirePhoto}`
      );
    }
    setNewUser({ name: '', position: positions[0]?.name || '', department: '', pin: '0000', requirePhoto: false, branchId: '' });
  };

  const deleteLogItem = (logId: string) => {
    if (confirm('Удалить эту запись безвозвратно?')) {
      const log = logs.find(l => l.id === logId);
      onDeleteLog(logId);
      if (currentOrg && currentUser && log) {
        const targetUser = users.find(u => u.id === log.userId);
        logAuditAction(
          currentOrg.id,
          currentUser.id,
          currentUser.name,
          'delete_shift',
          `Удалена смена/запись за ${format(new Date(log.date), 'dd.MM.yyyy')}`,
          targetUser?.id,
          targetUser?.name
        );
      }
    }
  };

  const saveCorrection = (logId: string, val: number, fine?: number, bonus?: number, itemsProduced?: number) => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;
    
    const note = tempNotes[logId] !== undefined ? tempNotes[logId] : (log.correctionNote || '');
    const updatedLog = { 
      ...log, 
      durationMinutes: val, 
      isCorrected: true, 
      correctionNote: note,
      correctionTimestamp: getNow().toISOString(),
      fine: fine !== undefined ? fine : log.fine,
      bonus: bonus !== undefined ? bonus : log.bonus,
      itemsProduced: itemsProduced !== undefined ? itemsProduced : log.itemsProduced
    };
    
    if (currentOrg && currentUser) {
      const targetUser = users.find(u => u.id === log.userId);
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'edit_shift',
        `Изменена смена за ${format(new Date(log.date), 'dd.MM.yyyy')}: ${val} мин, штраф: ${fine || 0}, премия: ${bonus || 0}`,
        targetUser?.id,
        targetUser?.name,
        `Длительность: ${log.durationMinutes} -> ${val}, штраф: ${log.fine || 0} -> ${fine || 0}, премия: ${log.bonus || 0} -> ${bonus || 0}, произведено: ${log.itemsProduced || 0} -> ${itemsProduced || 0}`
      );
    }
    
    onLogsUpsert([updatedLog]);
  };

  const handleUpdateMachinesList = (newMachines: Machine[], deletedMachineInfo?: { id: string, reason: string }[]) => {
    const oldMachines = machines;
    onUpdateMachines(newMachines, deletedMachineInfo);
    if (currentOrg && currentUser) {
      let changes = '';
      const added = newMachines.filter(nm => !oldMachines.some(om => om.id === nm.id));
      const updated = newMachines.filter(nm => {
        const om = oldMachines.find(o => o.id === nm.id);
        return om && (om.name !== nm.name || om.branchId !== nm.branchId);
      });

      if (added.length > 0) changes += `Добавлено: ${added.map(m => m.name).join(', ')}. `;
      if (updated.length > 0) {
        changes += `Изменено: ${updated.map(nm => {
          const om = oldMachines.find(o => o.id === nm.id);
          return `${om?.name} -> ${nm.name}`;
        }).join(', ')}. `;
      }
      if (deletedMachineInfo && deletedMachineInfo.length > 0) {
        changes += `Удалено: ${deletedMachineInfo.map(d => {
          const m = oldMachines.find(om => om.id === d.id);
          return `${m?.name || d.id} (Причина: ${d.reason})`;
        }).join(', ')}. `;
      }

      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'edit_machines',
        `Изменен список оборудования`,
        undefined,
        undefined,
        changes.trim()
      );
    }
  };

  const handleDeleteUser = (userId: string, reason?: string) => {
    const targetUser = users.find(u => u.id === userId);
    onDeleteUser(userId, reason);
    if (currentOrg && currentUser && targetUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'delete_user',
        `Удален сотрудник ${targetUser.name}${reason ? ` (Причина: ${reason})` : ''}`,
        targetUser.id,
        targetUser.name
      );
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
    if (currentOrg && currentUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'edit_permissions',
        `Изменено разрешение "${key}" на ${!configuringPosition.permissions[key]} для должности "${updated.name}"`,
        undefined,
        undefined,
        `Разрешение: ${key}, Старое значение: ${configuringPosition.permissions[key]}, Новое значение: ${!configuringPosition.permissions[key]}`
      );
    }
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
    if (currentOrg && currentUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'edit_payroll_config',
        `Изменена настройка зарплаты "${key}" на "${value}" для должности "${updated.name}"`,
        undefined,
        undefined,
        `Настройка: ${key}, Старое значение: ${currentPayroll[key]}, Новое значение: ${value}`
      );
    }
  };

  const handleAddGeneralBonus = (userIds: string[], amount: number, date: string, note: string) => {
    const nowStr = getNow().toISOString();
    const newLogs: WorkLog[] = userIds.map(userId => ({
      id: crypto.randomUUID(),
      userId,
      date,
      entryType: EntryType.WORK,
      durationMinutes: 0,
      bonus: amount,
      correctionNote: note || 'Общая премия',
      isCorrected: true,
      correctionTimestamp: nowStr
    }));
    onLogsUpsert(newLogs);
    if (currentOrg && currentUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'add_bonus',
        `Добавлена премия ${amount} для ${userIds.length} сотрудников за ${date}. Примечание: ${note || 'Общая премия'}`
      );
    }
  };

  const handleRecalculateAll = async () => {
    if (!currentOrg) return;
    if (!confirm(`Пересчитать ВСЕ логи и График (план) за ${filterMonth}? Это обновит длительность смен согласно бонусу ночных смен (${currentOrg.nightShiftBonus || 0}%) и проставит 'Р' в графике там, где были выходы.`)) return;
    
    setIsRecalculating(true);
    try {
      // 1. Recalculate logs
      const logsToUpdate: WorkLog[] = [];
      const bonusPercent = currentOrg.nightShiftBonus || 0;
      logs.forEach(log => {
        if (log.checkIn && log.checkOut && log.entryType === EntryType.WORK) {
          const baseMinutes = calculateMinutes(log.checkIn, log.checkOut);
          let finalMinutes = baseMinutes;
          if (log.isNightShift && bonusPercent > 0) {
            finalMinutes += Math.floor(baseMinutes * (bonusPercent / 100));
          }
          if (finalMinutes !== log.durationMinutes) {
            logsToUpdate.push({ ...log, durationMinutes: finalMinutes });
          }
        }
      });
      if (logsToUpdate.length > 0) await onLogsUpsert(logsToUpdate);

      // 2. Update Planned Shifts (График)
      const usersToUpdate: User[] = [];
      users.forEach(user => {
        const userLogsMap = logsLookup[user.id] || {};
        const newPlannedShifts = { ...(user.plannedShifts || {}) };
        let changed = false;

        Object.keys(userLogsMap).forEach(date => {
          if (date.startsWith(filterMonth)) {
            const hasWork = userLogsMap[date]?.some(l => l.entryType === EntryType.WORK);
            if (hasWork && newPlannedShifts[date] !== 'Р') {
              newPlannedShifts[date] = 'Р';
              changed = true;
            }
          }
        });

        if (changed) {
          usersToUpdate.push({ ...user, plannedShifts: newPlannedShifts });
        }
      });

      for (const u of usersToUpdate) {
        await onUpdateUser(u);
      }

      // 3. Recalculate snapshots (for PayrollView)
      const updatedLogsLookup = { ...logsLookup };
      logsToUpdate.forEach(log => {
        if (!updatedLogsLookup[log.userId]) updatedLogsLookup[log.userId] = {};
        if (!updatedLogsLookup[log.userId][log.date]) updatedLogsLookup[log.userId][log.date] = [];
        const idx = updatedLogsLookup[log.userId][log.date].findIndex(l => l.id === log.id);
        if (idx !== -1) updatedLogsLookup[log.userId][log.date][idx] = log;
        else updatedLogsLookup[log.userId][log.date].push(log);
      });

      for (const emp of users) {
        if (emp.role !== UserRole.EMPLOYEE) continue;
        const userLogsMap = updatedLogsLookup[emp.id] || {};
        const empLogs: WorkLog[] = [];
        Object.keys(userLogsMap).forEach(date => {
          if (date.startsWith(filterMonth)) empLogs.push(...userLogsMap[date]);
        });

        const payroll = calculateMonthlyPayroll(emp, empLogs, positions, currentOrg || undefined);
        const config = getEffectivePayrollConfig(emp, positions);
        
        const snapshot: PayrollSnapshot = {
          id: `${emp.id}-${filterMonth}`,
          userId: emp.id,
          organizationId: currentOrg.id,
          month: filterMonth,
          totalMinutes: empLogs.filter(l => l.entryType === EntryType.WORK).reduce((sum, l) => sum + l.durationMinutes, 0),
          totalSalary: payroll.totalSalary,
          bonuses: payroll.bonuses,
          fines: payroll.fines,
          rateUsed: config.rate,
          rateType: config.type,
          calculatedAt: new Date().toISOString(),
          details: payroll
        };
        await db.savePayrollSnapshot(snapshot);
      }
      
      alert(`Пересчет завершен: обновлено ${logsToUpdate.length} смен и ${usersToUpdate.length} графиков сотрудников.`);
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error(e);
      alert('Ошибка при пересчете');
    } finally {
      setIsRecalculating(false);
    }
  };
  const handleUpdateEmployeePayroll = (key: keyof PayrollConfig, value: any) => {
    if (!editingEmployee) return;
    // If user has no payroll override, start with position default or global default
    const basePayroll = editingEmployee.payroll || 
                        positions.find(p => p.name === editingEmployee.position)?.payroll || 
                        DEFAULT_PAYROLL_CONFIG;
                        
    const newPayroll = {
      ...basePayroll,
      [key]: value
    };

    setEditingEmployee({
      ...editingEmployee,
      payroll: newPayroll
    });
    
    if (currentOrg && currentUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'edit_user_payroll',
        `Изменена настройка зарплаты "${key}" на "${value}" для сотрудника ${editingEmployee.name}`,
        editingEmployee.id,
        editingEmployee.name
      );
    }
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
        if (currentOrg && currentUser) {
          logAuditAction(
            currentOrg.id,
            currentUser.id,
            currentUser.name,
            'import_data',
            'Импорт данных из файла',
            undefined,
            undefined,
            `Размер файла: ${content.length} символов`
          );
        }
      }
    };
    reader.readAsText(file);
  };

  const saveEmployeeEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      const oldUser = users.find(u => u.id === editingEmployee.id);
      onUpdateUser(editingEmployee);
      if (currentOrg && currentUser && oldUser) {
        const changes: string[] = [];
        if (oldUser.name !== editingEmployee.name) changes.push(`Имя: ${oldUser.name} -> ${editingEmployee.name}`);
        if (oldUser.position !== editingEmployee.position) changes.push(`Должность: ${oldUser.position} -> ${editingEmployee.position}`);
        if (oldUser.department !== editingEmployee.department) changes.push(`Отдел: ${oldUser.department} -> ${editingEmployee.department}`);
        if (oldUser.pin !== editingEmployee.pin) changes.push(`PIN изменен`);
        if (oldUser.requirePhoto !== editingEmployee.requirePhoto) changes.push(`Фотофиксация: ${oldUser.requirePhoto} -> ${editingEmployee.requirePhoto}`);
        if (oldUser.branchId !== editingEmployee.branchId) {
          const oldBranch = branches.find(b => b.id === oldUser.branchId)?.name || 'Нет';
          const newBranch = branches.find(b => b.id === editingEmployee.branchId)?.name || 'Нет';
          changes.push(`Филиал: ${oldBranch} -> ${newBranch}`);
        }

        logAuditAction(
          currentOrg.id,
          currentUser.id,
          currentUser.name,
          'edit_user',
          `Изменены данные сотрудника ${editingEmployee.name}`,
          editingEmployee.id,
          editingEmployee.name,
          changes.join(', ')
        );
      }
      setEditingEmployee(null);
    }
  };

  const saveMachineEdit = (id: string) => {
    if (!editValue.trim()) return;
    const newMachines = machines.map(m => m.id === id ? { ...m, name: editValue, branchId: editingMachineBranchId } : m);
    handleUpdateMachinesList(newMachines);
    setEditingMachineId(null);
    setEditingMachineBranchId(undefined);
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
    if (currentOrg && currentUser) {
      logAuditAction(
        currentOrg.id,
        currentUser.id,
        currentUser.name,
        'edit_position',
        `Изменено название должности с "${oldName}" на "${editValue}"`,
        undefined,
        undefined,
        `Старое название: ${oldName}, Новое название: ${editValue}`
      );
    }
    setEditingPositionName(null);
    setEditValue('');
  };

  const tabs = useMemo(() => {
    const allTabs = [
      { id: 'analytics', label: 'Дашборд' },
      { id: 'matrix', label: 'Табель' },
      { id: 'payroll', label: 'Зарплата' },
      { id: 'team', label: 'Команда' },
      { id: 'audit', label: 'Аудит' },
      { id: 'billing', label: 'Биллинг' },
      { id: 'settings', label: 'Настройки' },
      { id: 'support', label: 'Поддержка' }
    ];
    
    let filteredTabs = allTabs;
    
    // Filter by plan features
    if (!canUsePayroll) {
      filteredTabs = filteredTabs.filter(t => t.id !== 'payroll');
    }
    if (!planLimits.features.auditLog) {
      filteredTabs = filteredTabs.filter(t => t.id !== 'audit');
    }

    if (userPerms.isFullAdmin) return filteredTabs;
    if (userPerms.isLimitedAdmin) return filteredTabs.filter(t => ['analytics', 'matrix'].includes(t.id));
    
    return filteredTabs;
  }, [userPerms, canUsePayroll]);

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
      {dashboardStats.orphanedActiveShifts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-3xl flex items-center gap-3 animate-fadeIn no-print">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-100">Обнаружены активные смены для удаленных сотрудников ({dashboardStats.orphanedActiveShifts.length})</p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Эти сотрудники не отображаются в табеле, так как их профили были удалены или повреждены. Рекомендуется завершить эти смены принудительно.</p>
          </div>
          <button 
            onClick={() => setViewMode('analytics')}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-[10px] font-bold hover:bg-amber-700 transition-colors"
          >
            Проверить
          </button>
        </div>
      )}


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
          machines={machines}
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
          machines={machines}
          branches={branches}
          telegramSettings={currentOrg?.telegramSettings}
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

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 gap-4 shadow-md dark:shadow-slate-900/20 no-print">
        <div className="flex items-center gap-2 w-full sm:w-auto">
           <button 
            onClick={async () => {
              if (confirm('Это попытается восстановить привязку сотрудников и логов к вашей организации. Продолжить?')) {
                const results = await db.getDiagnostics();
                
                // Only block if critical tables are missing
                const criticalTables = ['organizations', 'users', 'work_logs'];
                const missingCritical = criticalTables.some(t => results.tables[t]?.status !== 'ok');
                
                if (missingCritical) {
                  alert('Обнаружены критические ошибки в структуре базы данных (отсутствуют таблицы). Пожалуйста, выполните SQL-фикс в панели Супер-Админа.');
                  return;
                }
                
                if (results.sqlFixes && results.sqlFixes.length > 0) {
                  console.warn('Non-critical SQL fixes detected:', results.sqlFixes);
                }
                
                // Deep repair
                const repairResult = await db.repairOrganizationData(currentOrg?.id || '');
                if (repairResult.error) {
                  alert('Ошибка при восстановлении: ' + repairResult.error);
                } else {
                  alert('Восстановление завершено. Страница будет перезагружена.');
                  window.location.reload();
                }
              }
            }}
            className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all"
            title="Исправить данные"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>
          
          {onRefresh && (
              <button 
                onClick={() => onRefresh()} 
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all ${isSyncing ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`} 
                title="Обновить данные"
              >
                <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
           )}
           {branches.length > 0 && (
             <select 
               value={selectedBranchId || ''} 
               onChange={(e) => setSelectedBranchId(e.target.value || null)}
               className="border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
             >
               <option value="">Все филиалы</option>
               {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
           )}
            {(viewMode === 'matrix' || viewMode === 'payroll') && (
              <input type="month" value={filterMonth} onChange={(e) => {
                setFilterMonth(e.target.value);
                if (onMonthChange) onMonthChange(e.target.value);
              }} className="border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100" />
            )}
           <button onClick={downloadExcel} className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors" title="Скачать Excel">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </button>
           <button onClick={downloadPDF} className="p-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors" title="Скачать PDF">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </button>
        </div>
      </div>


      {viewMode === 'analytics' && (
        <>
          {unreadSupportMessages > 0 && (
            <div 
              onClick={() => setViewMode('support')}
              className="mb-6 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl dark:shadow-slate-900/20 shadow-indigo-100 flex items-center justify-between cursor-pointer hover:bg-indigo-700 transition-all animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">У вас есть новые сообщения в техподдержке!</p>
                  <p className="text-xs text-indigo-100">Нажмите, чтобы прочитать</p>
                </div>
              </div>
              <div className="bg-white text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full font-black text-xs">
                +{unreadSupportMessages}
              </div>
            </div>
          )}
          <AnalyticsView
            dashboardStats={dashboardStats}
            users={filteredUsers}
            machines={filteredMachines}
            userPerms={userPerms}
            handleForceFinish={handleForceFinish}
            branches={branches}
          />
        </>
      )}

      {viewMode === 'matrix' && (
        <MatrixView
          filterMonth={filterMonth}
          virtuosoData={virtuosoData}
          days={days}
          today={today}
          expandedTurnerRows={expandedTurnerRows}
          toggleTurnerRow={toggleTurnerRow}
          setEditingLog={handleSetEditingLog}
          machines={filteredMachines}
          virtuosoComponents={virtuosoComponents}
          logsLookup={logsLookup}
          branches={branches}
          currentOrg={currentOrg}
          onRecalculate={handleRecalculateAll}
          isRecalculating={isRecalculating}
        />
      )}

      {viewMode === 'team' && (
        <TeamView
          users={filteredUsers}
          positions={positions}
          planLimits={planLimits}
          currentOrg={currentOrg}
          isUserLimitReached={isUserLimitReached}
          newUser={newUser}
          setNewUser={setNewUser}
          handleAddUser={handleAddUser}
          dashboardStats={dashboardStats}
          machines={filteredMachines}
          userPerms={userPerms}
          handleForceFinish={handleForceFinish}
          setEditingEmployee={setEditingEmployee}
          onDeleteUser={handleDeleteUser}
          branches={branches}
          getArchivedUsers={getArchivedUsers}
          handleRestoreUser={onRestoreUser}
        />
      )}

      {viewMode === 'audit' && planLimits.features.auditLog && (
        <AuditLogView
          currentOrg={currentOrg}
          users={users}
        />
      )}

      {viewMode === 'instructions' && (
        <div className="h-full animate-fadeIn">
          <DocumentationView />
        </div>
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

      {viewMode === 'payroll' && canUsePayroll && (
        <PayrollView
          users={filteredUsers}
          onUpdateUser={onUpdateUser}
          logs={logs}
          logsLookup={logsLookup}
          positions={positions}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          handleExportAll={handleExportAll}
          machines={filteredMachines}
          onAddGeneralBonus={handleAddGeneralBonus}
          branches={branches}
          currentOrg={currentOrg}
          payments={payments}
          onSavePayment={onSavePayment}
          onDeletePayment={onDeletePayment}
          onLogsUpsert={onLogsUpsert}
          onRecalculate={handleRecalculateAll}
          isRecalculating={isRecalculating}
          planLimits={planLimits}
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
          editingMachineBranchId={editingMachineBranchId}
          setEditingMachineBranchId={setEditingMachineBranchId}
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
          branches={branches}
          onUpdateBranches={onUpdateBranches}
          onDeleteBranch={onDeleteBranch}
          newMachineBranchId={newMachineBranchId}
          setNewMachineBranchId={setNewMachineBranchId}
          getArchivedMachines={getArchivedMachines}
          handleRestoreMachine={onRestoreMachine}
        />
      )}
      {viewMode === 'support' && (
        <SupportChat 
          key={currentOrg?.id} 
          currentUser={currentUser || null} 
          orgId={currentOrg?.id || ''} 
          onOrgSelect={onResetUnread}
        />
      )}
      {/* Debug Info (Only for Super Admin or if enabled for Org) */}
      {(currentUser?.role === UserRole.SUPER_ADMIN || (currentUser?.isAdmin && currentOrg?.debugEnabled)) && (
        <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-[10px] font-mono text-slate-500 dark:text-slate-400 space-y-1 select-text">
          <div className="flex justify-between items-start">
            <div id="debug-content" className="space-y-1">
              <p>Debug: OrgID: [{currentOrg?.id}] | Users: {users.length} | Logs: {logs.length}</p>
              <p>Users: {users.map(u => `${u.name}(${u.isArchived ? 'A' : 'Act'}, Org:${u.organizationId})`).join(', ')}</p>
              <p>First User: {users[0] ? `${users[0].name} (ID: [${users[0].id}])` : 'NONE'}</p>
              <p>Logs: {logs.slice(0, 5).map(l => l.userId).join(', ')}</p>
              <p>Active Shifts Map Keys: {Object.keys(activeShiftsMap).join(', ')}</p>
            </div>
            <button 
              onClick={() => {
                const text = document.getElementById('debug-content')?.innerText || '';
                navigator.clipboard.writeText(text);
                alert('Скопировано в буфер обмена');
              }}
              className="px-2 py-1 bg-blue-600 text-white rounded text-[8px] font-black uppercase"
            >
              Copy
            </button>
          </div>
          {users.length === 0 && <p className="text-rose-600 dark:text-rose-400 font-bold">ВНИМАНИЕ: Список сотрудников пуст. Попробуйте "Восстановить данные".</p>}
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} 
              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Очистить кэш и перезагрузить
            </button>
            <button 
              onClick={() => onRunDiagnostics?.()} 
              className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/40"
            >
              Диагностика БД
            </button>
            <button 
              onClick={() => onMergeDuplicates?.()} 
              className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded hover:bg-orange-200 dark:hover:bg-orange-900/40"
            >
              Объединить дубликаты (по имени)
            </button>
            <button 
              onClick={() => onFixDbStructure?.()} 
              className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40"
            >
              Исправить структуру БД (дубликаты позиций)
            </button>
            <button 
              onClick={() => onRefresh?.()} 
              className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40"
            >
              Обновить данные из БД
            </button>
            <button 
              onClick={() => forceCleanAll?.()} 
              className="px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/40"
            >
              Принудительная очистка $
            </button>
            <button 
              onClick={() => onCleanupDatabase?.()} 
              className="px-2 py-1 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded hover:bg-rose-200 dark:hover:bg-rose-900/40"
            >
              Исправить дубликаты в БД
            </button>
            <button 
              onClick={() => {
                let storageCount = 0;
                let base64Count = 0;
                let totalPhotos = 0;
                
                logs.forEach(l => {
                  if (l.photoIn) {
                    totalPhotos++;
                    if (l.photoIn.startsWith('http')) storageCount++;
                    else if (l.photoIn.startsWith('data:')) base64Count++;
                  }
                  if (l.photoOut) {
                    totalPhotos++;
                    if (l.photoOut.startsWith('http')) storageCount++;
                    else if (l.photoOut.startsWith('data:')) base64Count++;
                  }
                });
                
                if (base64Count > 0) {
                  if (confirm(`Найдено ${base64Count} фото в Base64. Они нагружают базу. Удалить их? (Фото в хранилище останутся)`)) {
                    onRemoveBase64Photos?.();
                  }
                } else {
                  alert('Фото в Base64 не найдено. Все отлично!');
                }
              }} 
              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/40"
            >
              Проверить и удалить Base64 фото
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmployerView;
