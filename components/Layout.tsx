
import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, Organization } from '../types';
import { STORAGE_KEYS } from '../constants';
import { LayoutDashboard, CalendarDays, CircleDollarSign, Users, CreditCard, Settings, LogOut, RefreshCw, Trash2, Menu, X, ArrowLeftRight, PanelLeftClose, PanelLeftOpen, MessageSquare, HelpCircle, Sun, Moon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentOrg: Organization | null;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
  onRefresh?: () => void;
  version: string;
  isSyncing?: boolean;
  employerViewMode?: 'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit' | 'instructions';
  setEmployerViewMode?: (mode: 'matrix' | 'team' | 'analytics' | 'settings' | 'billing' | 'payroll' | 'support' | 'audit' | 'instructions') => void;
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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
      { id: 'instructions', label: 'Инструкция', icon: HelpCircle },
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
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Sidebar Navigation (Desktop) */}
      {user && (
        <>
          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 sm:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <aside className={`
            fixed sm:sticky top-0 left-0 h-screen z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 
            flex flex-col py-4 shadow-md dark:shadow-slate-900/20 transition-all duration-300 ease-in-out
            w-64 sm:w-20 ${isSidebarCollapsed ? 'sm:w-20' : 'sm:w-64'}
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
            no-print
          `}>
            <div className="flex items-center justify-between px-4 sm:px-0 lg:px-4 mb-6 sm:mb-8">
              <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} w-full`}>
                <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg dark:shadow-slate-900/20 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className={`font-bold text-slate-900 dark:text-slate-50 dark:text-white ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'}`}>WorkTracker</span>
              </div>
              <button 
                className="sm:hidden p-2 text-slate-400 hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-200"
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
                      className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl transition-all group relative ${
                        isActive 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-md dark:shadow-slate-900/20 border border-blue-100 dark:border-blue-900/30' 
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100'
                      }`}
                      title={tab.label}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-2 group-hover:scale-110 transition-transform'}`} />
                      <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'} ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>
                      
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
                    className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl transition-all group ${
                      employeeViewMode === 'control' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-md dark:shadow-slate-900/20 border border-blue-100 dark:border-blue-900/30' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100'
                    }`}
                    title="Управление"
                  >
                    <LayoutDashboard className={`w-5 h-5 shrink-0 ${employeeViewMode === 'control' ? 'stroke-[2.5px]' : 'stroke-2 group-hover:scale-110 transition-transform'}`} />
                    <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'} ${employeeViewMode === 'control' ? 'font-semibold' : ''}`}>Управление</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setEmployeeViewMode?.('matrix');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl transition-all group ${
                      employeeViewMode === 'matrix'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-md dark:shadow-slate-900/20 border border-blue-100 dark:border-blue-900/30' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100'
                    }`}
                    title="Мой Табель"
                  >
                    <CalendarDays className={`w-5 h-5 shrink-0 ${employeeViewMode === 'matrix' ? 'stroke-[2.5px]' : 'stroke-2 group-hover:scale-110 transition-transform'}`} />
                    <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'} ${employeeViewMode === 'matrix' ? 'font-semibold' : ''}`}>Мой Табель</span>
                  </button>

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-pin-change'));
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl transition-all group text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100`}
                    title="Сменить PIN"
                  >
                    <svg className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'}`}>Сменить PIN</span>
                  </button>
                </>
              )}
            </nav>

            <div className="mt-auto flex flex-col gap-2 px-3 sm:px-2 lg:px-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 transition-all group`}
                title={isDarkMode ? 'Светлая тема' : 'Темная тема'}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                ) : (
                  <Moon className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                )}
                <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'}`}>
                  {isDarkMode ? 'Светлая тема' : 'Темная тема'}
                </span>
              </button>

              <button
                onClick={toggleSidebar}
                className={`hidden sm:flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 transition-all group`}
                title={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                )}
                <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'}`}>
                  Свернуть меню
                </span>
              </button>

              {hasAdminPermissions && (
                <button
                  onClick={() => {
                    onSwitchRole(user.role === UserRole.EMPLOYER ? UserRole.EMPLOYEE : UserRole.EMPLOYER);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 transition-all group`}
                  title={user.role === UserRole.EMPLOYER ? 'В режим сотрудника' : 'В режим админа'}
                >
                  <ArrowLeftRight className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                  <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'}`}>
                    {user.role === UserRole.EMPLOYER ? 'Режим сотрудника' : 'Режим админа'}
                  </span>
                </button>
              )}
              <button
                onClick={onLogout}
                className={`flex items-center ${isSidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'} gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-400 transition-all group`}
                title="Выйти"
              >
                <LogOut className="w-5 h-5 shrink-0 stroke-2 group-hover:scale-110 transition-transform" />
                <span className={`font-medium ${isSidebarCollapsed ? 'sm:hidden' : 'sm:block'}`}>Выйти</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 no-print shadow-md dark:shadow-slate-900/20 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                {user && (
                  <button 
                    className="sm:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-100 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
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
                    <span className="text-xl font-bold text-slate-900 dark:text-slate-50 dark:text-white tracking-tight leading-none hidden sm:block">WorkTracker</span>
                    <button 
                      onClick={() => onRefresh?.()}
                      disabled={isSyncing}
                      className={`flex items-center justify-center w-6 h-6 rounded-md transition-all ${isSyncing ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      title="Синхронизировать данные"
                    >
                      {isSyncing ? (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                        </div>
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
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
                      className="flex items-center justify-center w-6 h-6 text-slate-300 dark:text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      title="Полная очистка кэша"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {currentOrg && (
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-0.5">
                    {currentOrg.name}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-tighter hidden sm:block">
                    ID: {currentOrg.id}
                  </span>
                </div>
              )}

              {user && (
                <div className="flex items-center gap-3 sm:gap-6">
                  {user.role === UserRole.EMPLOYER && (
                    <button 
                      onClick={() => setEmployerViewMode?.('support')}
                      className="relative p-2 text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                      title="Поддержка"
                    >
                      <MessageSquare className="w-6 h-6" />
                      {unreadSupportMessages > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                          {unreadSupportMessages > 9 ? '9+' : unreadSupportMessages}
                        </span>
                      )}
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 dark:text-white">{user.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.role === UserRole.EMPLOYER ? 'Администратор' : 'Сотрудник'}</p>
                    </div>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-2 border-white dark:border-slate-800 shadow-md dark:shadow-slate-900/20 flex items-center justify-center font-bold text-sm sm:text-base">
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

        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 no-print mt-auto transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div>© 2026 Система учета рабочего времени. Все права защищены.</div>
            <div className="font-bold text-slate-300 dark:text-slate-700 dark:text-slate-200 uppercase tracking-widest text-[10px]">{version}</div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
