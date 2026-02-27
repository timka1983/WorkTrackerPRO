import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { UserRole, PlanType, PositionConfig } from './types';
import { STORAGE_KEYS, DEFAULT_PERMISSIONS, PLAN_LIMITS } from './constants';
import { sendNotification } from './utils';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import ResetPinModal from './components/ResetPinModal';
import UpgradeModal from './components/UpgradeModal';
import NotificationModal from './components/NotificationModal';
import { useAppData } from './hooks/useAppData';
import { useAuth } from './hooks/useAuth';

// Lazy load heavy components
const EmployeeView = React.lazy(() => import('./components/EmployeeView'));
const EmployerView = React.lazy(() => import('./components/EmployerView'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const RegistrationForm = React.lazy(() => import('./components/RegistrationForm'));
const SuperAdminView = React.lazy(() => import('./components/SuperAdminView'));
const LoginScreen = React.lazy(() => import('./components/LoginScreen'));

const APP_VERSION = 'v1.9.0-PRO-SAAS';

const App: React.FC = () => {
  const auth = useAuth();
  const appData = useAppData(auth.currentUser);

  const [showRegistration, setShowRegistration] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

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

  const isEmployerAuthorized = useMemo(() => {
    return userPermissions.isFullAdmin || userPermissions.isLimitedAdmin;
  }, [userPermissions]);

  const isSuperAdmin = useMemo(() => {
    return auth.currentUser?.role === UserRole.SUPER_ADMIN;
  }, [auth.currentUser]);

  if (!appData.isInitialized) {
    return <LoadingScreen />;
  }

  if (isSuperAdmin) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <SuperAdminView onLogout={auth.handleLogout} />
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
             users={appData.users}
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
              user={auth.currentUser} 
              logs={appData.logs} 
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
            />
          ) : (
            isEmployerAuthorized ? (
              <EmployerView 
                logs={appData.logs} 
                users={appData.users} 
                onAddUser={appData.handleAddUser} 
                onUpdateUser={appData.handleUpdateUser}
                onDeleteUser={appData.handleDeleteUser} 
                machines={appData.machines}
                onUpdateMachines={appData.persistMachines}
                positions={appData.positions}
                onUpdatePositions={appData.persistPositions}
                onImportData={appData.handleImportData}
                onLogsUpsert={appData.handleLogsUpsert}
                activeShiftsMap={appData.activeShiftsMap}
                onActiveShiftsUpdate={appData.handleActiveShiftsUpdate}
                onDeleteLog={appData.handleDeleteLog}
                onRefresh={appData.handleRefresh}
                isSyncing={appData.isSyncing}
                nightShiftBonusMinutes={appData.nightShiftBonus}
                onUpdateNightBonus={appData.setNightShiftBonus}
                currentOrg={appData.currentOrg}
                plans={appData.plans}
                onUpdateOrg={appData.setCurrentOrg}
                currentUser={auth.currentUser}
                onMonthChange={appData.loadLogsForMonth}
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
