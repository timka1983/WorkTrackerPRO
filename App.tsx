import React, { useEffect, useMemo, useState, Suspense, useCallback } from 'react';
import { UserRole, PlanType, PositionConfig, User, WorkLog } from './types';
import { STORAGE_KEYS, DEFAULT_PERMISSIONS, PLAN_LIMITS } from './constants';
import { sendNotification, calculateMinutes, sendTelegramNotification } from './utils';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import ResetPinModal from './components/ResetPinModal';
import UpgradeModal from './components/UpgradeModal';
import NotificationModal from './components/NotificationModal';
import { useAppData } from './hooks/useAppData';
import { useAuth } from './hooks/useAuth';

import { useTimeSync } from './hooks/useTimeSync';
import { PaymentSuccess } from './components/PaymentSuccess';

// Lazy load heavy components
const EmployeeView = React.lazy(() => import('./components/EmployeeView'));
const EmployerView = React.lazy(() => import('./components/EmployerView'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const RegistrationForm = React.lazy(() => import('./components/RegistrationForm'));
const SuperAdminView = React.lazy(() => import('./components/SuperAdminView'));
const LoginScreen = React.lazy(() => import('./components/LoginScreen'));

const APP_VERSION = 'v2.2.0-PRO-SAAS';

const App: React.FC = () => {
  const auth = useAuth();
  const appData = useAppData(auth.currentUser);
  const { getNow } = useTimeSync();

  const [showRegistration, setShowRegistration] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [employerViewMode, setEmployerViewMode] = useState<'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit'>('analytics');
  const [employeeViewMode, setEmployeeViewMode] = useState<'control' | 'matrix'>('control');
  const [unreadSupportMessages, setUnreadSupportMessages] = useState(0);
  const [unreadByOrg, setUnreadByOrg] = useState<Record<string, number>>({});
  const [superAdminTab, setSuperAdminTab] = useState<string>('orgs');

  const handleResetUnread = useCallback(async (orgId?: string) => {
    const now = new Date().toISOString();
    const isSuperAdmin = auth.currentUser?.role === UserRole.SUPER_ADMIN;

    if (isSuperAdmin) {
      const lastReadMapStr = localStorage.getItem('last_read_support_superadmin');
      const lastReadMap = lastReadMapStr ? JSON.parse(lastReadMapStr) : {};

      if (orgId && orgId !== 'all') {
        lastReadMap[orgId] = now;
        localStorage.setItem('last_read_support_superadmin', JSON.stringify(lastReadMap));

        setUnreadByOrg(prev => {
          if (!prev[orgId]) return prev;
          const next = { ...prev };
          delete next[orgId];
          return next;
        });

        // Sync to DB for super admin
        try {
          await supabase.from('users').upsert({
            id: 'super-admin-meta',
            name: 'Super Admin Meta',
            organization_id: 'admin',
            telegram_settings: { lastReadMap }
          });
        } catch (e) {
          console.error('Error syncing super admin read status:', e);
        }
      }
    } else {
      const currentOrgId = orgId || auth.currentUser?.organizationId;
      if (currentOrgId && auth.currentUser) {
        setUnreadSupportMessages(0);
        localStorage.setItem(`last_read_support_${currentOrgId}`, now);
        
        // Sync to DB for employer
        try {
          await supabase.from('users').update({
            telegram_settings: { ...(auth.currentUser.telegramSettings || {}), lastSupportReadAt: now }
          }).eq('id', auth.currentUser.id);
        } catch (e) {
          console.error('Error syncing employer read status:', e);
        }
      }
    }
  }, [auth.currentUser]);

  const totalUnread = useMemo(() => {
    if (auth.currentUser?.role === UserRole.SUPER_ADMIN) {
      return Object.values(unreadByOrg).reduce((a, b) => a + b, 0);
    }
    return unreadSupportMessages;
  }, [unreadSupportMessages, unreadByOrg, auth.currentUser]);

  // Reset unread count when entering support view
  useEffect(() => {
    const isSuperAdmin = auth.currentUser?.role === UserRole.SUPER_ADMIN;
    if (isSuperAdmin) {
      // For super admin, we don't reset everything at once, 
      // but we might want to reset a specific org if it's being viewed
      // This is handled by SupportChat calling handleResetUnread(orgId)
    } else if (employerViewMode === 'support' && auth.currentUser) {
      handleResetUnread();
    }
  }, [employerViewMode, auth.currentUser, handleResetUnread]);

  // Handle super admin tab changes to sync unread counts
  useEffect(() => {
    if (auth.currentUser?.role === UserRole.SUPER_ADMIN && superAdminTab === 'support') {
      // When entering support tab, we might want to refresh unread counts
      // but not necessarily reset them until an org is selected
    }
  }, [superAdminTab, auth.currentUser]);

  // Fetch initial unread count
  useEffect(() => {
    const fetchInitialUnread = async () => {
      if (!auth.currentUser) return;
      const orgId = auth.currentUser.organizationId;
      const isSuperAdmin = auth.currentUser.role === UserRole.SUPER_ADMIN;

      if (isSuperAdmin) {
        // Try to fetch from DB first
        let lastReadMap = {};
        try {
          const { data: metaUser } = await supabase.from('users').select('telegram_settings').eq('id', 'super-admin-meta').maybeSingle();
          if (metaUser?.telegram_settings?.lastReadMap) {
            lastReadMap = metaUser.telegram_settings.lastReadMap;
            localStorage.setItem('last_read_support_superadmin', JSON.stringify(lastReadMap));
          } else {
            const lastReadMapStr = localStorage.getItem('last_read_support_superadmin');
            lastReadMap = lastReadMapStr ? JSON.parse(lastReadMapStr) : {};
          }
        } catch (e) {
          const lastReadMapStr = localStorage.getItem('last_read_support_superadmin');
          lastReadMap = lastReadMapStr ? JSON.parse(lastReadMapStr) : {};
        }
        
        // Fetch all messages not from super admin
        const { data, error } = await supabase
          .from('support_messages')
          .select('organization_id, created_at')
          .neq('sender_id', auth.currentUser.id);
          
        if (!error && data) {
          const unreadCounts: Record<string, number> = {};
          data.forEach(msg => {
            const org = msg.organization_id;
            const lastRead = (lastReadMap as any)[org];
            if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
              unreadCounts[org] = (unreadCounts[org] || 0) + 1;
            }
          });
          setUnreadByOrg(unreadCounts);
        }
        return;
      }

      if (!orgId) return;

      // Try to fetch from DB first
      let lastRead = localStorage.getItem(`last_read_support_${orgId}`);
      try {
        const { data: dbUser } = await supabase.from('users').select('telegram_settings').eq('id', auth.currentUser.id).maybeSingle();
        if (dbUser?.telegram_settings?.lastSupportReadAt) {
          lastRead = dbUser.telegram_settings.lastSupportReadAt;
          localStorage.setItem(`last_read_support_${orgId}`, lastRead!);
        }
      } catch (e) {}
      
      let query = supabase
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .neq('sender_id', auth.currentUser.id);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      const { count, error } = await query;
      if (!error && count !== null) {
        setUnreadSupportMessages(count);
      }
    };

    fetchInitialUnread();
  }, [auth.currentUser]);

  // Support Messages Realtime Subscription for Notifications
  useEffect(() => {
    if (!auth.currentUser) return;

    const orgId = auth.currentUser.organizationId;
    const isSuperAdmin = auth.currentUser.role === UserRole.SUPER_ADMIN;

    if (!isSuperAdmin && !orgId) return;

    const filter = isSuperAdmin ? undefined : `organization_id=eq.${orgId}`;

    const channel = supabase
      .channel(`support_notifications_${auth.currentUser?.id}_${orgId || 'admin'}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages',
        filter: filter
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;
          
          // Only notify if message is NOT from current user
          if (newMessage.sender_id === auth.currentUser?.id) return;

          // Check if message belongs to this org or if user is super admin
          if (isSuperAdmin || newMessage.organization_id === orgId) {
            // For super admin, we always track per-org unread messages 
            // unless they are currently viewing that specific org in support
            if (isSuperAdmin && newMessage.organization_id) {
              if (superAdminTab !== 'support') {
                setUnreadByOrg(prev => ({
                  ...prev,
                  [newMessage.organization_id]: (prev[newMessage.organization_id] || 0) + 1
                }));
              }
            } else if (employerViewMode !== 'support') {
              setUnreadSupportMessages(prev => prev + 1);
            }

            if (employerViewMode !== 'support' && (!isSuperAdmin || superAdminTab !== 'support')) {
              // Optional: browser notification
              sendNotification('Новое сообщение в техподдержке', newMessage.message);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth.currentUser, employerViewMode, superAdminTab]);

  const userPermissions = useMemo(() => {
    if (!auth.currentUser) return DEFAULT_PERMISSIONS;
    if (auth.currentUser.id === 'admin') return { ...DEFAULT_PERMISSIONS, isFullAdmin: true };
    const pos = appData.positions.find((p: PositionConfig) => p.name === auth.currentUser!.position);
    return pos?.permissions || DEFAULT_PERMISSIONS;
  }, [auth.currentUser, appData.positions]);

  const isSelectedUserAdmin = useMemo(() => {
    const user = auth.selectedLoginUser;
    if (!user) return false;
    if (user.id === 'admin') return true;
    const pos = appData.positions.find((p: PositionConfig) => p.name === user.position);
    return (pos?.permissions?.isFullAdmin || pos?.permissions?.isLimitedAdmin) ?? false;
  }, [auth.selectedLoginUser, appData.positions]);

  // Check if current user is archived
  useEffect(() => {
    if (auth.currentUser) {
      const user = appData.users.find(u => u.id === auth.currentUser?.id);
      if (user && user.isArchived) {
        auth.handleLogout();
        alert('Ваш аккаунт был заблокирован.');
      }
    }
  }, [auth.currentUser, appData.users]);

  const isEmployerAuthorized = useMemo(() => {
    return userPermissions.isFullAdmin || userPermissions.isLimitedAdmin;
  }, [userPermissions]);

  const isSuperAdmin = useMemo(() => {
    return auth.currentUser?.role === UserRole.SUPER_ADMIN;
  }, [auth.currentUser]);

  // Telegram Notification Monitor
  useEffect(() => {
    // Check if feature is enabled in plan
    const rawPlan = appData.currentOrg?.plan || PlanType.FREE;
    const currentPlanType = String(rawPlan).toUpperCase() as PlanType;
    const baseLimits = PLAN_LIMITS[currentPlanType] || PLAN_LIMITS[PlanType.FREE];
    const dynamicPlan = appData.plans.find(p => p.type.toUpperCase() === currentPlanType);
    
    const planLimits = dynamicPlan ? {
      ...baseLimits,
      ...dynamicPlan.limits,
      features: {
        ...baseLimits.features,
        ...(dynamicPlan.limits?.features || {})
      }
    } : baseLimits;
    
    if (!planLimits.features.shiftMonitoring) return;
    if (!appData.currentOrg?.telegramSettings?.enabled || !appData.currentOrg.telegramSettings.botToken) return;

    const checkShifts = () => {
      const now = getNow();
      const botToken = appData.currentOrg!.telegramSettings!.botToken;
      
      Object.entries(appData.activeShiftsMap).forEach(([userId, shifts]) => {
        // Prevent other employees' stale devices from sending notifications for this user
        if (userId !== auth.currentUser?.id && !isEmployerAuthorized) return;

        const user = appData.users.find((u: User) => u.id === userId);
        if (!user) return;

        const positionConfig = appData.positions.find((p: PositionConfig) => p.name === user.position);
        
        // Only monitor if maxShiftDurationMinutes is explicitly set and > 0
        const maxDuration = positionConfig?.permissions.maxShiftDurationMinutes;
        if (!maxDuration || maxDuration <= 0) return;

        const alertThreshold = maxDuration + 15;

        const shiftsRecord = shifts as Record<string, any>;
        if (!shiftsRecord) return;

        Object.entries(shiftsRecord).forEach(([slot, shift]: [string, any]) => {
          if (!shift || !shift.checkIn || shift.checkOut) return;

          // Double-check if the shift is already closed in the logs
          const log = appData.logs.find((l: any) => l.id === shift.id);
          if (log && log.checkOut) return;

          const duration = calculateMinutes(shift.checkIn, now.toISOString());
          
          if (duration > alertThreshold && appData.currentOrg?.telegramSettings?.notifyOnLimitExceeded !== false) {
            const notificationKey = `tg_alert_${shift.id}`;
            const lastSent = localStorage.getItem(notificationKey);
            
            // Send alert if never sent or sent more than 5 mins ago
            if (!lastSent || (Date.now() - parseInt(lastSent)) > 5 * 60 * 1000) {
              
              // 1. Notify Employee
              if (user.telegramChatId && (user.telegramSettings?.notifyOnLimitExceeded ?? true)) {
                 const msg = `⚠️ <b>Внимание!</b>\nВы забыли закрыть смену!\n⏱ Длительность: ${Math.floor(duration / 60)}ч ${duration % 60}м\nПожалуйста, закройте смену в приложении.`;
                 sendTelegramNotification(botToken, user.telegramChatId, msg);
              }

              // 2. Notify Admin (Organization Chat)
              if (appData.currentOrg?.telegramSettings?.chatId) {
                 const msg = `⚠️ <b>Просроченная смена</b>\n👤 Сотрудник: ${user.name}\n⏱ Длительность: ${Math.floor(duration / 60)}ч ${duration % 60}м\nЛимит: ${Math.floor(maxDuration / 60)}ч`;
                 sendTelegramNotification(botToken, appData.currentOrg.telegramSettings.chatId, msg);
              }

              localStorage.setItem(notificationKey, Date.now().toString());
            }
          }
        });
      });
    };

    const interval = setInterval(checkShifts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [appData.activeShiftsMap, appData.currentOrg, appData.users, appData.positions, appData.logs, getNow, auth.currentUser?.id, isEmployerAuthorized]);

  useEffect(() => {
    const lastUserId = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    if (lastUserId && !auth.currentUser && appData.users.length > 0) {
       const lastUser = appData.users.find(u => u.id === lastUserId);
       if (lastUser) {
         auth.setSelectedLoginUser(lastUser);
         auth.setShowLanding(false);
       }
    }
  }, [appData.users, auth.currentUser]);

  // Lazy Cleanup for Zombie Shifts (Server-side emulation)
  useEffect(() => {
    if (!appData.currentOrg) return;

    const cleanupZombieShifts = () => {
      const now = getNow();
      const updates: WorkLog[] = [];
      const shiftUpdates: Record<string, any> = {};

      Object.entries(appData.activeShiftsMap).forEach(([userId, shifts]) => {
        // Only process if it's the current user, OR if the current user is an employer
        if (userId !== auth.currentUser?.id && !isEmployerAuthorized) return;

        const user = appData.users.find(u => u.id === userId);
        if (!user) return;
        
        const pos = appData.positions.find((p: PositionConfig) => p.name === user.position);
        const maxDuration = pos?.permissions.maxShiftDurationMinutes || appData.currentOrg!.maxShiftDuration || 720;
        
        // Threshold: Max + 120 mins (give client more time to handle it first)
        const threshold = maxDuration + 120;

        const userShifts = shifts as Record<string, any>;
        if (!userShifts) return;

        let userChanged = false;
        const nextUserShifts = { ...userShifts };

        Object.entries(userShifts).forEach(([slot, shift]) => {
          if (!shift || !shift.checkIn) return;

          const duration = calculateMinutes(shift.checkIn, now.toISOString());
          
          if (duration > threshold) {
            // Force close
            const endTime = new Date(new Date(shift.checkIn).getTime() + maxDuration * 60000).toISOString();
            
            let finalDuration = maxDuration;
            if (shift.isNightShift && appData.nightShiftBonus > 0) {
               finalDuration += Math.floor(maxDuration * (appData.nightShiftBonus / 100));
            }

            const completed: WorkLog = {
              ...shift,
              checkOut: endTime,
              durationMinutes: finalDuration,
              isCorrected: true,
              correctionNote: 'Автоматическое завершение (превышен лимит)'
            };
            
            updates.push(completed);
            nextUserShifts[slot] = null;
            userChanged = true;

            // Telegram Notification
            if (appData.currentOrg?.telegramSettings?.enabled && appData.currentOrg.telegramSettings.botToken && appData.currentOrg.telegramSettings.chatId && appData.currentOrg.telegramSettings.notifyOnLimitExceeded !== false) {
              const machineName = shift.machineId ? appData.machines.find((m: any) => m.id === shift.machineId)?.name || 'Работа' : 'Работа';
              const msg = `⛔️ <b>Авто-закрытие (Lazy)</b>\n👤 Сотрудник: ${user.name}\n📍 Позиция: ${user.position}\n🔧 Слот: ${slot} (${machineName})\n⚠️ Причина: Превышен лимит времени (серверная очистка)`;
              
              sendTelegramNotification(appData.currentOrg.telegramSettings.botToken, appData.currentOrg.telegramSettings.chatId, msg);
              if (user.telegramChatId && (user.telegramSettings?.notifyOnLimitExceeded ?? true)) {
                 sendTelegramNotification(appData.currentOrg.telegramSettings.botToken, user.telegramChatId, msg);
              }
            }
          }
        });

        if (userChanged) {
          shiftUpdates[userId] = nextUserShifts;
        }
      });

      if (updates.length > 0) {
        appData.handleLogsUpsert(updates);
        Object.entries(shiftUpdates).forEach(([uid, s]) => {
          appData.handleActiveShiftsUpdate(uid, s);
        });
        console.log(`Lazy Cleanup: Closed ${updates.length} zombie shifts.`);
      }
    };

    const interval = setInterval(cleanupZombieShifts, 5 * 60 * 1000); // Check every 5 mins
    cleanupZombieShifts(); // Initial check
    return () => clearInterval(interval);

  }, [isEmployerAuthorized, auth.currentUser?.id, appData.currentOrg, appData.activeShiftsMap, appData.users, appData.positions, getNow]);

  const activeUser = useMemo(() => {
    if (!auth.currentUser) return null;
    const dbUser = appData.users.find(u => u.id === auth.currentUser!.id);
    if (!dbUser) return auth.currentUser;
    // Merge database data with current session role (important for admin role switching)
    return { ...dbUser, role: auth.currentUser.role };
  }, [auth.currentUser, appData.users]);

  if (!appData.isInitialized) {
    return <LoadingScreen />;
  }

  if (isSuperAdmin) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <SuperAdminView 
          onLogout={auth.handleLogout} 
          unreadSupportMessages={totalUnread}
          unreadByOrg={unreadByOrg}
          onTabChange={setSuperAdminTab}
          onResetUnread={handleResetUnread}
        />
      </Suspense>
    );
  }

  if (showRegistration) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <RegistrationForm 
          onBack={() => setShowRegistration(false)} 
          onSuccess={(orgId) => {
            Object.values(STORAGE_KEYS).forEach(key => {
              localStorage.removeItem(key);
            });
            localStorage.setItem(STORAGE_KEYS.ORG_ID, orgId);
            setShowRegistration(false);
            auth.setShowLanding(false);
            window.location.reload();
          }} 
        />
      </Suspense>
    );
  }

  if (auth.showLanding && !auth.currentUser) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <LandingPage 
          onStart={() => auth.setShowLanding(false)} 
          onRegister={() => setShowRegistration(true)}
          plans={appData.plans}
        />
      </Suspense>
    );
  }

  if (window.location.pathname.includes('/payment-success')) {
    return <PaymentSuccess />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Layout 
        user={auth.currentUser} 
        currentOrg={appData.currentOrg} 
        onLogout={auth.handleLogout} 
        onSwitchRole={auth.handleSwitchRole} 
        onRefresh={appData.handleRefresh}
        version={APP_VERSION}
        isSyncing={appData.isSyncing}
        employerViewMode={employerViewMode}
        setEmployerViewMode={setEmployerViewMode}
        employeeViewMode={employeeViewMode}
        setEmployeeViewMode={setEmployeeViewMode}
        canUsePayroll={appData.currentOrg ? (() => {
          const rawPlan = appData.currentOrg.plan;
          const currentPlanType = String(rawPlan).toUpperCase() as PlanType;
          const baseLimits = PLAN_LIMITS[currentPlanType] || PLAN_LIMITS[PlanType.FREE];
          const dynamicPlan = appData.plans.find(p => p.type.toUpperCase() === currentPlanType);
          return dynamicPlan?.limits?.features?.payroll ?? baseLimits.features.payroll;
        })() : false}
        unreadSupportMessages={totalUnread}
      >
        {appData.dbError && (
          <div className="bg-rose-600 text-white px-4 py-2 text-center text-xs font-bold animate-pulse sticky top-16 z-[60] shadow-lg">
            ⚠️ {appData.dbError}
          </div>
        )}
        {appData.syncError && (
          <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold sticky top-16 z-[60] shadow-lg">
            ⚠️ {appData.syncError} Данные сохранены локально и будут отправлены позже.
          </div>
        )}

        {!auth.currentUser ? (
          <LoginScreen 
             users={appData.users.filter(u => !u.isArchived)}
             selectedLoginUser={auth.selectedLoginUser}
             setSelectedLoginUser={auth.setSelectedLoginUser}
             pinInput={auth.pinInput}
             setPinInput={auth.setPinInput}
             loginError={auth.loginError}
             setLoginError={auth.setLoginError}
             validateAndLogin={(pin, user) => auth.validateAndLogin(pin, appData.users, appData.superAdminPin, appData.globalAdminPin, user)}
             setShowLanding={auth.setShowLanding}
             setShowResetModal={setShowResetModal}
             currentOrg={appData.currentOrg}
             appVersion={APP_VERSION}
             globalAdminPin={appData.globalAdminPin}
             setCurrentUser={auth.setCurrentUser}
             isSelectedUserAdmin={isSelectedUserAdmin}
          />
        ) : (
          auth.currentUser.role === UserRole.EMPLOYEE ? (
            <EmployeeView 
              user={activeUser!} 
              logs={appData.logs} 
              logsLookup={appData.logsLookup}
              onLogsUpsert={appData.handleLogsUpsert} 
              activeShifts={appData.activeShiftsMap[auth.currentUser.id] || { 1: null, 2: null, 3: null }}
              onActiveShiftsUpdate={(shifts: any) => appData.handleActiveShiftsUpdate(auth.currentUser!.id, shifts)}
              onOvertime={(user: any, slot: any) => {
                if (appData.currentOrg?.notificationSettings?.onOvertime) {
                  sendNotification('Превышение лимита', `Сотрудник ${user.name} превысил лимит времени смены.`);
                }
              }}
              machines={appData.machines} 
              positions={appData.positions} 
              onUpdateUser={appData.handleUpdateUser}
              nightShiftBonusMinutes={appData.nightShiftBonus}
              onRefresh={appData.handleRefresh}
              planLimits={PLAN_LIMITS[appData.currentOrg?.plan || PlanType.FREE]}
              currentOrg={appData.currentOrg}
              onMonthChange={appData.loadLogsForMonth}
              getNow={getNow}
              viewMode={employeeViewMode}
              setViewMode={setEmployeeViewMode}
            />
          ) : (
            isEmployerAuthorized ? (
              <EmployerView 
                logs={appData.logs} 
                logsLookup={appData.logsLookup}
                users={appData.users} 
                onAddUser={appData.handleAddUser} 
                onUpdateUser={appData.handleUpdateUser}
                onDeleteUser={appData.handleDeleteUser} 
                machines={appData.machines}
                onUpdateMachines={appData.persistMachines}
                positions={appData.positions}
                onUpdatePositions={appData.persistPositions}
                branches={appData.branches}
                onUpdateBranches={appData.persistBranches}
                onDeleteBranch={appData.handleDeleteBranch}
                onImportData={appData.handleImportData}
                onLogsUpsert={appData.handleLogsUpsert}
                activeShiftsMap={appData.activeShiftsMap}
                onActiveShiftsUpdate={appData.handleActiveShiftsUpdate}
                onDeleteLog={appData.handleDeleteLog}
                onRefresh={appData.handleRefresh}
                forceCleanAll={appData.forceCleanAll}
                onCleanupDatabase={appData.handleCleanupDatabase}
                onRemoveBase64Photos={appData.handleRemoveBase64Photos}
                onRunDiagnostics={appData.handleRunDiagnostics}
                onMergeDuplicates={appData.handleMergeDuplicates}
                onFixDbStructure={appData.handleFixDbStructure}
                isSyncing={appData.isSyncing}
                nightShiftBonusMinutes={appData.nightShiftBonus}
                onUpdateNightBonus={appData.setNightShiftBonus}
                currentOrg={appData.currentOrg}
                plans={appData.plans}
                onUpdateOrg={appData.setCurrentOrg}
                currentUser={activeUser!} 
                onMonthChange={appData.loadLogsForMonth}
                payments={appData.payments}
                onSavePayment={appData.handleSavePayment}
                onDeletePayment={appData.handleDeletePayment}
                getArchivedUsers={appData.getArchivedUsers}
                getArchivedMachines={appData.getArchivedMachines}
                getNow={getNow}
                viewMode={employerViewMode}
                setViewMode={setEmployerViewMode}
                unreadSupportMessages={totalUnread}
                onResetUnread={handleResetUnread}
              />
            ) : (
              <div className="text-center py-20">
                <h2 className="text-2xl font-black text-slate-900 uppercase">Доступ ограничен</h2>
                <p className="text-slate-500 mt-2 font-medium">У вас нет прав для просмотра этого раздела.</p>
                <button onClick={() => auth.handleSwitchRole(UserRole.EMPLOYEE)} className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs">Вернуться в Мой Табель</button>
              </div>
            )
          )
        )}
        
        {showResetModal && (
          <ResetPinModal 
            currentOrg={appData.currentOrg}
            onClose={() => setShowResetModal(false)}
            onSuccess={() => {
               setShowResetModal(false);
               appData.initData(true);
            }}
          />
        )}
        
        {appData.upgradeReason && !appData.showUpgradeModal && (
          <NotificationModal 
            message={appData.upgradeReason}
            onClose={() => appData.setUpgradeReason(null)}
          />
        )}
        
        {appData.showUpgradeModal && (
          <UpgradeModal 
            reason={appData.upgradeReason}
            onClose={() => { appData.setUpgradeReason(null); appData.setShowUpgradeModal(false); }}
            onUpgrade={() => { window.location.href = '#pricing'; appData.setUpgradeReason(null); appData.setShowUpgradeModal(false); }}
          />
        )}

      </Layout>
    </Suspense>
  );
};

export default App;
