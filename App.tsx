
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, UserRole, WorkLog, Machine, PositionConfig, Organization, PlanType, PlanLimits, Plan, EntryType } from './types';
import { STORAGE_KEYS, INITIAL_USERS, INITIAL_MACHINES, INITIAL_POSITIONS, INITIAL_LOGS, DEFAULT_PERMISSIONS, PLAN_LIMITS } from './constants';
import { sendNotification } from './utils';
import Layout from './components/Layout';
import EmployeeView from './components/EmployeeView';
import EmployerView from './components/EmployerView';
import LandingPage from './components/LandingPage';
import RegistrationForm from './components/RegistrationForm';
import SuperAdminView from './components/SuperAdminView';
import { db } from './lib/supabase';

const APP_VERSION = 'v1.9.0-PRO-SAAS';
const DEFAULT_ORG_ID = 'demo_org';

const App: React.FC = () => {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [activeShiftsMap, setActiveShiftsMap] = useState<Record<string, any>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [positions, setPositions] = useState<PositionConfig[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [superAdminPin, setSuperAdminPin] = useState('7777');
  
  // Состояние для регистрации
  const [showRegistration, setShowRegistration] = useState(false);
  
  // Состояние для окна апгрейда
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [showLanding, setShowLanding] = useState<boolean>(() => {
    const hasUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    return !hasUser && !hasLastUsed;
  });

  const [nightShiftBonus, setNightShiftBonus] = useState<number>(() => {
    const saved = localStorage.getItem('timesheet_night_bonus');
    return saved ? parseInt(saved) : 120;
  });
  
  const [selectedLoginUser, setSelectedLoginUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // States for PIN reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'newPin'>('email');
  const [resetStatus, setResetStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [tempNewPin, setTempNewPin] = useState('');
  
  // Refs for real-time notifications
  const currentUserRef = useRef<User | null>(null);
  const usersRef = useRef<User[]>([]);
  const currentOrgRef = useRef<Organization | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
    usersRef.current = users;
    currentOrgRef.current = currentOrg;
  }, [currentUser, users, currentOrg]);

  useEffect(() => {
    localStorage.setItem('timesheet_night_bonus', nightShiftBonus.toString());
  }, [nightShiftBonus]);

  const initData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsSyncing(true);
    
    // 1. Проверяем URL на наличие команды переключения (самый надежный способ для мобильных)
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgId = urlParams.get('org_switch');
    
    let orgId = urlOrgId || localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    
    // Если переключение пришло из URL, фиксируем его и очищаем кэш данных
    if (urlOrgId) {
      localStorage.setItem(STORAGE_KEYS.ORG_ID, urlOrgId);
      localStorage.removeItem(STORAGE_KEYS.ORG_DATA);
      localStorage.removeItem(STORAGE_KEYS.USERS_LIST);
      localStorage.removeItem(STORAGE_KEYS.WORK_LOGS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
      // Убираем параметр из URL без перезагрузки, чтобы не срабатывало при обычном Refresh
      window.history.replaceState({}, '', window.location.pathname);
    }

    const cachedOrg = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
    if (cachedOrg) setCurrentOrg(JSON.parse(cachedOrg));

    const cachedLogs = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);
    const cachedUsers = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
    const cachedMachines = localStorage.getItem(STORAGE_KEYS.MACHINES_LIST);
    const cachedPositions = localStorage.getItem(STORAGE_KEYS.POSITIONS_LIST);
    const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const lastUserId = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);

    if (!isRefresh) {
      if (cachedLogs) setLogs(JSON.parse(cachedLogs));
      
      if (cachedUsers) {
        setUsers(JSON.parse(cachedUsers));
      } else {
        // УБИРАЕМ автоматическую подстановку INITIAL_USERS здесь.
        // Мы дождемся загрузки из БД или ручного переключения.
        setUsers([]); 
      }

      if (lastUserId && !cachedCurrentUser) {
        const usersToSearch = cachedUsers ? JSON.parse(cachedUsers) : [];
        const lastUser = usersToSearch.find((u: any) => u.id === lastUserId);
        if (lastUser) {
          setSelectedLoginUser(lastUser);
          setShowLanding(false);
        }
      }

      if (cachedMachines) {
        setMachines(JSON.parse(cachedMachines));
      } else if (orgId === DEFAULT_ORG_ID) {
        setMachines(INITIAL_MACHINES);
      } else {
        setMachines([]);
      }

      if (cachedPositions) {
        setPositions(JSON.parse(cachedPositions));
      } else {
        setPositions(INITIAL_POSITIONS);
      }

      if (cachedCurrentUser) {
        setCurrentUser(JSON.parse(cachedCurrentUser));
        setShowLanding(false);
      }
    }

    try {
      // Быстрая проверка соединения
      const isConnected = await db.checkConnection();
      if (!isConnected) {
        setDbError('Нет подключения к базе данных. Проверьте настройки Supabase.');
        if (isRefresh) setIsSyncing(false);
        // Do not return early, allow local fallback to work
      } else {
        setDbError(null);
      }

      // Fetch organization first to ensure we have the right context
      const dbOrg = await db.getOrganization(orgId);
      
      if (dbOrg) {
        // Проверка истечения срока действия
        const isExpired = dbOrg.expiryDate && new Date(dbOrg.expiryDate) < new Date();
        if (isExpired && dbOrg.status !== 'expired' && dbOrg.plan !== PlanType.FREE) {
          dbOrg.status = 'expired';
          dbOrg.plan = PlanType.FREE;
          await db.updateOrganization(orgId, { status: 'expired', plan: PlanType.FREE });
          setUpgradeReason(`Срок действия тарифа истек.`);
        }
        
        setCurrentOrg(dbOrg);
        localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(dbOrg));
      } else if (orgId === DEFAULT_ORG_ID) {
        const defaultOrg: Organization = { 
          id: DEFAULT_ORG_ID, 
          name: 'Моя Компания', 
          ownerId: 'admin', 
          plan: PlanType.FREE, 
          status: 'active' 
        };
        setCurrentOrg(defaultOrg);
        await db.createOrganization(defaultOrg);
      } else {
        // Org not found and not default - reset to default
        localStorage.setItem(STORAGE_KEYS.ORG_ID, DEFAULT_ORG_ID);
        window.location.reload();
        return;
      }

      // Parallel fetch of all other data
      const [dbLogs, dbUsers, dbMachines, dbPositions, dbPlans, dbActiveShifts, dbConfig] = await Promise.all([
        db.getLogs(orgId),
        db.getUsers(orgId),
        db.getMachines(orgId),
        db.getPositions(orgId),
        db.getPlans(),
        db.getAllActiveShifts(orgId),
        db.getSystemConfig()
      ]);

      if (dbConfig?.super_admin_pin) {
        setSuperAdminPin(dbConfig.super_admin_pin);
      }

      if (dbPlans) setPlans(dbPlans);

      // Handle Logs
      const finalLogs: WorkLog[] = dbLogs || [];
      setLogs(finalLogs);
      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(finalLogs));

      // Handle Active Shifts - Isolation fix: only use DB data for new orgs
      const map: Record<string, any> = {};
      if (dbActiveShifts) {
        dbActiveShifts.forEach((s: any) => {
          map[s.user_id] = s.shifts || s.shifts_json;
        });
      }

      // RECOVERY: If a user has an open log but no active shift in map, add it.
      // This handles the case where active_shifts table is out of sync or cleared.
      if (finalLogs) {
         const openLogs = finalLogs.filter(l => !l.checkOut && l.entryType === EntryType.WORK);
         openLogs.forEach(log => {
            if (!map[log.userId]) {
               // We found an open log but no active shift record.
               // We need to reconstruct the active shift object.
               // We assume slot 1 if we can't determine it, but let's try to parse ID.
               // ID format: shift-{userId}-{timestamp}-{slot}
               let slot = 1;
               const parts = log.id.split('-');
               if (parts.length >= 4) {
                  const lastPart = parts[parts.length - 1];
                  const parsedSlot = parseInt(lastPart);
                  if (!isNaN(parsedSlot)) slot = parsedSlot;
               }
               
               // Reconstruct the shifts object (e.g. { 1: log, 2: null })
               map[log.userId] = { [slot]: log };
            } else {
               // If map exists but might be missing this specific slot
               const userShifts = map[log.userId];
               let slot = 1;
               const parts = log.id.split('-');
               if (parts.length >= 4) {
                  const lastPart = parts[parts.length - 1];
                  const parsedSlot = parseInt(lastPart);
                  if (!isNaN(parsedSlot)) slot = parsedSlot;
               }
               
               if (!userShifts[slot]) {
                  userShifts[slot] = log;
               }
            }
         });
      }

      setActiveShiftsMap(map);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(map));

      // Handle Users
      let finalUsers: User[] = dbUsers || [];
      
      // Only seed if we successfully fetched (dbUsers is not null) and list is empty
      if (dbUsers !== null && orgId === DEFAULT_ORG_ID && finalUsers.length === 0) {
        // Seed default org if empty
        for (const u of INITIAL_USERS) await db.upsertUser(u, orgId);
        finalUsers = INITIAL_USERS;
      } else if (finalUsers.length > 0) {
        // Ensure admin user exists
        const hasAdmin = finalUsers.some(u => u.id === 'admin');
        if (!hasAdmin) {
          const defaultAdmin: User = {
            id: 'admin',
            name: 'Администратор',
            role: UserRole.EMPLOYER,
            position: 'Администратор',
            pin: '0000',
            isAdmin: true,
            organizationId: orgId
          };
          await db.upsertUser(defaultAdmin, orgId);
          finalUsers.push(defaultAdmin);
        }
      } else if (dbUsers !== null && orgId !== DEFAULT_ORG_ID && finalUsers.length === 0) {
        // For new orgs, create admin if not exists
        // Only if fetch was successful
        const defaultAdmin: User = {
          id: 'admin',
          name: 'Администратор',
          role: UserRole.EMPLOYER,
          position: 'Администратор',
          pin: '0000',
          isAdmin: true,
          organizationId: orgId
        };
        await db.upsertUser(defaultAdmin, orgId);
        finalUsers = [defaultAdmin];
      }

      setUsers(finalUsers);
      localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(finalUsers));

      // Handle Machines
      const finalMachines = dbMachines || [];
      if (finalMachines.length > 0) {
        setMachines(finalMachines);
        localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(finalMachines));
      } else if (orgId === DEFAULT_ORG_ID) {
        setMachines(INITIAL_MACHINES);
        await db.saveMachines(INITIAL_MACHINES, orgId);
      } else {
        setMachines([]);
        localStorage.removeItem(STORAGE_KEYS.MACHINES_LIST);
      }

      // Handle Positions
      if (dbPositions) {
        const normalized = dbPositions.map((p: any) => 
          typeof p === 'string' 
            ? (INITIAL_POSITIONS.find(ip => ip.name === p) || { name: p, permissions: DEFAULT_PERMISSIONS }) 
            : p
        );
        setPositions(normalized);
        localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(normalized));
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      if (!isRefresh) setIsInitialized(true);
      if (isRefresh) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    initData();
    
    // Авто-синхронизация при возвращении в приложение (важно для мобильных)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [initData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!isInitialized || !currentOrg) return;

    const orgId = currentOrg.id;
    
    const unsubLogs = db.subscribeToChanges(orgId, 'work_logs', (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newLog = {
          id: payload.new.id,
          userId: payload.new.user_id,
          organizationId: payload.new.organization_id,
          date: payload.new.date,
          entryType: payload.new.entry_type,
          machineId: payload.new.machine_id,
          checkIn: payload.new.check_in,
          checkOut: payload.new.check_out,
          durationMinutes: payload.new.duration_minutes,
          photoIn: payload.new.photo_in,
          photoOut: payload.new.photo_out,
          isCorrected: payload.new.is_corrected,
          correctionNote: payload.new.correction_note,
          correctionTimestamp: payload.new.correction_timestamp,
          isNightShift: payload.new.is_night_shift
        };
        
        setLogs(prev => {
          const exists = prev.find(l => l.id === newLog.id);
          
          // Notification Logic
          const currentUser = currentUserRef.current;
          const users = usersRef.current;
          const org = currentOrgRef.current;
          
          if (currentUser && (currentUser.role === UserRole.EMPLOYER || currentUser.isAdmin) && newLog.userId !== currentUser.id) {
             const logUser = users.find(u => u.id === newLog.userId);
             if (logUser && org?.notificationSettings) {
                // Shift Start: New log entry with no checkOut
                if (!exists && !newLog.checkOut && org.notificationSettings.onShiftStart) {
                   sendNotification('Смена начата', `${logUser.name} приступил к работе.`);
                }
                // Shift End: Existing log entry didn't have checkOut, but new one does
                if (exists && !exists.checkOut && newLog.checkOut && org.notificationSettings.onShiftEnd) {
                   sendNotification('Смена завершена', `${logUser.name} закончил работу.`);
                }
             }
          }

          if (exists && JSON.stringify(exists) === JSON.stringify(newLog)) return prev;
          
          const filtered = prev.filter(l => l.id !== newLog.id);
          const updated = [newLog, ...filtered].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            // Tie-breaker по времени начала
            const aTime = a.checkIn || '';
            const bTime = b.checkIn || '';
            return bTime.localeCompare(aTime);
          });
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(updated));
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        setLogs(prev => {
          const updated = prev.filter(l => l.id !== payload.old.id);
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(updated));
          return updated;
        });
      }
    });

    const unsubUsers = db.subscribeToChanges(orgId, 'users', (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newUser = {
          id: payload.new.id,
          name: payload.new.name,
          role: payload.new.role,
          department: payload.new.department,
          position: payload.new.position,
          pin: payload.new.pin,
          requirePhoto: payload.new.require_photo,
          isAdmin: payload.new.is_admin,
          forcePinChange: payload.new.force_pin_change,
          organizationId: payload.new.organization_id
        };
        
        setUsers(prev => {
          const exists = prev.find(u => u.id === newUser.id);
          if (exists && JSON.stringify(exists) === JSON.stringify(newUser)) return prev;
          
          const filtered = prev.filter(u => u.id !== newUser.id);
          const updated = [...filtered, newUser].sort((a, b) => a.name.localeCompare(b.name));
          localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(updated));
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        setUsers(prev => {
          const updated = prev.filter(u => u.id !== payload.old.id);
          localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(updated));
          return updated;
        });
      }
    });

    const unsubActiveShifts = db.subscribeToChanges(orgId, 'active_shifts', (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setActiveShiftsMap(prev => {
          const updated = {
            ...prev,
            [payload.new.user_id]: payload.new.shifts || payload.new.shifts_json
          };
          localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(updated));
          return updated;
        });
      } else if (payload.eventType === 'DELETE' && payload.old && payload.old.user_id) {
        setActiveShiftsMap(prev => {
          const updated = { ...prev };
          delete updated[payload.old.user_id];
          localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(updated));
          return updated;
        });
      }
    });

    const unsubOrg = db.subscribeToChanges(orgId, 'organizations', (payload) => {
      if (payload.eventType === 'UPDATE' && payload.new.id === orgId) {
        const updatedOrg = { 
          ...payload.new, 
          ownerId: payload.new.owner_id,
          expiryDate: payload.new.expiry_date,
          notificationSettings: payload.new.notification_settings 
        };
        setCurrentOrg(prev => prev ? { ...prev, ...updatedOrg } : updatedOrg);
        localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(updatedOrg));
      }
    });

    const unsubPositions = db.subscribeToChanges(orgId, 'positions', async () => {
      const dbPositions = await db.getPositions(orgId);
      if (dbPositions) {
        setPositions(dbPositions);
        localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(dbPositions));
      }
    });

    return () => {
      unsubLogs();
      unsubUsers();
      unsubActiveShifts();
      unsubOrg();
      unsubPositions();
    };
  }, [isInitialized, currentOrg?.id]);

  // Хелпер проверки лимитов
  const checkLimit = useCallback((type: 'users' | 'machines' | 'nightShift' | 'photo') => {
    if (!currentOrg) return true;
    
    // Получаем лимиты из динамических планов или из констант (fallback)
    const currentPlan = plans.find(p => p.type === currentOrg.plan);
    const limits = currentPlan ? currentPlan.limits : PLAN_LIMITS[currentOrg.plan];
    
    switch(type) {
      case 'users':
        if (users.length >= limits.maxUsers) {
          setUpgradeReason(`Вы достигли лимита сотрудников (${limits.maxUsers}) для вашего тарифа.`);
          setShowUpgradeModal(true);
          return false;
        }
        break;
      case 'machines':
        if (machines.length >= limits.maxMachines) {
          setUpgradeReason(`Вы достигли лимита оборудования (${limits.maxMachines}) для вашего тарифа.`);
          setShowUpgradeModal(true);
          return false;
        }
        break;
      case 'nightShift':
        if (!limits.features.nightShift) {
          setUpgradeReason(`Функция ночных смен доступна только в PRO версии.`);
          return false;
        }
        break;
      case 'photo':
        if (!limits.features.photoCapture) {
          setUpgradeReason(`Фотофиксация доступна только в PRO версии.`);
          return false;
        }
        break;
    }
    return true;
  }, [currentOrg, users.length, machines.length]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return DEFAULT_PERMISSIONS;
    if (currentUser.id === 'admin') return { ...DEFAULT_PERMISSIONS, isFullAdmin: true };
    const pos = positions.find(p => p.name === currentUser.position);
    return pos?.permissions || DEFAULT_PERMISSIONS;
  }, [currentUser, positions]);

  const isSelectedUserAdmin = useMemo(() => {
    if (!selectedLoginUser) return false;
    if (selectedLoginUser.id === 'admin') return true;
    const pos = positions.find(p => p.name === selectedLoginUser.position);
    return pos?.permissions?.isFullAdmin || pos?.permissions?.isLimitedAdmin;
  }, [selectedLoginUser, positions]);

  // Fix: Defined isEmployerAuthorized to check for administrative permissions
  const isEmployerAuthorized = useMemo(() => {
    return userPermissions.isFullAdmin || userPermissions.isLimitedAdmin;
  }, [userPermissions]);

  const isSuperAdmin = useMemo(() => {
    return currentUser?.role === UserRole.SUPER_ADMIN;
  }, [currentUser]);

  // Persist currentOrg to localStorage
  useEffect(() => {
    if (currentOrg) {
      localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(currentOrg));
    }
  }, [currentOrg]);

  const handleRefresh = async () => {
    await initData(true);
  };

  const validateAndLogin = (pin: string, user?: User) => {
    const adminUser = users.find(u => u.id === 'admin');
    
    // Секретный PIN для Супер-админа (в реальности должен быть в БД)
    if (pin === superAdminPin) {
      const superAdminUser: User = {
        id: 'super-admin',
        name: 'Главный Администратор',
        role: UserRole.SUPER_ADMIN,
        position: 'Super Admin',
        pin: superAdminPin
      };
      setCurrentUser(superAdminUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(superAdminUser));
      setPinInput('');
      setLoginError('');
      setShowLanding(false);
      return;
    }

    if (user && pin === user.pin) {
      const loginSessionUser = { ...user, role: UserRole.EMPLOYEE };
      setCurrentUser(loginSessionUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(loginSessionUser));
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
      setPinInput('');
      setLoginError('');
      setShowLanding(false);
    } else if (adminUser && pin === adminUser.pin) {
      setSelectedLoginUser(null);
      setPinInput('');
      setLoginError('');
      localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
    } else {
      setLoginError('Неверный PIN-код');
      setTimeout(() => setPinInput(''), 500);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPinInput('');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    setShowLanding(!hasLastUsed);
  };

  const handleSwitchRole = (role: UserRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    }
  };

  const handleLogsUpsert = useCallback((logsToUpsert: WorkLog[]) => {
    const orgId = currentOrg?.id || localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    
    // Оптимистичное обновление локального состояния логов
    setLogs(prev => {
      const updated = [...prev];
      logsToUpsert.forEach(newLog => {
        const index = updated.findIndex(l => l.id === newLog.id);
        if (index !== -1) {
          updated[index] = newLog;
        } else {
          updated.unshift(newLog);
        }
      });
      
      const sorted = updated.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        const aTime = a.checkIn || '';
        const bTime = b.checkIn || '';
        return bTime.localeCompare(aTime);
      });

      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(sorted));
      return sorted;
    });

    // Автоматическая синхронизация карты активных смен
    // Если лог был завершен (появился checkOut), удаляем его из карты активных смен
    setActiveShiftsMap(prev => {
      const newMap = { ...prev };
      let changed = false;

      logsToUpsert.forEach(log => {
        if (log.checkOut) {
          const userShifts = newMap[log.userId];
          if (userShifts) {
            const newUserShifts = { ...userShifts };
            let userChanged = false;
            Object.keys(newUserShifts).forEach(slot => {
              if (newUserShifts[slot]?.id === log.id) {
                newUserShifts[slot] = null;
                userChanged = true;
                changed = true;
              }
            });
            if (userChanged) {
              newMap[log.userId] = newUserShifts;
            }
          }
        }
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(newMap));
        return newMap;
      }
      return prev;
    });

    // Push Notifications for Admin
    if (currentOrg?.notificationSettings) {
      logsToUpsert.forEach(log => {
        const user = users.find(u => u.id === log.userId);
        if (!user) return;

        if (log.checkOut && currentOrg.notificationSettings?.onShiftEnd) {
          sendNotification('Смена завершена', `${user.name} закончил работу.`);
        } else if (!log.checkOut && currentOrg.notificationSettings?.onShiftStart) {
          sendNotification('Смена начата', `${user.name} приступил к работе.`);
        }
      });
    }
    
    // Пакетное обновление в БД
    if (logsToUpsert.length > 0) {
      setIsSyncing(true);
      setSyncError(null);
      db.batchUpsertLogs(logsToUpsert, orgId)
        .then(({ error }) => {
          if (error) {
            setSyncError('Ошибка синхронизации. Проверьте интернет.');
            console.error('Sync error:', error);
          }
        })
        .catch(err => {
          setSyncError('Критическая ошибка синхронизации.');
          console.error('Sync catch:', err);
        })
        .finally(() => setIsSyncing(false));
    }
  }, [currentOrg?.id]);

  const handleActiveShiftsUpdate = useCallback((userId: string, shifts: any) => {
    const orgId = currentOrg?.id || localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    
    setActiveShiftsMap(prev => {
      const updated = {
        ...prev,
        [userId]: shifts
      };
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(updated));
      return updated;
    });
    
    db.saveActiveShifts(userId, shifts, orgId).then(({ error }) => {
      if (error) {
        console.error('Active shifts sync error:', error);
        // Не ставим глобальную ошибку, так как локально всё сохранилось
      }
    });
  }, [currentOrg?.id]);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    
    if (resetStep === 'email') {
      if (!currentOrg?.email) {
        setResetStatus({ text: 'Email для этой организации не настроен. Обратитесь в поддержку.', type: 'error' });
        return;
      }
      
      if (resetEmailInput.toLowerCase() === currentOrg.email.toLowerCase()) {
        setResetStep('newPin');
      } else {
        setResetStatus({ text: 'Email не совпадает с данными организации.', type: 'error' });
      }
    } else {
      if (tempNewPin.length !== 4) {
        setResetStatus({ text: 'PIN должен состоять из 4 цифр.', type: 'error' });
        return;
      }
      
      try {
        await db.resetAdminPin(currentOrg!.id, tempNewPin);
        setResetStatus({ text: 'Пароль администратора успешно изменен!', type: 'success' });
        setTimeout(() => {
          setShowResetModal(false);
          setResetStep('email');
          setResetEmailInput('');
          setTempNewPin('');
          setResetStatus(null);
          initData(true);
        }, 2000);
      } catch (err) {
        setResetStatus({ text: 'Ошибка при сбросе пароля.', type: 'error' });
      }
    }
  };

  const handleDeleteLog = (logId: string) => {
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    const newLogs = logs.filter(l => l.id !== logId);
    setLogs(newLogs);
    localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(newLogs));
    db.deleteLog(logId, orgId);
  };

  const persistUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(newUsers));
  };

  const handleAddUser = async (user: User) => {
    if (!checkLimit('users')) return;
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    
    const { error } = await db.upsertUser(user, orgId);
    if (error) {
      if (typeof error === 'object' && (error as any).message?.includes('LIMIT_REACHED')) {
        setUpgradeReason((error as any).message.split(': ')[1] || 'Лимит сотрудников исчерпан.');
      } else {
        alert('Ошибка при добавлении сотрудника в базу данных.');
      }
      return;
    }

    const newUsers = [...users, user];
    persistUsers(newUsers);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    
    const { error } = await db.upsertUser(updatedUser, orgId);
    if (error) {
      alert('Ошибка при обновлении данных сотрудника в базе данных.');
      return;
    }

    const newUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    persistUsers(newUsers);
    
    if (currentUser?.id === updatedUser.id) {
      const mergedUser = { ...currentUser, ...updatedUser };
      setCurrentUser(mergedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(mergedUser));
    }
  };

  const handleDeleteUser = (userId: string) => {
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    const newUsers = users.filter(u => u.id !== userId);
    persistUsers(newUsers);
    db.deleteUser(userId, orgId);
  };

  const persistMachines = async (newMachines: Machine[]) => {
    // Проверка лимита только если кол-во увеличилось
    if (newMachines.length > machines.length && !checkLimit('machines')) return;
    
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    
    const { error } = await db.saveMachines(newMachines, orgId);
    if (error) {
      if (typeof error === 'object' && (error as any).message?.includes('LIMIT_REACHED')) {
        setUpgradeReason((error as any).message.split(': ')[1] || 'Лимит оборудования исчерпан.');
      } else {
        alert('Ошибка при сохранении списка оборудования в базе данных.');
      }
      return;
    }

    setMachines(newMachines);
    localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(newMachines));
  };

  const persistPositions = (newPositions: PositionConfig[]) => {
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    setPositions(newPositions);
    localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(newPositions));
    db.savePositions(newPositions, orgId);
  };

  const handleImportData = async (jsonStr: string) => {
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
    setIsSyncing(true);
    try {
      const data = JSON.parse(jsonStr);
      if (data.users) {
        setUsers(data.users);
        localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(data.users));
        await db.batchUpsertUsers(data.users, orgId);
      }
      if (data.logs) {
        setLogs(data.logs);
        localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(data.logs));
        await db.batchUpsertLogs(data.logs, orgId);
      }
      if (data.machines) {
        setMachines(data.machines);
        localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(data.machines));
        await db.saveMachines(data.machines, orgId);
      }
      if (data.positions) {
        setPositions(data.positions);
        localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(data.positions));
        await db.savePositions(data.positions.map((p: any) => typeof p === 'string' ? p : p.name), orgId);
      }
      alert('Данные успешно импортированы и синхронизированы!');
      window.location.reload(); 
    } catch (e) {
      alert('Ошибка при импорте файла!');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Загрузка системы...</p>
        </div>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminView onLogout={handleLogout} />;
  }

  if (showRegistration) {
    return (
      <RegistrationForm 
        onBack={() => setShowRegistration(false)} 
        onSuccess={(orgId) => {
          // Clear all cache before switching to new org
          Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
          });
          localStorage.setItem(STORAGE_KEYS.ORG_ID, orgId);
          setShowRegistration(false);
          setShowLanding(false);
          window.location.reload();
        }} 
      />
    );
  }

  if (showLanding && !currentUser) {
    return (
      <LandingPage 
        onStart={() => setShowLanding(false)} 
        onRegister={() => setShowRegistration(true)}
      />
    );
  }

  return (
    <Layout 
      user={currentUser} 
      currentOrg={currentOrg} 
      onLogout={handleLogout} 
      onSwitchRole={handleSwitchRole} 
      onRefresh={handleRefresh}
      version={APP_VERSION}
      isSyncing={isSyncing}
    >
      {dbError && (
        <div className="bg-rose-600 text-white px-4 py-2 text-center text-xs font-bold animate-pulse sticky top-16 z-[60] shadow-lg">
          ⚠️ {dbError}
        </div>
      )}
      {syncError && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold sticky top-16 z-[60] shadow-lg">
          ⚠️ {syncError} Данные сохранены локально и будут отправлены позже.
        </div>
      )}
      {/* Модальное окно апгрейда */}
      {/* PIN Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Сброс PIN админа</h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
            </div>
            
            <form onSubmit={handleResetRequest} className="space-y-6">
              {resetStep === 'email' ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Введите email организации для подтверждения личности.
                  </p>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Email организации</label>
                    <input 
                      type="email"
                      required
                      value={resetEmailInput}
                      onChange={e => setResetEmailInput(e.target.value)}
                      placeholder="admin@company.com"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Email подтвержден. Введите новый 4-значный PIN.
                  </p>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Новый PIN</label>
                    <input 
                      type="text"
                      maxLength={4}
                      required
                      value={tempNewPin}
                      onChange={e => setTempNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0000"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center text-blue-600"
                    />
                  </div>
                </div>
              )}

              {resetStatus && (
                <p className={`text-[10px] font-bold text-center uppercase p-2 rounded-lg ${resetStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {resetStatus.text}
                </p>
              )}

              <button 
                type="submit"
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 active:scale-95 transition-all"
              >
                {resetStep === 'email' ? 'Подтвердить Email' : 'Сбросить пароль'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {upgradeReason && !showUpgradeModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 w-full max-w-sm border border-slate-200 text-center space-y-6">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-amber-50">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Уведомление</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {upgradeReason}
              </p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => setUpgradeReason(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal (Limits reached) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 w-full max-w-sm border border-slate-200 text-center space-y-6">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-50">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Обновите тариф</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{upgradeReason}</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { window.location.href = '#pricing'; setUpgradeReason(null); setShowUpgradeModal(false); }}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
              >
                Посмотреть тарифы
              </button>
              <button 
                onClick={() => { setUpgradeReason(null); setShowUpgradeModal(false); }}
                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      )}

      {!currentUser ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 w-full max-w-md relative overflow-hidden">
            <button 
              onClick={() => setShowLanding(true)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="absolute top-0 right-0 p-3">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{APP_VERSION}</span>
            </div>
            
            <div className="text-center mb-8">
              <div className="bg-blue-600 text-white p-4 rounded-3xl inline-block mb-4 shadow-xl shadow-blue-100">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{currentOrg?.name || 'WorkTracker PRO'}</h1>
              <div className="flex justify-center mt-1">
                 <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-blue-100">
                    Тариф: {currentOrg?.plan || PlanType.FREE}
                 </span>
              </div>
            </div>

            {!selectedLoginUser ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Личный доступ</label>
                  <select 
                    onChange={(e) => {
                      const user = users.find(u => u.id === e.target.value);
                      if (user) {
                        setSelectedLoginUser(user);
                        localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
                      }
                    }}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>Выберите себя в списке...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} — {u.position}</option>
                    ))}
                  </select>
                </div>
                <div className="p-5 bg-blue-50 rounded-[2rem] border border-blue-100">
                  <p className="text-[11px] text-blue-800 font-semibold leading-relaxed">
                     <span className="font-black uppercase block mb-1">Важно:</span> 
                     Используйте ваш PIN-код. Для новых сотрудников по умолчанию <span className="underline">0000</span>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-[2rem] mb-4 border border-blue-100">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                    {selectedLoginUser.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900">{selectedLoginUser.name}</p>
                    {isSelectedUserAdmin && (
                      <button type="button" onClick={() => { setSelectedLoginUser(null); setPinInput(''); }} className="text-[10px] text-blue-600 uppercase underline font-black">Сменить профиль</button>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex justify-center gap-6 mb-8">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pinInput.length > i ? 'bg-blue-600 border-blue-600 scale-125 shadow-xl' : 'border-slate-300'}`}></div>
                    ))}
                  </div>
                  <input 
                    type="password"
                    inputMode="none"
                    maxLength={4}
                    value={pinInput}
                    readOnly
                    className="absolute opacity-0 pointer-events-none"
                    tabIndex={-1}
                  />
                  {loginError && <p className="text-red-500 text-[11px] text-center mt-2 font-black uppercase tracking-widest">{loginError}</p>}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((n, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (n === 'del') {
                          setPinInput(prev => prev.slice(0, -1));
                          setLoginError('');
                        }
                        else if (typeof n === 'number' && pinInput.length < 4) {
                          const newPin = pinInput + n;
                          setPinInput(newPin);
                          if (newPin.length === 4) {
                            validateAndLogin(newPin, selectedLoginUser);
                          }
                        }
                      }}
                      className={`h-16 rounded-[1.5rem] font-black flex items-center justify-center transition-all active:scale-95 ${n === '' ? 'pointer-events-none' : 'bg-slate-50 hover:bg-white border-2 border-slate-100 text-slate-800 text-xl'}`}
                    >
                      {n === 'del' ? '←' : n}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-3 mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Введите 4 цифры для входа</p>
                  {selectedLoginUser.id === 'admin' && (
                    <button 
                      onClick={() => setShowResetModal(true)}
                      className="text-[10px] text-blue-600 uppercase font-black hover:underline"
                    >
                      Забыли PIN администратора?
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-center">
              <button 
                onClick={() => {
                  const pin = prompt('Введите мастер-ключ для входа в Back-office:');
                  if (pin) validateAndLogin(pin, selectedLoginUser || undefined);
                }}
                className="text-[9px] text-slate-300 hover:text-indigo-400 transition-colors uppercase font-black tracking-tighter"
              >
                SaaS Back-office
              </button>
            </div>
          </div>
        </div>
      ) : (
        currentUser.role === UserRole.EMPLOYEE ? (
          <EmployeeView 
            user={currentUser} 
            logs={logs} 
            onLogsUpsert={handleLogsUpsert} 
            activeShifts={activeShiftsMap[currentUser.id] || { 1: null, 2: null, 3: null }}
            onActiveShiftsUpdate={(shifts) => handleActiveShiftsUpdate(currentUser.id, shifts)}
            onOvertime={(user, slot) => {
              if (currentOrg?.notificationSettings?.onOvertime) {
                sendNotification('Превышение лимита', `Сотрудник ${user.name} превысил лимит времени смены.`);
              }
            }}
            machines={machines} 
            positions={positions} 
            onUpdateUser={handleUpdateUser}
            nightShiftBonusMinutes={nightShiftBonus}
            onRefresh={handleRefresh}
            planLimits={PLAN_LIMITS[currentOrg?.plan || PlanType.FREE]}
            currentOrg={currentOrg}
          />
        ) : (
          isEmployerAuthorized ? (
            <EmployerView 
              logs={logs} 
              users={users} 
              onAddUser={handleAddUser} 
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser} 
              machines={machines}
              onUpdateMachines={persistMachines}
              positions={positions}
              onUpdatePositions={persistPositions}
              onImportData={handleImportData}
              onLogsUpsert={handleLogsUpsert}
              activeShiftsMap={activeShiftsMap}
              onActiveShiftsUpdate={handleActiveShiftsUpdate}
              onDeleteLog={handleDeleteLog}
              onRefresh={handleRefresh}
              isSyncing={isSyncing}
              nightShiftBonusMinutes={nightShiftBonus}
              onUpdateNightBonus={setNightShiftBonus}
              currentOrg={currentOrg}
              plans={plans}
              onUpdateOrg={setCurrentOrg}
            />
          ) : (
            <div className="text-center py-20">
              <h2 className="text-2xl font-black text-slate-900 uppercase">Доступ ограничен</h2>
              <p className="text-slate-500 mt-2 font-medium">У вас нет прав для просмотра этого раздела.</p>
              <button onClick={() => handleSwitchRole(UserRole.EMPLOYEE)} className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs">Вернуться в Мой Табель</button>
            </div>
          )
        )
      )}
    </Layout>
  );
};

export default App;
