import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { db } from '../lib/supabase';
import { 
  User, UserRole, WorkLog, Machine, PositionConfig, Organization, 
  PlanType, Plan, EntryType 
} from '../types';
import { 
  STORAGE_KEYS, INITIAL_USERS, INITIAL_MACHINES, INITIAL_POSITIONS, 
  DEFAULT_PERMISSIONS, PLAN_LIMITS 
} from '../constants';
import { sendNotification } from '../utils';

const DEFAULT_ORG_ID = 'demo_org';

export const useAppData = (currentUser: User | null) => {
  const queryClient = useQueryClient();
  
  // --- State for UI and Logic ---
  const [logs, setLogs] = useState<WorkLog[]>(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);
    return cached ? JSON.parse(cached) : [];
  });
  
  const [activeShiftsMap, setActiveShiftsMap] = useState<Record<string, any>>(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFTS);
    return cached ? JSON.parse(cached) : {};
  });

  const [syncError, setSyncError] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [nightShiftBonus, setNightShiftBonus] = useState<number>(() => {
    const saved = localStorage.getItem('timesheet_night_bonus');
    return saved ? parseInt(saved) : 120;
  });

  const [superAdminPin, setSuperAdminPin] = useState('7777');
  const [globalAdminPin, setGlobalAdminPin] = useState('0000');

  // --- Org ID Logic ---
  const [orgId, setOrgId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgId = urlParams.get('org_switch');
    
    if (urlOrgId) {
      localStorage.setItem(STORAGE_KEYS.ORG_ID, urlOrgId);
      localStorage.removeItem(STORAGE_KEYS.ORG_DATA);
      localStorage.removeItem(STORAGE_KEYS.USERS_LIST);
      localStorage.removeItem(STORAGE_KEYS.WORK_LOGS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
      window.history.replaceState({}, '', window.location.pathname);
      return urlOrgId;
    }
    return localStorage.getItem(STORAGE_KEYS.ORG_ID) || DEFAULT_ORG_ID;
  });

  // --- Refs for Real-time ---
  const currentUserRef = useRef(currentUser);
  const usersRef = useRef<User[]>([]);
  const currentOrgRef = useRef<Organization | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('timesheet_night_bonus', nightShiftBonus.toString());
  }, [nightShiftBonus]);

  // --- Queries ---

  // 1. Organization
  const { data: currentOrg, isFetching: isOrgFetching } = useQuery<Organization | null>({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const isConnected = await db.checkConnection();
      if (!isConnected) setDbError('Нет подключения к базе данных.');
      else setDbError(null);

      const org = await db.getOrganization(orgId);
      if (org) {
        // Check expiry
        const isExpired = org.expiryDate && new Date(org.expiryDate) < new Date();
        if (isExpired && org.status !== 'expired' && org.plan !== PlanType.FREE) {
          org.status = 'expired';
          org.plan = PlanType.FREE;
          await db.updateOrganization(orgId, { status: 'expired', plan: PlanType.FREE });
          setUpgradeReason(`Срок действия тарифа истек.`);
        }
        return org as Organization;
      } else if (orgId === DEFAULT_ORG_ID) {
        const defaultOrg: Organization = { 
          id: DEFAULT_ORG_ID, 
          name: 'Моя Компания', 
          ownerId: 'admin', 
          plan: PlanType.FREE, 
          status: 'active' 
        };
        await db.createOrganization(defaultOrg);
        return defaultOrg;
      } else {
        // Invalid Org ID, redirect to default
        localStorage.setItem(STORAGE_KEYS.ORG_ID, DEFAULT_ORG_ID);
        window.location.reload();
        return null;
      }
    },
    initialData: () => {
      const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
      return cached ? JSON.parse(cached) : null;
    }
  });

  // Update refs and storage when org changes
  useEffect(() => {
    if (currentOrg) {
      currentOrgRef.current = currentOrg;
      localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(currentOrg));
    }
  }, [currentOrg]);

  // 2. Users
  const { data: users = [], isFetching: isUsersFetching } = useQuery<User[]>({
    queryKey: ['users', orgId],
    queryFn: async () => {
      let fetchedUsers = (await db.getUsers(orgId)) as User[] | null;
      
      // Seeding logic
      if (fetchedUsers !== null && orgId === DEFAULT_ORG_ID && fetchedUsers.length === 0) {
        for (const u of INITIAL_USERS) await db.upsertUser(u, orgId);
        fetchedUsers = INITIAL_USERS;
      } else if (fetchedUsers && fetchedUsers.length > 0) {
        const hasAdmin = fetchedUsers.some(u => u.id === 'admin');
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
          fetchedUsers.push(defaultAdmin);
        }
      } else if (fetchedUsers !== null && orgId !== DEFAULT_ORG_ID && fetchedUsers.length === 0) {
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
        fetchedUsers = [defaultAdmin];
      }
      return fetchedUsers || [];
    },
    initialData: () => {
      const cached = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
      return cached ? JSON.parse(cached) : [];
    }
  });

  useEffect(() => {
    usersRef.current = users;
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(users));
  }, [users]);

  // 3. Machines
  const { data: machines = [], isFetching: isMachinesFetching } = useQuery({
    queryKey: ['machines', orgId],
    queryFn: async () => {
      const fetched = await db.getMachines(orgId);
      if (fetched && fetched.length > 0) return fetched;
      
      if (orgId === DEFAULT_ORG_ID) {
        await db.saveMachines(INITIAL_MACHINES, orgId);
        return INITIAL_MACHINES;
      }
      return [];
    },
    initialData: () => {
      const cached = localStorage.getItem(STORAGE_KEYS.MACHINES_LIST);
      return cached ? JSON.parse(cached) : [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MACHINES_LIST, JSON.stringify(machines));
  }, [machines]);

  // 4. Positions
  const { data: positions = [], isFetching: isPositionsFetching } = useQuery({
    queryKey: ['positions', orgId],
    queryFn: async () => {
      const fetched = await db.getPositions(orgId);
      if (fetched && fetched.length > 0) {
        return fetched.map((p: any) => 
          typeof p === 'string' 
            ? (INITIAL_POSITIONS.find(ip => ip.name === p) || { name: p, permissions: DEFAULT_PERMISSIONS }) 
            : p
        );
      }
      if (!fetched || fetched.length === 0) {
        await db.savePositions(INITIAL_POSITIONS, orgId);
        return INITIAL_POSITIONS;
      }
      return [];
    },
    initialData: () => {
      const cached = localStorage.getItem(STORAGE_KEYS.POSITIONS_LIST);
      return cached ? JSON.parse(cached) : INITIAL_POSITIONS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.POSITIONS_LIST, JSON.stringify(positions));
  }, [positions]);

  // 5. Plans
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const fetched = await db.getPlans();
      if (fetched) {
        return [...fetched].sort((a: any, b: any) => {
          const order: Record<string, number> = { [PlanType.FREE]: 0, [PlanType.PRO]: 1, [PlanType.BUSINESS]: 2 };
          return (order[a.type] ?? 99) - (order[b.type] ?? 99);
        });
      }
      return [];
    },
    initialData: []
  });

  // 6. Config
  useQuery({
    queryKey: ['systemConfig'],
    queryFn: async () => {
      const config = await db.getSystemConfig();
      if (config?.super_admin_pin) setSuperAdminPin(config.super_admin_pin);
      if (config?.global_admin_pin) setGlobalAdminPin(config.global_admin_pin);
      return config;
    }
  });

  // 7. Active Shifts
  useQuery({
    queryKey: ['activeShifts', orgId],
    queryFn: async () => {
      const shifts = await db.getAllActiveShifts(orgId);
      const map: Record<string, any> = {};
      if (shifts) {
        shifts.forEach((s: any) => {
          let parsed = s.shifts || s.shifts_json;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (e) { parsed = {}; }
          }
          map[s.user_id] = parsed || {};
        });
      }
      setActiveShiftsMap(map);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(map));
      return map;
    }
  });

  // 8. Initial Logs Load (Current + Prev Month)
  const { isFetching: isLogsFetching } = useQuery({
    queryKey: ['initialLogs', orgId],
    queryFn: async () => {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const prevMonth = format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM');
      
      const [current, prev] = await Promise.all([
        db.getLogs(orgId, currentMonth),
        db.getLogs(orgId, prevMonth)
      ]);
      
      const combined = [...(current || []), ...(prev || [])];
      
      // Update local state
      setLogs(combined);
      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(combined));
      
      // Sync Active Shifts Map with Logs
      setActiveShiftsMap(prevMap => {
        const newMap = { ...prevMap };
        // Clear finished shifts
        Object.keys(newMap).forEach(userId => {
          const userShifts = newMap[userId];
          if (userShifts && typeof userShifts === 'object') {
            Object.keys(userShifts).forEach(slot => {
              const shift = userShifts[slot];
              if (shift && shift.id) {
                const log = combined.find(l => l.id === shift.id);
                if (log && log.checkOut) {
                  userShifts[slot] = null;
                }
              }
            });
          }
        });
        
        // Add open shifts
        const openLogs = combined.filter(l => !l.checkOut && l.entryType === EntryType.WORK);
        openLogs.forEach(log => {
          if (!newMap[log.userId] || typeof newMap[log.userId] !== 'object') {
            newMap[log.userId] = {};
          }
          const userShifts = newMap[log.userId];
          let slot = 1;
          const parts = log.id.split('-');
          if (parts.length >= 4) {
            const parsedSlot = parseInt(parts[parts.length - 1]);
            if (!isNaN(parsedSlot)) slot = parsedSlot;
          }
          if (!userShifts[slot] || userShifts[slot].id !== log.id) {
            userShifts[slot] = log;
          }
        });
        
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(newMap));
        return newMap;
      });

      return combined;
    },
    refetchOnWindowFocus: false
  });

  // --- Real-time Subscriptions ---
  useEffect(() => {
    if (!currentOrg) return;
    const id = currentOrg.id;

    const unsubLogs = db.subscribeToChanges(id, 'work_logs', (payload) => {
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
          
          // Notifications
          const cUser = currentUserRef.current;
          const cUsers = usersRef.current;
          const cOrg = currentOrgRef.current;
          
          if (cUser && (cUser.role === UserRole.EMPLOYER || cUser.isAdmin) && newLog.userId !== cUser.id) {
             const logUser = cUsers.find(u => u.id === newLog.userId);
             if (logUser && cOrg?.notificationSettings) {
                if (!exists && !newLog.checkOut && cOrg.notificationSettings.onShiftStart) {
                   sendNotification('Смена начата', `${logUser.name} приступил к работе.`);
                }
                if (exists && !exists.checkOut && newLog.checkOut && cOrg.notificationSettings.onShiftEnd) {
                   sendNotification('Смена завершена', `${logUser.name} закончил работу.`);
                }
             }
          }

          if (exists && JSON.stringify(exists) === JSON.stringify(newLog)) return prev;
          
          const filtered = prev.filter(l => l.id !== newLog.id);
          const updated = [newLog, ...filtered].sort((a, b) => {
             const dateCompare = b.date.localeCompare(a.date);
             if (dateCompare !== 0) return dateCompare;
             return (b.checkIn || '').localeCompare(a.checkIn || '');
          });
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(updated));
          return updated;
        });
        
        // Also invalidate query to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['initialLogs', id] });
        
      } else if (payload.eventType === 'DELETE') {
        setLogs(prev => {
          const updated = prev.filter(l => l.id !== payload.old.id);
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(updated));
          return updated;
        });
        queryClient.invalidateQueries({ queryKey: ['initialLogs', id] });
      }
    });

    const unsubUsers = db.subscribeToChanges(id, 'users', () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    });

    const unsubActiveShifts = db.subscribeToChanges(id, 'active_shifts', (payload) => {
       // 1. Invalidate query to fetch fresh data eventually
       queryClient.invalidateQueries({ queryKey: ['activeShifts', id] });
       
       // 2. Optimistically update local state immediately
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

    const unsubOrg = db.subscribeToChanges(id, 'organizations', () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
    });

    const unsubPositions = db.subscribeToChanges(id, 'positions', () => {
      queryClient.invalidateQueries({ queryKey: ['positions', id] });
    });

    return () => {
      unsubLogs();
      unsubUsers();
      unsubActiveShifts();
      unsubOrg();
      unsubPositions();
    };
  }, [currentOrg?.id, queryClient]);

  // --- Actions / Mutations ---

  const checkLimit = useCallback((type: 'users' | 'machines' | 'nightShift' | 'photo') => {
    if (!currentOrg) return true;
    const currentPlan = plans.find(p => p.type === currentOrg.plan);
    const limits = currentPlan ? currentPlan.limits : PLAN_LIMITS[currentOrg.plan as PlanType];
    
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
  }, [currentOrg, users.length, machines.length, plans]);

  const loadLogsForMonth = useCallback(async (month: string) => {
    if (!currentOrg) return;
    try {
      const newLogs = await db.getLogs(currentOrg.id, month);
      if (newLogs) {
        setLogs(prev => {
          const newLogIds = new Set(newLogs.map(l => l.id));
          const prevKept = prev.filter(l => !newLogIds.has(l.id));
          const merged = [...prevKept, ...newLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(merged));
          return merged;
        });
      }
    } catch (e) {
      console.error('Failed to load logs', e);
    }
  }, [currentOrg]);

  const handleLogsUpsert = useCallback((logsToUpsert: WorkLog[]) => {
    if (!currentOrg) return;
    
    // Optimistic Update
    setLogs(prev => {
      const updated = [...prev];
      logsToUpsert.forEach(newLog => {
        const index = updated.findIndex(l => l.id === newLog.id);
        if (index !== -1) updated[index] = newLog;
        else updated.unshift(newLog);
      });
      const sorted = updated.sort((a, b) => {
         const dateCompare = b.date.localeCompare(a.date);
         if (dateCompare !== 0) return dateCompare;
         return (b.checkIn || '').localeCompare(a.checkIn || '');
      });
      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(sorted));
      return sorted;
    });

    // Optimistic Active Shifts
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
              // Sync with server immediately to prevent stale state on other devices
              db.saveActiveShifts(log.userId, newUserShifts, currentOrg.id);
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

    // Notifications
    if (currentOrg.notificationSettings) {
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

    // DB Call
    setSyncError(null);
    db.batchUpsertLogs(logsToUpsert, currentOrg.id)
      .then(({ error }) => {
        if (error) {
          setSyncError('Ошибка синхронизации.');
          console.error(error);
        }
      })
      .catch(() => setSyncError('Критическая ошибка синхронизации.'));
  }, [currentOrg, users]);

  const handleActiveShiftsUpdate = useCallback((userId: string, shifts: any) => {
    if (!currentOrg) return;
    setActiveShiftsMap(prev => {
      const updated = { ...prev, [userId]: shifts };
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(updated));
      return updated;
    });
    db.saveActiveShifts(userId, shifts, currentOrg.id);
  }, [currentOrg]);

  const handleDeleteLog = (logId: string) => {
    if (!currentOrg) return;
    const newLogs = logs.filter(l => l.id !== logId);
    setLogs(newLogs);
    localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(newLogs));
    db.deleteLog(logId, currentOrg.id);
  };

  const handleAddUser = async (user: User) => {
    if (!checkLimit('users')) return;
    if (!currentOrg) return;
    
    const { error } = await db.upsertUser(user, currentOrg.id);
    if (error) {
      if (typeof error === 'object' && (error as any).message?.includes('LIMIT_REACHED')) {
        setUpgradeReason((error as any).message.split(': ')[1] || 'Лимит сотрудников исчерпан.');
      } else {
        alert('Ошибка при добавлении сотрудника.');
      }
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['users', currentOrg.id] });
  };

  const handleUpdateUser = async (updatedUser: User) => {
    if (!currentOrg) return;
    const { error } = await db.upsertUser(updatedUser, currentOrg.id);
    if (error) {
      alert('Ошибка при обновлении сотрудника.');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['users', currentOrg.id] });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!currentOrg) return;
    await db.deleteUser(userId, currentOrg.id);
    queryClient.invalidateQueries({ queryKey: ['users', currentOrg.id] });
  };

  const persistMachines = async (newMachines: Machine[]) => {
    if (!currentOrg) return;
    if (newMachines.length > machines.length && !checkLimit('machines')) return;
    
    const { error } = await db.saveMachines(newMachines, currentOrg.id);
    if (error) {
      if (typeof error === 'object' && (error as any).message?.includes('LIMIT_REACHED')) {
        setUpgradeReason((error as any).message.split(': ')[1] || 'Лимит оборудования исчерпан.');
      } else {
        alert('Ошибка при сохранении оборудования.');
      }
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['machines', currentOrg.id] });
  };

  const persistPositions = async (newPositions: PositionConfig[]) => {
    if (!currentOrg) return;
    await db.savePositions(newPositions, currentOrg.id);
    queryClient.invalidateQueries({ queryKey: ['positions', currentOrg.id] });
  };

  const handleImportData = async (jsonStr: string) => {
    if (!currentOrg) return;
    try {
      const data = JSON.parse(jsonStr);
      if (data.users) await db.batchUpsertUsers(data.users, currentOrg.id);
      if (data.logs) await db.batchUpsertLogs(data.logs, currentOrg.id);
      if (data.machines) await db.saveMachines(data.machines, currentOrg.id);
      if (data.positions) await db.savePositions(data.positions.map((p: any) => typeof p === 'string' ? p : p.name), currentOrg.id);
      
      alert('Импорт успешен!');
      window.location.reload();
    } catch (e) {
      alert('Ошибка импорта!');
    }
  };

  const initData = async (isRefresh = false) => {
    if (isRefresh) {
      await queryClient.invalidateQueries();
    }
  };

  const handleRefresh = async () => {
    await initData(true);
  };

  const isSyncing = isOrgFetching || isUsersFetching || isMachinesFetching || isPositionsFetching || isLogsFetching;

  return {
    currentOrg: currentOrg || null,
    setCurrentOrg: (val: Organization | null | ((prev: Organization | null) => Organization | null)) => {
        queryClient.setQueryData(['organization', orgId], (old: Organization | null) => {
            const newVal = typeof val === 'function' ? val(old) : val;
            if (newVal) localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(newVal));
            return newVal;
        });
    },
    users,
    logs,
    activeShiftsMap,
    syncError,
    machines,
    positions,
    plans,
    superAdminPin,
    globalAdminPin,
    upgradeReason,
    setUpgradeReason,
    showUpgradeModal,
    setShowUpgradeModal,
    nightShiftBonus,
    setNightShiftBonus,
    isInitialized: !!currentOrg,
    isSyncing,
    dbError,
    initData,
    handleRefresh,
    loadLogsForMonth,
    handleLogsUpsert,
    handleActiveShiftsUpdate,
    handleDeleteLog,
    handleAddUser,
    handleUpdateUser,
    handleDeleteUser,
    persistMachines,
    persistPositions,
    handleImportData,
    checkLimit
  };
};
