
import React, { useMemo } from 'react';
import { User, UserRole } from '../types';
import { STORAGE_KEYS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
  version: string;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onSwitchRole, version }) => {
  // Check if current position has admin permissions
  const hasAdminPermissions = useMemo(() => {
    if (!user) return false;
    if (user.id === 'admin' || user.isAdmin) return true;
    
    // Position permissions check
    const cachedPositions = localStorage.getItem('timesheet_positions_list');
    if (cachedPositions) {
      try {
        const positions = JSON.parse(cachedPositions);
        const pos = positions.find((p: any) => p.name === user.position);
        return pos?.permissions?.isFullAdmin || pos?.permissions?.isLimitedAdmin;
      } catch (e) {
        return false;
      }
    }
    return false;
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">WorkTracker</span>
            </div>

            {user && (
              <div className="flex items-center gap-3 sm:gap-6">
                {hasAdminPermissions && (
                  <div className="hidden md:flex items-center gap-4 text-sm font-medium">
                     <button 
                      onClick={() => onSwitchRole(UserRole.EMPLOYEE)}
                      className={`px-3 py-1 rounded-full transition-colors ${user.role === UserRole.EMPLOYEE ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      Сотрудник
                    </button>
                    <button 
                      onClick={() => onSwitchRole(UserRole.EMPLOYER)}
                      className={`px-3 py-1 rounded-full transition-colors ${user.role === UserRole.EMPLOYER ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      Работодатель
                    </button>
                  </div>
                )}

                {hasAdminPermissions && (
                  <button 
                    onClick={() => onSwitchRole(user.role === UserRole.EMPLOYER ? UserRole.EMPLOYEE : UserRole.EMPLOYER)}
                    className="md:hidden flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-tighter active:scale-95 transition-transform border border-blue-100 shadow-sm"
                  >
                    {user.role === UserRole.EMPLOYER ? 'В Табель' : 'В Админ'}
                  </button>
                )}
                
                <div className="flex items-center gap-3 border-l pl-3 sm:pl-6 border-slate-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.role === UserRole.EMPLOYER ? 'Администратор' : 'Сотрудник'}</p>
                  </div>
                  <button 
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Выйти"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div>© 2024 Система учета рабочего времени. Все права защищены.</div>
          <div className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">{version}</div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
