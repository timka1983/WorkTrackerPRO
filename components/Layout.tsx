
import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, Organization } from '../types';
import { STORAGE_KEYS } from '../constants';
import { LayoutDashboard, CalendarDays, CircleDollarSign, Users, CreditCard, Settings, LogOut, RefreshCw, Trash2, Menu, X, ArrowLeftRight, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentOrg: Organization | null;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
  onRefresh?: () => void;
  version: string;
  isSyncing?: boolean;
  employerViewMode?: 'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit';
  setEmployerViewMode?: (mode: 'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit') => void;
  employeeViewMode?: 'control' | 'matrix';
  setEmployeeViewMode?: (mode: 'control' | 'matrix') => void;
  canUsePayroll?: boolean;
  unreadSupportMessages?: number;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, user, currentOrg, onLogout, onSwitchRole, onRefresh, version, isSyncing = false,
  employerViewMode, setEmployerViewMode, employeeViewMode, setEmployeeViewMode, canUsePayroll = false,
  unreadSupportMessages = 0
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Check if current position has admin permissions
  const { hasAdminPermissions, userPerms } = useMemo(() => {
    if (!user) return { hasAdminPermissions: false, userPerms: null };
    if (user.id === 'admin' || user.isAdmin) return { hasAdminPermissions: true, userPerms: { isFullAdmin: true } };
    
    // Position permissions check
    const cachedPositions = localStorage.getItem('timesheet_positions_list');
    if (cachedPositions) {
      try {
        const positions = JSON.parse(cachedPositions);
        const pos = positions.find((p: any) => p.name === user.position);
        const perms = pos?.permissions;
        return {
          hasAdminPermissions: perms?.isFullAdmin || perms?.isLimitedAdmin,
          userPerms: perms
        };
      } catch (e) {
        return { hasAdminPermissions: false, userPerms: null };
      }
    }
    return { hasAdminPermissions: false, userPerms: null };
  }, [user]);

  const employerTabs = useMemo(() => {
    let tabs = [
      { id: 'analytics', label: 'Дашборд', icon: LayoutDashboard },
      { id: 'matrix', label: 'Табель', icon: CalendarDays },
      { id: 'payroll', label: 'Зарплата', icon: CircleDollarSign, hidden: !canUsePayroll },
      { id: 'team', label: 'Команда', icon: Users },
      { id: 'billing', label: 'Биллинг', icon: CreditCard },
      { id: 'settings', label: 'Настройки', icon: Settings },
      { id: 'support', label: 'Поддержка', icon: MessageSquare },
      { id: 'audit', label: 'Журнал аудита', icon: LayoutDashboard }
    ].filter(t => !t.hidden);

    if (!userPerms) return [];
    if (userPerms.isFullAdmin) return tabs;
    
    if (userPerms.isLimitedAdmin) {
      return tabs.filter(t => ['analytics', 'matrix'].includes(t.id));
    }

    if (!userPerms.canViewPayroll) {
      tabs = tabs.filter(t => t.id !== 'payroll');
    }
    if (!userPerms.canManageUsers) {
      tabs = tabs.filter(t => t.id !== 'team');
    }
    if (!userPerms.canManageSettings) {
      tabs = tabs.filter(t => t.id !== 'settings' && t.id !== 'billing');
    }

    return tabs;
  }, [canUsePayroll, userPerms]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar Navigation (Desktop) */}
      {user && (
        <>
          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/20 z-40 sm:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <aside className={`
            fixed sm:sticky top-0 left-0 h-screen z-50 bg-white border-r border-slate-200 
            flex flex-col py-4 shadow-sm transition-all duration-300 ease-in-out
            w-64 sm:w-20 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
            no-print
          `}>
            <div className="flex items-center justify-between px-4 sm:px-0 lg:px-4 mb-6 sm:mb-8">
              <div className={`flex items-center gap-3 sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} w-full`}>
                <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className={`font-bold text-slate-900 sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}>WorkTracker</span>
              </div>
              <button 
                className="sm:hidden p-2 text-slate-400 hover:text-slate-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-2 px-3 sm:px-2 lg:px-3 overflow-y-auto custom-scrollbar">
              {user.role === UserRole.EMPLOYER && setEmployerViewMode ? (
                employerTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = employerViewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setEmployerViewMode(tab.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl transition-all group relative ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100' 
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                      title={tab.label}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-2 group-hover:scale-110 transition-transform'}`} />
                      <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'} ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>
                      
                      {tab.id === 'support' && unreadSupportMessages > 0 && (
                        <span className="absolute top-2 right-2 sm:top-1 sm:right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                          {unreadSupportMessages > 9 ? '9+' : unreadSupportMessages}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEmployeeViewMode?.('control');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl transition-all group ${
                      employeeViewMode === 'control' 
                        ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    title="Управление"
                  >
                    <LayoutDashboard className={`w-5 h-5 shrink-0 ${employeeViewMode === 'control' ? 'stroke-[2.5px]' : 'stroke-2 group-hover:scale-110 transition-transform'}`} />
                    <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'} ${employeeViewMode === 'control' ? 'font-semibold' : ''}`}>Управление</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setEmployeeViewMode?.('matrix');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl transition-all group ${
                      employeeViewMode === 'matrix'
                        ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    title="Мой Табель"
                  >
                    <CalendarDays className={`w-5 h-5 shrink-0 ${employeeViewMode === 'matrix' ? 'stroke-[2.5px]' : 'stroke-2 group-hover:scale-110 transition-transform'}`} />
                    <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'} ${employeeViewMode === 'matrix' ? 'font-semibold' : ''}`}>Мой Табель</span>
                  </button>

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-pin-change'));
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl transition-all group text-slate-500 hover:bg-slate-50 hover:text-slate-900`}
                    title="Сменить PIN"
                  >
                    <svg className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}>Сменить PIN</span>
                  </button>
                </>
              )}
            </nav>

            <div className="mt-auto flex flex-col gap-2 px-3 sm:px-2 lg:px-3 pt-4 border-t border-slate-100">
              <button
                onClick={toggleSidebar}
                className={`hidden lg:flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all group`}
                title={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                )}
                <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}>
                  Свернуть меню
                </span>
              </button>

              {hasAdminPermissions && (
                <button
                  onClick={() => {
                    onSwitchRole(user.role === UserRole.EMPLOYER ? UserRole.EMPLOYEE : UserRole.EMPLOYER);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all group`}
                  title={user.role === UserRole.EMPLOYER ? 'В режим сотрудника' : 'В режим админа'}
                >
                  <ArrowLeftRight className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                  <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}>
                    {user.role === UserRole.EMPLOYER ? 'Режим сотрудника' : 'Режим админа'}
                  </span>
                </button>
              )}
              <button
                onClick={onLogout}
                className={`flex items-center sm:justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all group`}
                title="Выйти"
              >
                <LogOut className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                <span className={`font-medium sm:hidden ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}>Выйти</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                {user && (
                  <button 
                    className="sm:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                )}
                {!user && (
                  <div className="bg-blue-600 text-white p-2 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-900 tracking-tight leading-none hidden sm:block">WorkTracker</span>
                    <button 
                      onClick={() => onRefresh?.()}
                      disabled={isSyncing}
                      className={`flex items-center justify-center w-6 h-6 rounded-md transition-all ${isSyncing ? 'bg-blue-50' : 'hover:bg-slate-100'}`}
                      title="Синхронизировать данные"
                    >
                      {isSyncing ? (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                        </div>
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Это полностью очистит локальный кэш и перезагрузит приложение. Используйте это, если данные отображаются некорректно. Продолжить?')) {
                          const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID);
                          localStorage.clear();
                          const nextUrl = orgId ? `/?org_switch=${orgId}&reset=${Date.now()}` : `/?reset=${Date.now()}`;
                          window.location.replace(nextUrl);
                        }
                      }}
                      className="flex items-center justify-center w-6 h-6 text-slate-300 hover:text-rose-500 transition-colors rounded-md hover:bg-rose-50"
                      title="Полная очистка кэша"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {currentOrg && (
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm sm:text-base font-bold text-indigo-600 uppercase tracking-wider mt-0.5">
                    {currentOrg.name}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter hidden sm:block">
                    ID: {currentOrg.id}
                  </span>
                </div>
              )}

              {user && (
                <div className="flex items-center gap-3 sm:gap-6">
                  {user.role === UserRole.EMPLOYER && (
                    <button 
                      onClick={() => setEmployerViewMode?.('support')}
                      className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Поддержка"
                    >
                      <MessageSquare className="w-6 h-6" />
                      {unreadSupportMessages > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                          {unreadSupportMessages > 9 ? '9+' : unreadSupportMessages}
                        </span>
                      )}
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.role === UserRole.EMPLOYER ? 'Администратор' : 'Сотрудник'}</p>
                    </div>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-700 border-2 border-white shadow-sm flex items-center justify-center font-bold text-sm sm:text-base">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 w-full mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
          {children}
        </main>

        <footer className="bg-white border-t border-slate-200 py-6 no-print mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <div>© 2026 Система учета рабочего времени. Все права защищены.</div>
            <div className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">{version}</div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
