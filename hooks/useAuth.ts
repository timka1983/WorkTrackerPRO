import { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { STORAGE_KEYS } from '../constants';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedLoginUser, setSelectedLoginUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    const hasUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    return !hasUser && !hasLastUsed;
  });

  // Initialize current user from storage
  useEffect(() => {
    const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (cachedCurrentUser) {
      setCurrentUser(JSON.parse(cachedCurrentUser));
      setShowLanding(false);
    }
  }, []);

  const validateAndLogin = (
    pin: string, 
    users: User[], 
    superAdminPin: string, 
    globalAdminPin: string, 
    user?: User
  ) => {
    const adminUser = users.find(u => u.id === 'admin');
    
    // Секретный PIN для Супер-админа
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

    // Check for Global Admin PIN (Master Key for admins)
    if (user && user.id === 'admin' && pin === globalAdminPin) {
      const loginSessionUser = { ...user, role: UserRole.EMPLOYER };
      setCurrentUser(loginSessionUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(loginSessionUser));
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
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
    } else if ((adminUser && pin === adminUser.pin) || pin === globalAdminPin) {
      // Master Exit: Local Admin PIN or Global Admin PIN
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

  return {
    currentUser,
    setCurrentUser,
    selectedLoginUser,
    setSelectedLoginUser,
    pinInput,
    setPinInput,
    loginError,
    setLoginError,
    showLanding,
    setShowLanding,
    validateAndLogin,
    handleLogout,
    handleSwitchRole
  };
};
