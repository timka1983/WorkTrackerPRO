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
  DEFAULT_PERMISSIONS, PLAN_LIMITS, DEFAULT_PAYROLL_CONFIG 
} from '../constants';
import { sendNotification } from '../utils';

import { useTimeSync } from './useTimeSync';
import { cleanupDatabase, removeBase64Photos } from '../services/cleanupService';

const DEFAULT_ORG_ID = 'demo_org';

// Helper to strip '$' prefix or any other leading non-alphanumeric characters
const cleanValue = (val: any) => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(/^[^a-zA-Z0-9]+/, '');
    return cleaned;
  }
  return val;
};

export const useAppData = (currentUser: User | null) => {
  const queryClient = useQueryClient();
  const { getNow } = useTimeSync();
  
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
        // If we have cached data, use it instead of reloading
        const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.id === orgId) return parsed;
        }
        
        // Only redirect if we are sure it doesn't exist (not just a network error)
        // For now, let's just return null and let the UI handle it, or use cache
        console.error('Organization not found or network error');
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
      try {
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
        
        if (fetchedUsers === null) {
          // Keep cached data on error
          const cached = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
          return cached ? JSON.parse(cached) : [];
        }
        
        return fetchedUsers;
      } catch (e) {
        console.error('Error fetching users:', e);
        const cached = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
        return cached ? JSON.parse(cached) : [];
      }
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
      console.log('Fetching positions for org:', orgId);
      const fetched = await db.getPositions(orgId);
      
      if (fetched === null) {
        console.error('Failed to fetch positions from DB');
        const cached = localStorage.getItem(STORAGE_KEYS.POSITIONS_LIST);
        return cached ? JSON.parse(cached) : INITIAL_POSITIONS;
      }

      // If we have positions in DB, use them
      if (fetched.length > 0) {
        return fetched;
      }

      // If DB is empty, try to extract from users first
      const uniqueUserPositions = Array.from(new Set(users.map(u => u.position).filter(Boolean)));
      
      if (uniqueUserPositions.length > 0) {
        console.log('Found positions in users table:', uniqueUserPositions);
        const extractedPositions: PositionConfig[] = uniqueUserPositions.map(name => {
          const initial = INITIAL_POSITIONS.find(p => p.name === name);
          return initial || { name, permissions: DEFAULT_PERMISSIONS, payroll: DEFAULT_PAYROLL_CONFIG };
        });
        
        // Also add missing INITIAL_POSITIONS that are not in users
        INITIAL_POSITIONS.forEach(p => {
          if (!extractedPositions.find(ep => ep.name === p.name)) {
            extractedPositions.push(p);
          }
        });

        await db.savePositions(extractedPositions, orgId);
        return extractedPositions;
      }

      // Fallback to INITIAL_POSITIONS
      console.log('No positions found in DB or users, seeding INITIAL_POSITIONS');
      await db.savePositions(INITIAL_POSITIONS, orgId);
      return INITIAL_POSITIONS;
    },
    initialData: () => {
      const cached = localStorage.getItem(STORAGE_KEYS.POSITIONS_LIST);
      return cached ? JSON.parse(cached) : INITIAL_POSITIONS;
    },
    enabled: !!orgId && !isUsersFetching // Wait for users to be fetched to extract positions if needed
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
          map[cleanValue(s.user_id)] = parsed || {};
        });
      }
      setActiveShiftsMap(map);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(map));
      return map;
    }
  });

  // 8. Initial Logs Load (Current + Prev Month)
  const { isFetching: isLogsFetching, error: logsError } = useQuery({
    queryKey: ['initialLogs', orgId],
    queryFn: async () => {
      try {
        const now = getNow();
        const currentMonth = format(now, 'yyyy-MM');
        const prevMonth = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM');
        
        const [current, prev] = await Promise.all([
          db.getLogs(orgId, currentMonth),
          db.getLogs(orgId, prevMonth)
        ]);
        
        const combinedRaw = [...(current || []), ...(prev || [])];
        const combined = combinedRaw.map(l => ({
          ...l,
          id: cleanValue(l.id),
          userId: cleanValue(l.userId),
          organizationId: cleanValue(l.organizationId),
          date: cleanValue(l.date),
          machineId: cleanValue(l.machineId),
          checkIn: cleanValue(l.checkIn),
          checkOut: cleanValue(l.checkOut)
        }));
        
        if (combined.length > 0 || (current !== null && prev !== null)) {
          // Merge with offline queue to prevent losing unsynced logs
          setLogs(prevLogs => {
            const offlineLogs = offlineQueue.flat();
            const offlineIds = new Set(offlineLogs.map(l => l.id));
            
            // Keep offline logs, and add server logs that are not in offline queue
            const mergedRaw = [...offlineLogs, ...combined.filter(l => !offlineIds.has(l.id))];
            
            const merged = mergedRaw.map(l => ({
              ...l,
              id: cleanValue(l.id),
              userId: cleanValue(l.userId),
              organizationId: cleanValue(l.organizationId),
              date: cleanValue(l.date),
              machineId: cleanValue(l.machineId),
              checkIn: cleanValue(l.checkIn),
              checkOut: cleanValue(l.checkOut)
            }));
            
            const sorted = merged.sort((a, b) => {
              const dateCompare = b.date.localeCompare(a.date);
              if (dateCompare !== 0) return dateCompare;
              return (b.checkIn || '').localeCompare(a.checkIn || '');
            });
            
            localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(sorted));
            return sorted;
          });

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
              const uId = String(log.userId).trim();
              if (!newMap[uId] || typeof newMap[uId] !== 'object') {
                newMap[uId] = {};
              }
              const userShifts = newMap[uId];
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
        }
        return combined;
      } catch (e: any) {
        setDbError(`Ошибка загрузки данных: ${e.message || 'Проверьте подключение'}`);
        throw e;
      }
    },
    refetchOnWindowFocus: false,
    retry: 2
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
          isNightShift: payload.new.is_night_shift,
          fine: payload.new.fine,
          bonus: payload.new.bonus
        };

        setLogs(prev => {
          // Skip if this log is currently in the offline queue (being synced)
          const isOffline = offlineQueue.flat().some(l => l.id === newLog.id);
          if (isOffline) return prev;

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
        
        // We don't need to invalidate the whole query here since we optimistically updated the state
        // queryClient.invalidateQueries({ queryKey: ['initialLogs', id] });
        
      } else if (payload.eventType === 'DELETE') {
        setLogs(prev => {
          const updated = prev.filter(l => l.id !== payload.old.id);
          localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(updated));
          return updated;
        });
        // queryClient.invalidateQueries({ queryKey: ['initialLogs', id] });
      }
    });

    const unsubUsers = db.subscribeToChanges(id, 'users', () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    });

    const unsubActiveShifts = db.subscribeToChanges(id, 'active_shifts', (payload) => {
       // We don't need to invalidate the whole query here since we optimistically updated the state
       // queryClient.invalidateQueries({ queryKey: ['activeShifts', id] });
       
       // 2. Optimistically update local state immediately
       if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setActiveShiftsMap(prev => {
          let parsed = payload.new.shifts || payload.new.shifts_json;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (e) { parsed = {}; }
          }
          const updated = {
            ...prev,
            [payload.new.user_id]: parsed || {}
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

  const [offlineQueue, setOfflineQueue] = useState<WorkLog[][]>(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return cached ? JSON.parse(cached) : [];
  });

  // --- Offline Sync Logic ---
  const syncOfflineQueue = useCallback(async () => {
    if (!currentOrg || offlineQueue.length === 0 || !navigator.onLine) return;

    const queue = [...offlineQueue];
    const logsToSync = queue.shift();

    if (logsToSync) {
      try {
        const { error } = await db.batchUpsertLogs(logsToSync, currentOrg.id);
        if (!error) {
          setOfflineQueue(queue);
          localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
          // If more items, continue syncing
          if (queue.length > 0) {
            setTimeout(syncOfflineQueue, 1000);
          } else {
            setSyncError(null);
            queryClient.invalidateQueries({ queryKey: ['initialLogs', currentOrg.id] });
          }
        } else {
          console.error('Failed to sync offline logs:', error);
        }
      } catch (e) {
        console.error('Exception syncing offline logs:', e);
      }
    }
  }, [currentOrg, offlineQueue]);

  useEffect(() => {
    const handleOnline = () => {
      syncOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    
    // Try to sync on mount if online
    if (navigator.onLine && offlineQueue.length > 0) {
      syncOfflineQueue();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [syncOfflineQueue, offlineQueue.length]);


  // --- Mutations ---

  const upsertLogsMutation = useMutation({
    mutationFn: async (logsToUpsert: WorkLog[]) => {
      if (!currentOrg) throw new Error('Организация не выбрана');
      
      // Check for offline status explicitly
      if (!navigator.onLine) {
        throw new Error('OFFLINE');
      }

      const { error } = await db.batchUpsertLogs(logsToUpsert, currentOrg.id);
      if (error) throw error;
      return logsToUpsert;
    },
    retry: 3, // Retry up to 3 times on failure
    onMutate: async (logsToUpsert) => {
      if (!currentOrg) return;

      // Optimistic Update Logs
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
                if (navigator.onLine) {
                    db.saveActiveShifts(log.userId, newUserShifts, currentOrg.id);
                }
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
    },
    onError: (error: any, variables) => {
      console.error('Mutation error:', error);
      
      // If offline or network error, save to queue
      if (error.message === 'OFFLINE' || error.message?.includes('network') || !navigator.onLine) {
        setSyncError('Нет сети. Данные сохранены и будут отправлены позже.');
        
        setOfflineQueue(prev => {
          const newQueue = [...prev, variables];
          localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(newQueue));
          return newQueue;
        });
      } else {
        setSyncError('Ошибка синхронизации. Повторная попытка...');
      }
    },
    onSuccess: () => {
      setSyncError(null);
    },
    onSettled: () => {
      // Don't invalidate queries here to prevent excessive DB calls (egress).
      // We rely on optimistic updates and real-time subscriptions.
      // queryClient.invalidateQueries({ queryKey: ['initialLogs', orgId] });
    }
  });

  const handleLogsUpsert = useCallback((logsToUpsert: WorkLog[]) => {
    upsertLogsMutation.mutate(logsToUpsert);
  }, [upsertLogsMutation]);

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

  const addUserMutation = useMutation({
    mutationFn: async (user: User) => {
      if (!currentOrg) throw new Error('Организация не выбрана');
      const { error } = await db.upsertUser(user, currentOrg.id);
      if (error) {
        if (typeof error === 'object' && (error as any).message?.includes('LIMIT_REACHED')) {
          throw new Error((error as any).message.split(': ')[1] || 'LIMIT_REACHED');
        }
        throw error;
      }
      return user;
    },
    retry: 3,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentOrg?.id] });
    },
    onError: (error: any) => {
      if (error.message === 'LIMIT_REACHED' || error.message?.includes('Лимит')) {
        setUpgradeReason(error.message === 'LIMIT_REACHED' ? 'Лимит сотрудников исчерпан.' : error.message);
        setShowUpgradeModal(true);
      } else {
        alert('Ошибка при добавлении сотрудника.');
      }
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (user: User) => {
      if (!currentOrg) throw new Error('Организация не выбрана');
      const { error } = await db.upsertUser(user, currentOrg.id);
      if (error) throw error;
      return user;
    },
    onMutate: async (updatedUser) => {
      await queryClient.cancelQueries({ queryKey: ['users', currentOrg?.id] });
      const previousUsers = queryClient.getQueryData(['users', currentOrg?.id]);
      queryClient.setQueryData(['users', currentOrg?.id], (old: User[] | undefined) => {
        if (!old) return [updatedUser];
        return old.map(u => u.id === updatedUser.id ? updatedUser : u);
      });
      return { previousUsers };
    },
    onError: (err, updatedUser, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['users', currentOrg?.id], context.previousUsers);
      }
      alert('Ошибка при обновлении сотрудника.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentOrg?.id] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentOrg?.id] });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentOrg) throw new Error('Организация не выбрана');
      const { error } = await db.deleteUser(userId, currentOrg.id);
      if (error) throw error;
      return userId;
    },
    retry: 3,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentOrg?.id] });
    }
  });

  const saveMachinesMutation = useMutation({
    mutationFn: async (newMachines: Machine[]) => {
      if (!currentOrg) throw new Error('Организация не выбрана');
      const { error } = await db.saveMachines(newMachines, currentOrg.id);
      if (error) {
        if (typeof error === 'object' && (error as any).message?.includes('LIMIT_REACHED')) {
          throw new Error((error as any).message.split(': ')[1] || 'LIMIT_REACHED');
        }
        throw error;
      }
      return newMachines;
    },
    retry: 3,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', currentOrg?.id] });
    },
    onError: (error: any) => {
      if (error.message === 'LIMIT_REACHED' || error.message?.includes('Лимит')) {
        setUpgradeReason(error.message === 'LIMIT_REACHED' ? 'Лимит оборудования исчерпан.' : error.message);
        setShowUpgradeModal(true);
      } else {
        alert('Ошибка при сохранении оборудования.');
      }
    }
  });

  const savePositionsMutation = useMutation({
    mutationFn: async (newPositions: PositionConfig[]) => {
      if (!currentOrg) throw new Error('Организация не выбрана');
      const { error } = await db.savePositions(newPositions, currentOrg.id);
      if (error) throw error;
      return newPositions;
    },
    retry: 3,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', currentOrg?.id] });
    },
    onError: (error: any) => {
      console.error('Error saving positions:', error);
      alert('Ошибка при сохранении должностей: ' + (error.message || 'Неизвестная ошибка'));
    }
  });

  const handleAddUser = async (user: User) => {
    if (!checkLimit('users')) return;
    addUserMutation.mutate(user);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    updateUserMutation.mutate(updatedUser);
  };

  const handleDeleteUser = async (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const persistMachines = async (newMachines: Machine[]) => {
    if (newMachines.length > machines.length && !checkLimit('machines')) return;
    saveMachinesMutation.mutate(newMachines);
  };

  const persistPositions = async (newPositions: PositionConfig[]) => {
    savePositionsMutation.mutate(newPositions);
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

  // --- Memoized Lookup Maps [OPT-001] ---
  const logsLookup = useMemo(() => {
    const map: Record<string, Record<string, WorkLog[]>> = {};
    logs.forEach(log => {
      if (!log.userId || !log.date) return;
      // Normalize date to YYYY-MM-DD
      const normalizedDate = cleanValue(log.date).includes('T') ? cleanValue(log.date).split('T')[0] : cleanValue(log.date);
      const userIdStr = cleanValue(log.userId);
      
      if (!map[userIdStr]) map[userIdStr] = {};
      if (!map[userIdStr][normalizedDate]) map[userIdStr][normalizedDate] = [];
      map[userIdStr][normalizedDate].push(log);
    });
    return map;
  }, [logs]);

  // --- Safety Net: Force clean logs if they somehow got dirty ---
  useEffect(() => {
    const hasDirty = logs.some(l => 
      (typeof l.userId === 'string' && l.userId.startsWith('$')) || 
      (typeof l.date === 'string' && l.date.startsWith('$'))
    );
    if (hasDirty) {
      console.warn('Safety net: Cleaning dirty logs in state');
      const cleaned = logs.map(l => ({
        ...l,
        id: cleanValue(l.id),
        userId: cleanValue(l.userId),
        organizationId: cleanValue(l.organizationId),
        date: cleanValue(l.date),
        machineId: cleanValue(l.machineId),
        checkIn: cleanValue(l.checkIn),
        checkOut: cleanValue(l.checkOut)
      }));
      setLogs(cleaned);
      localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(cleaned));
    }
  }, [logs]);

  const forceCleanAll = () => {
    const cleaned = logs.map(l => ({
      ...l,
      id: cleanValue(l.id),
      userId: cleanValue(l.userId),
      organizationId: cleanValue(l.organizationId),
      date: cleanValue(l.date),
      machineId: cleanValue(l.machineId),
      checkIn: cleanValue(l.checkIn),
      checkOut: cleanValue(l.checkOut)
    }));
    setLogs(cleaned);
    localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(cleaned));
    alert('Данные очищены от лишних символов');
  };

  const handleCleanupDatabase = async () => {
    if (!currentOrg) return;
    if (confirm('Это действие объединит дубликаты сотрудников (например, admin и $admin) и исправит ссылки в логах. Продолжить?')) {
      await cleanupDatabase(currentOrg.id);
      await initData(true);
      alert('База данных очищена. Страница будет перезагружена.');
      window.location.reload();
    }
  };

  const handleRemoveBase64Photos = async () => {
    if (!currentOrg) return;
    if (confirm('Это действие удалит все фото, сохраненные в формате Base64 (внутри базы), чтобы снизить нагрузку. Фото в хранилище останутся. Продолжить?')) {
      const res = await removeBase64Photos(currentOrg.id);
      if (res.errors.length > 0) {
        alert('Возникли ошибки: ' + res.errors.join(', '));
      } else {
        alert(`Удалено фото из ${res.photosRemoved} записей. Страница будет перезагружена.`);
        window.location.reload();
      }
    }
  };

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
    logsLookup,
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
    checkLimit,
    forceCleanAll,
    handleCleanupDatabase,
    handleRemoveBase64Photos
  };
};
