
import React, { useState, useEffect } from 'react';
import { Organization, PlanType, Plan, PromoCode, User, UserRole } from '../types';
import { db } from '../lib/supabase';
import { STORAGE_KEYS } from '../constants';
import { Users, Building2, CreditCard, Activity, ShieldCheck, Search, RefreshCw, ExternalLink, Settings2, X, Check, Plus, LayoutGrid, Zap, Briefcase, Save, Camera, Moon, BarChart3, Megaphone, Ticket, Trash2 } from 'lucide-react';

interface SuperAdminViewProps {
  onLogout: () => void;
}

const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onLogout }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'orgs' | 'plans' | 'marketing' | 'diagnostics'>('orgs');
  const [viewingUsersOrg, setViewingUsersOrg] = useState<{ id: string; name: string } | null>(null);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [newOrg, setNewOrg] = useState<Partial<Organization>>({
    plan: PlanType.FREE,
    status: 'active'
  });
  const [newPromo, setNewPromo] = useState<Partial<PromoCode>>({
    planType: PlanType.PRO,
    durationDays: 14,
    maxUses: 1,
    isActive: true
  });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState<Organization | null>(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resetPinConfirm, setResetPinConfirm] = useState<{ orgId: string; pin: string } | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [checkingDiagnostics, setCheckingDiagnostics] = useState(false);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [newSuperAdminPin, setNewSuperAdminPin] = useState('');

  const runDiagnostics = async () => {
    setCheckingDiagnostics(true);
    try {
      const results = await db.getDiagnostics();
      setDiagnostics(results);
    } catch (e) {
      console.error('Diagnostics failed:', e);
    } finally {
      setCheckingDiagnostics(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'diagnostics') {
      runDiagnostics();
    }
  }, [activeTab]);

  const handleSwitchToOrg = (orgId: string) => {
    try {
      // Сохраняем ID новой организации
      localStorage.setItem(STORAGE_KEYS.ORG_ID, orgId);
      
      // Очищаем ВЕСЬ кэш, чтобы гарантировать загрузку данных новой организации
      Object.values(STORAGE_KEYS).forEach(key => {
        if (key !== STORAGE_KEYS.ORG_ID) {
          localStorage.removeItem(key);
        }
      });
      
      // Дополнительная очистка для мобильных браузеров
      localStorage.removeItem('timesheet_org_data');
      localStorage.removeItem('timesheet_users_list');
      localStorage.removeItem('timesheet_work_logs');
      
      // Перезагружаем с параметром для сброса кэша браузера и предотвращения возврата назад
      const cleanUrl = window.location.origin + '/?org_switch=' + orgId + '&t=' + Date.now();
      window.location.replace(cleanUrl);
    } catch (e) {
      alert('Ошибка при переключении: ' + e);
    }
  };

  const handleHardReset = () => {
    if (!confirm('Это полностью очистит локальный кэш и перезагрузит приложение. Продолжить?')) return;
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID);
    localStorage.clear();
    const nextUrl = orgId ? `/?org_switch=${orgId}&reset=${Date.now()}` : `/?reset=${Date.now()}`;
    window.location.replace(nextUrl);
  };

  const handleUpdateSystemConfig = async () => {
    if (newSuperAdminPin.length !== 4) {
      alert('PIN должен состоять из 4 цифр');
      return;
    }
    setSaving(true);
    try {
      await db.updateSystemConfig({ super_admin_pin: newSuperAdminPin });
      setSystemConfig({ ...systemConfig, super_admin_pin: newSuperAdminPin });
      alert('Настройки системы обновлены');
    } catch (e) {
      alert('Ошибка при обновлении настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleViewUsers = async (org: Organization) => {
    setViewingUsersOrg({ id: org.id, name: org.name });
    setLoadingUsers(true);
    try {
      const users = await db.getUsers(org.id);
      setOrgUsers(users || []);
    } catch (e) {
      console.error('Error fetching org users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgs, globalStats, dbPlans, dbPromoCodes, dbConfig] = await Promise.all([
        db.getAllOrganizations(),
        db.getGlobalStats(),
        db.getPlans(),
        db.getPromoCodes(),
        db.getSystemConfig()
      ]);
      if (orgs) setOrganizations(orgs);
      if (globalStats) setStats(globalStats);
      
      if (dbPromoCodes && dbPromoCodes.length > 0) {
        setPromoCodes(dbPromoCodes);
        localStorage.setItem(STORAGE_KEYS.PROMO_CODES, JSON.stringify(dbPromoCodes));
      } else {
        const cachedPromos = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
        if (cachedPromos) setPromoCodes(JSON.parse(cachedPromos));
      }

      if (dbConfig) {
        setSystemConfig(dbConfig);
        setNewSuperAdminPin(dbConfig.super_admin_pin || '7777');
      }

      if (dbPlans && dbPlans.length > 0) {
        setPlans(dbPlans);
      } else {
        // Fallback to default plans if none in DB
        const defaultPlans: Plan[] = [
          {
            type: PlanType.FREE,
            name: 'Бесплатный',
            price: 0,
            limits: { maxUsers: 3, maxMachines: 2, features: { photoCapture: false, nightShift: false, advancedAnalytics: false } }
          },
          {
            type: PlanType.PRO,
            name: 'Профессиональный',
            price: 2900,
            limits: { maxUsers: 20, maxMachines: 10, features: { photoCapture: true, nightShift: true, advancedAnalytics: true } }
          },
          {
            type: PlanType.BUSINESS,
            name: 'Бизнес',
            price: 9900,
            limits: { maxUsers: 1000, maxMachines: 1000, features: { photoCapture: true, nightShift: true, advancedAnalytics: true } }
          }
        ];
        setPlans(defaultPlans);
      }
    } catch (error) {
      console.error('Error fetching super admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  useEffect(() => {
    const fetchAdmin = async () => {
      if (editingOrg) {
        setLoadingUsers(true);
        const users = await db.getUsers(editingOrg.id);
        const admin = users?.find(u => u.id === 'admin');
        setEditingAdmin(admin || null);
        setLoadingUsers(false);
      } else {
        setEditingAdmin(null);
      }
    };
    fetchAdmin();
  }, [editingOrg]);

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    
    setSaving(true);
    try {
      // Update Organization
      const { error: orgError } = await db.updateOrganization(editingOrg.id, {
        plan: editingOrg.plan,
        status: editingOrg.status,
        name: editingOrg.name,
        email: editingOrg.email,
        expiryDate: editingOrg.expiryDate
      });
      
      if (orgError) {
        alert('Ошибка при обновлении организации: ' + (orgError as any).message);
        setSaving(false);
        return;
      }

      // Update Admin if changed
      if (editingAdmin) {
        await db.upsertUser(editingAdmin, editingOrg.id);
      }
      
      setOrganizations(prev => prev.map(o => o.id === editingOrg.id ? editingOrg : o));
      setEditingOrg(null);
      alert('Организация и администратор успешно обновлены');
    } catch (error) {
      console.error('Error updating org:', error);
      alert('Произошла ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.name || !newOrg.id || !newOrg.ownerId) {
      alert('Пожалуйста, заполните все обязательные поля (Название, ID, Владелец)');
      return;
    }

    setSaving(true);
    try {
      const orgToCreate = {
        id: newOrg.id,
        name: newOrg.name,
        email: newOrg.email,
        ownerId: newOrg.ownerId,
        plan: newOrg.plan || PlanType.FREE,
        status: newOrg.status || 'active'
      } as Organization;

      await db.createOrganization(orgToCreate);

      // Автоматически создаем первого сотрудника с правами Администратора
      const adminUser: User = {
        id: 'admin',
        name: 'Администратор',
        role: UserRole.EMPLOYER,
        position: 'Администратор',
        pin: '0000',
        isAdmin: true,
        organizationId: orgToCreate.id
      };
      
      await db.upsertUser(adminUser, orgToCreate.id);

      setOrganizations(prev => [...prev, orgToCreate]);
      setIsCreating(false);
      setNewOrg({ plan: PlanType.FREE, status: 'active' });
    } catch (error) {
      console.error('Error creating org:', error);
      alert('Ошибка при создании организации. Возможно, такой ID уже занят.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSaving(true);
    try {
      await db.savePlan(editingPlan);
      setPlans(prev => prev.map(p => p.type === editingPlan.type ? editingPlan : p));
      setEditingPlan(null);
    } catch (error) {
      console.error('Error updating plan:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateTrial = async (orgId: string, days: number, plan: PlanType) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    setSaving(true);
    try {
      await db.updateOrganization(orgId, {
        status: 'trial',
        plan: plan,
        expiryDate: expiryDate.toISOString()
      });
      setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, status: 'trial', plan, expiryDate: expiryDate.toISOString() } : o));
      alert(`Пробный период (${days} дн.) активирован для ${orgId}`);
    } catch (error) {
      console.error('Error activating trial:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetAdminPin = async (orgId: string) => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setResetPinConfirm({ orgId, pin: newPin });
  };

  const confirmResetPin = async () => {
    if (!resetPinConfirm) return;
    
    setSaving(true);
    try {
      await db.resetAdminPin(resetPinConfirm.orgId, resetPinConfirm.pin);
      alert(`Пароль администратора для ${resetPinConfirm.orgId} успешно сброшен. Новый PIN: ${resetPinConfirm.pin}`);
      setResetPinConfirm(null);
    } catch (error) {
      console.error('Error resetting admin pin:', error);
      alert('Ошибка при сбросе пароля.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!confirmDeleteOrg) return;
    if (deletePinInput !== '7777') {
      setDeleteError('Неверный PIN супер-админа');
      return;
    }

    setSaving(true);
    try {
      const { error } = await db.deleteOrganization(confirmDeleteOrg.id);
      if (error) {
        alert('Ошибка при удалении: ' + error);
      } else {
        setOrganizations(prev => prev.filter(o => o.id !== confirmDeleteOrg.id));
        setConfirmDeleteOrg(null);
        setDeletePinInput('');
        setDeleteError(null);
        alert('Организация и все связанные данные успешно удалены');
      }
    } catch (e) {
      console.error(e);
      alert('Произошла ошибка при удалении');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code) {
      alert('Введите код купона');
      return;
    }

    const existingPromo = promoCodes.find(p => p.code.toUpperCase() === newPromo.code?.toUpperCase());
    if (existingPromo) {
      alert('Промокод с таким кодом уже существует');
      return;
    }

    setSaving(true);
    try {
      const promoId = typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const promo: PromoCode = {
        id: promoId,
        code: newPromo.code.toUpperCase(),
        planType: newPromo.planType || PlanType.PRO,
        durationDays: newPromo.durationDays || 14,
        maxUses: newPromo.maxUses || 1,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      const { error } = await db.savePromoCode(promo);
      if (error) {
        const msg = typeof error === 'string' ? error : error.message;
        alert('Ошибка при сохранении промокода в БД: ' + msg);
        // Still update local state so it works in the current session
      }
      setPromoCodes(prev => [promo, ...prev]);
      setNewPromo({
        planType: PlanType.PRO,
        durationDays: 14,
        maxUses: 1,
        isActive: true
      });
    } catch (error) {
      console.error('Error creating promo:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    const promo = promoCodes.find(p => p.id === id);
    if (promo && promo.usedCount > 0) {
      alert('Нельзя удалить промокод, который уже был использован');
      return;
    }
    if (!confirm('Удалить этот промокод?')) return;
    try {
      await db.deletePromoCode(id);
      setPromoCodes(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting promo:', error);
    }
  };

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = Object.values(stats).reduce((acc, curr) => acc + curr, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">SaaS Back-office</h1>
                <p className="text-xs text-indigo-300 font-medium uppercase tracking-wider">Super Admin Panel</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-200 rounded-2xl w-fit mb-8">
          <button 
            onClick={() => setActiveTab('orgs')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'orgs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Организации
          </button>
          <button 
            onClick={() => setActiveTab('plans')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'plans' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Конструктор тарифов
          </button>
          <button 
            onClick={() => setActiveTab('marketing')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'marketing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Маркетинг
          </button>
          <button 
            onClick={() => setActiveTab('diagnostics')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'diagnostics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            Диагностика БД
          </button>
          <button 
            onClick={() => setActiveTab('system' as any)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === ('system' as any) ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Система
          </button>
        </div>

        {activeTab === 'orgs' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Total</span>
                </div>
                <p className="text-sm font-medium text-slate-500">Организаций</p>
                <p className="text-3xl font-bold text-slate-900">{organizations.length}</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <Users className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                </div>
                <p className="text-sm font-medium text-slate-500">Всего пользователей</p>
                <p className="text-3xl font-bold text-slate-900">{totalUsers}</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-50 rounded-xl">
                    <CreditCard className="w-6 h-6 text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Revenue</span>
                </div>
                <p className="text-sm font-medium text-slate-500">Платные подписки</p>
                <p className="text-3xl font-bold text-slate-900">
                  {organizations.filter(o => o.plan !== PlanType.FREE).length}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-center">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Поиск по названию или ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                  />
                </div>
                <button 
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Обновить
                </button>
              </div>
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
              >
                <Plus className="w-5 h-5" />
                Создать организацию
              </button>
            </div>

            {/* Organizations Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-bottom border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Организация</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Тариф</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Пользователи</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                          </td>
                        </tr>
                      ))
                    ) : filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          Организации не найдены
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((org) => (
                        <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
                                {org.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{org.name}</div>
                                <div className="text-xs text-slate-500">Владелец: {org.ownerId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              org.plan === PlanType.BUSINESS ? 'bg-purple-100 text-purple-700' :
                              org.plan === PlanType.PRO ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {org.plan}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${
                                org.status === 'active' ? 'bg-emerald-500' :
                                org.status === 'trial' ? 'bg-amber-500' :
                                'bg-rose-500'
                              }`} />
                              <span className="text-sm font-medium text-slate-700 capitalize">{org.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-bold text-slate-900">{stats[org.id] || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <code className={`text-xs px-2 py-1 rounded font-mono w-fit ${org.id === 'demo_org' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                {org.id}
                              </code>
                              {org.id === 'demo_org' && (
                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Demo System ID</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleViewUsers(org)}
                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50"
                                title="Посмотреть сотрудников"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleResetAdminPin(org.id)}
                                className="p-2 text-slate-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50"
                                title="Сбросить пароль админа"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingOrg(org)}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
                                title="Управление тарифом"
                              >
                                <Settings2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleSwitchToOrg(org.id)}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
                                title="Войти в организацию"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteOrg(org)}
                                className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
                                title="Удалить организацию"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col items-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Проблемы с синхронизацией на мобильном?</p>
              <button 
                onClick={handleHardReset}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all text-xs font-black uppercase tracking-widest border border-slate-200"
              >
                <Trash2 className="w-4 h-4" />
                Очистить кэш и перезагрузить
              </button>
            </div>
          </>
        ) : activeTab === ('system' as any) ? (
          <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Безопасность системы</h3>
                <p className="text-sm text-slate-500">Настройки доступа к панели Супер-Администратора</p>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">PIN-код Супер-Админа</label>
                  <div className="flex gap-4">
                    <input 
                      type="text"
                      maxLength={4}
                      value={newSuperAdminPin}
                      onChange={(e) => setNewSuperAdminPin(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-2xl font-black text-indigo-600 tracking-[0.5em] outline-none focus:border-indigo-500 transition-all"
                      placeholder="7777"
                    />
                    <button 
                      onClick={handleUpdateSystemConfig}
                      disabled={saving}
                      className="px-8 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      {saving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 font-medium italic">
                    Этот PIN используется для входа в Back-office через мастер-ключ.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'plans' ? (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div key={plan.type} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className={`p-6 text-white ${
                    plan.type === PlanType.BUSINESS ? 'bg-purple-600' :
                    plan.type === PlanType.PRO ? 'bg-indigo-600' :
                    'bg-slate-600'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        {plan.type === PlanType.BUSINESS ? <Briefcase className="w-6 h-6" /> :
                         plan.type === PlanType.PRO ? <Zap className="w-6 h-6" /> :
                         <LayoutGrid className="w-6 h-6" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest opacity-80">{plan.type}</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black">{plan.price.toLocaleString()}</span>
                      <span className="text-sm opacity-80">₽ / мес</span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 font-medium">Сотрудников:</span>
                        <span className="font-bold text-slate-900">{plan.limits.maxUsers === 1000 ? 'Безлимит' : plan.limits.maxUsers}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 font-medium">Оборудования:</span>
                        <span className="font-bold text-slate-900">{plan.limits.maxMachines === 1000 ? 'Безлимит' : plan.limits.maxMachines}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`p-1 rounded-md ${plan.limits.features.photoCapture ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Camera className="w-4 h-4" />
                        </div>
                        <span className={plan.limits.features.photoCapture ? 'text-slate-700 font-medium' : 'text-slate-400'}>Фотофиксация</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`p-1 rounded-md ${plan.limits.features.nightShift ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Moon className="w-4 h-4" />
                        </div>
                        <span className={plan.limits.features.nightShift ? 'text-slate-700 font-medium' : 'text-slate-400'}>Ночные смены</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`p-1 rounded-md ${plan.limits.features.advancedAnalytics ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <span className={plan.limits.features.advancedAnalytics ? 'text-slate-700 font-medium' : 'text-slate-400'}>Аналитика</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setEditingPlan(plan)}
                      className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all border border-slate-200 flex items-center justify-center gap-2"
                    >
                      <Settings2 className="w-4 h-4" />
                      Редактировать
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-indigo-900 mb-1">Совет супер-админу</h4>
                <p className="text-sm text-indigo-700 leading-relaxed">
                  Изменения в конструкторе тарифов применяются мгновенно ко всем организациям, использующим данный тариф. 
                  Будьте осторожны при уменьшении лимитов, так как это может ограничить функционал уже работающих клиентов.
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'diagnostics' ? (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Диагностика Supabase</h3>
                  <p className="text-sm text-slate-500">Проверка подключения и целостности таблиц</p>
                </div>
                <button 
                  onClick={runDiagnostics}
                  disabled={checkingDiagnostics}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingDiagnostics ? 'animate-spin' : ''}`} />
                  Запустить проверку
                </button>
              </div>

              {diagnostics ? (
                <div className="space-y-8">
                  {/* Config Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-6 rounded-2xl border ${diagnostics.config.urlSet ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        {diagnostics.config.urlSet ? <Check className="w-5 h-5 text-emerald-600" /> : <X className="w-5 h-5 text-rose-600" />}
                        <span className="font-bold text-slate-900">VITE_SUPABASE_URL</span>
                      </div>
                      <p className="text-xs text-slate-500">{diagnostics.config.urlSet ? 'Настроен корректно' : 'Не найден или содержит значение по умолчанию'}</p>
                    </div>
                    <div className={`p-6 rounded-2xl border ${diagnostics.config.keySet ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        {diagnostics.config.keySet ? <Check className="w-5 h-5 text-emerald-600" /> : <X className="w-5 h-5 text-rose-600" />}
                        <span className="font-bold text-slate-900">VITE_SUPABASE_ANON_KEY</span>
                      </div>
                      <p className="text-xs text-slate-500">{diagnostics.config.keySet ? 'Настроен корректно' : 'Не найден или содержит значение по умолчанию'}</p>
                    </div>
                  </div>

                  {/* Overall Status */}
                  {diagnostics.status === 'error' && (
                    <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-4">
                      <X className="w-6 h-6 text-rose-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-rose-900">Критическая ошибка</h4>
                        <p className="text-sm text-rose-700">{diagnostics.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Tables Section */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Статус таблиц</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(diagnostics.tables || {}).map(([table, status]: [string, any]) => (
                        <div key={table} className={`p-4 rounded-xl border ${status.status === 'ok' ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-bold text-slate-700">{table}</span>
                            {status.status === 'ok' ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-rose-500" />}
                          </div>
                          {status.status !== 'ok' && (
                            <p className="text-[10px] text-rose-600 leading-tight">{status.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Columns Section */}
                  {diagnostics.columns && Object.keys(diagnostics.columns).length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Статус полей (колонок)</h4>
                      {Object.values(diagnostics.columns).every(status => status === 'ok') ? (
                        <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 flex items-center gap-3">
                          <Check className="w-5 h-5 text-emerald-600" />
                          <span className="text-sm font-bold text-emerald-900">Диагностика проведена - все поля и колонки в порядке</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(diagnostics.columns)
                            .filter(([_, status]) => status === 'missing')
                            .map(([col, status]: [string, any]) => (
                            <div key={col} className="p-4 rounded-xl border bg-amber-50 border-amber-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-slate-700">{col}</span>
                                <X className="w-3 h-3 text-amber-500" />
                              </div>
                              <p className="text-[9px] text-amber-600 mt-1">Поле отсутствует</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SQL Fixes Section */}
                  {diagnostics.sqlFixes && diagnostics.sqlFixes.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">SQL для исправления</h4>
                      <div className="p-4 bg-slate-900 rounded-2xl overflow-hidden">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] text-slate-400 font-mono">Скопируйте и выполните в SQL Editor в Supabase</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(diagnostics.sqlFixes.join('\n\n'));
                              alert('SQL скопирован в буфер обмена');
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                          >
                            Копировать всё
                          </button>
                        </div>
                        <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto p-2 max-h-60">
                          {diagnostics.sqlFixes.join('\n\n')}
                        </pre>
                      </div>
                    </div>
                  )}

                  {diagnostics.status === 'partial' && (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                      <Activity className="w-6 h-6 text-amber-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-amber-900">Частичная доступность</h4>
                        <p className="text-sm text-amber-700">Некоторые таблицы отсутствуют или недоступны. Убедитесь, что вы выполнили все SQL-миграции в панели Supabase.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <RefreshCw className="w-10 h-10 text-slate-200 animate-spin mx-auto mb-4" />
                  <p className="text-slate-400">Выполняется диагностика...</p>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-indigo-900 mb-1">Как исправить ошибки?</h4>
                <ul className="text-sm text-indigo-700 space-y-2 list-disc ml-4 mt-2">
                  <li>Проверьте переменные окружения в настройках AI Studio.</li>
                  <li>Убедитесь, что в Supabase созданы все таблицы (organizations, users, work_logs, machines, positions, plans, promo_codes, active_shifts, system_config).</li>
                  <li>Проверьте политики RLS (Row Level Security) — для тестов можно временно разрешить анонимный доступ.</li>
                  <li>Убедитесь, что вы не используете прокси или VPN, блокирующие запросы к Supabase.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Promo Code Creation */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-24">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <Ticket className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-slate-900">Создать промокод</h3>
                  </div>

                  <form onSubmit={handleCreatePromo} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Код (напр. SUMMER24)</label>
                      <input 
                        type="text"
                        required
                        placeholder="PROMO14"
                        value={newPromo.code || ''}
                        onChange={(e) => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Тариф</label>
                        <select 
                          value={newPromo.planType}
                          onChange={(e) => setNewPromo({...newPromo, planType: e.target.value as PlanType})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                          <option value={PlanType.PRO}>PRO</option>
                          <option value={PlanType.BUSINESS}>BUSINESS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Дней</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={newPromo.durationDays || ''}
                          onChange={(e) => setNewPromo({...newPromo, durationDays: parseInt(e.target.value)})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Макс. использований</label>
                      <input 
                        type="number"
                        required
                        min="1"
                        value={newPromo.maxUses || ''}
                        onChange={(e) => setNewPromo({...newPromo, maxUses: parseInt(e.target.value)})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={saving}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Сгенерировать
                    </button>
                  </form>
                </div>
              </div>

              {/* Promo Codes List & Trial Activation */}
              <div className="lg:col-span-2 space-y-8">
                {/* Active Promo Codes */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-indigo-600" />
                      Активные промокоды
                    </h3>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{promoCodes.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {promoCodes.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">Промокоды не созданы</div>
                    ) : (
                      promoCodes.map((promo) => (
                        <div key={promo.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-xs">
                              {promo.code.substring(0, 3)}
                            </div>
                            <div>
                              <div className="font-mono font-bold text-slate-900">{promo.code}</div>
                              <div className="text-xs text-slate-500">
                                {promo.planType} • {promo.durationDays} дн. • Исп: {promo.usedCount}/{promo.maxUses}
                              </div>
                              {promo.usedCount > 0 && promo.lastUsedBy && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  Активирован: {promo.lastUsedBy}
                                  {promo.lastUsedAt && ` (с ${new Date(promo.lastUsedAt).toLocaleDateString()} по ${new Date(new Date(promo.lastUsedAt).getTime() + promo.durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()})`}
                                </div>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeletePromo(promo.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Trial Activation for Clients */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Быстрая активация Trial
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Найти клиента для активации..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-3">
                      {filteredOrgs.slice(0, 5).map(org => (
                        <div key={org.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <div className="font-bold text-sm text-slate-900">{org.name}</div>
                            <div className="text-[10px] text-slate-500">Текущий: {org.plan} • {org.status}</div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleActivateTrial(org.id, 7, PlanType.PRO)}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-all"
                            >
                              +7д PRO
                            </button>
                            <button 
                              onClick={() => handleActivateTrial(org.id, 14, PlanType.BUSINESS)}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                            >
                              +14д BIZ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold">Настройка тарифа: {editingPlan.name}</h3>
              <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePlan} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Название тарифа</label>
                  <input 
                    type="text"
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Цена (₽/мес)</label>
                  <input 
                    type="number"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({...editingPlan, price: parseInt(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Макс. сотрудников</label>
                  <input 
                    type="number"
                    value={editingPlan.limits.maxUsers}
                    onChange={(e) => setEditingPlan({
                      ...editingPlan, 
                      limits: { ...editingPlan.limits, maxUsers: parseInt(e.target.value) }
                    })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Макс. оборудования</label>
                  <input 
                    type="number"
                    value={editingPlan.limits.maxMachines}
                    onChange={(e) => setEditingPlan({
                      ...editingPlan, 
                      limits: { ...editingPlan.limits, maxMachines: parseInt(e.target.value) }
                    })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Доступные функции</label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Фотофиксация</p>
                        <p className="text-xs text-slate-500">Обязательное фото при входе/выходе</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={editingPlan.limits.features.photoCapture}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        limits: {
                          ...editingPlan.limits,
                          features: { ...editingPlan.limits.features, photoCapture: e.target.checked }
                        }
                      })}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <Moon className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Ночные смены</p>
                        <p className="text-xs text-slate-500">Учет работы в ночное время с бонусом</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={editingPlan.limits.features.nightShift}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        limits: {
                          ...editingPlan.limits,
                          features: { ...editingPlan.limits.features, nightShift: e.target.checked }
                        }
                      })}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Продвинутая аналитика</p>
                        <p className="text-xs text-slate-500">Графики, отчеты и экспорт в PDF/Excel</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={editingPlan.limits.features.advancedAnalytics}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        limits: {
                          ...editingPlan.limits,
                          features: { ...editingPlan.limits.features, advancedAnalytics: e.target.checked }
                        }
                      })}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Сохранить тариф
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {/* Modals */}
      {confirmDeleteOrg && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Удаление организации</h3>
              </div>
              <button onClick={() => { setConfirmDeleteOrg(null); setDeletePinInput(''); setDeleteError(null); }} className="text-slate-400 hover:text-slate-900 text-2xl">&times;</button>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                <p className="text-sm text-rose-800 font-bold leading-relaxed">
                  Внимание! Это действие безвозвратно удалит организацию <span className="underline">{confirmDeleteOrg.name}</span> ({confirmDeleteOrg.id}) и ВСЕ связанные данные: сотрудников, логи, оборудование и настройки.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">Введите PIN супер-админа для подтверждения</label>
                <input 
                  type="password"
                  maxLength={4}
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value.replace(/[^0-9]/g, ''));
                    setDeleteError(null);
                  }}
                  placeholder="****"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-center text-2xl font-black tracking-[0.5em] focus:border-rose-500 outline-none transition-all"
                />
                {deleteError && <p className="text-rose-600 text-[10px] font-bold mt-2 text-center uppercase">{deleteError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setConfirmDeleteOrg(null); setDeletePinInput(''); setDeleteError(null); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleDeleteOrg}
                  disabled={saving || deletePinInput.length < 4}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Удаление...' : 'Удалить всё'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingOrg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold">Управление организацией</h3>
              <button onClick={() => setEditingOrg(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateOrg} className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Название компании</label>
                <input 
                  type="text"
                  value={editingOrg.name}
                  onChange={(e) => setEditingOrg({...editingOrg, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email организации</label>
                <input 
                  type="email"
                  value={editingOrg.email || ''}
                  onChange={(e) => setEditingOrg({...editingOrg, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Тарифный план</label>
                  <select 
                    value={editingOrg.plan}
                    onChange={(e) => {
                      const newPlan = e.target.value as PlanType;
                      let newStatus = editingOrg.status;
                      let newExpiry = editingOrg.expiryDate;
                      
                      // Если меняем на платный тариф, автоматически активируем и убираем просрочку
                      if (newPlan !== PlanType.FREE && editingOrg.plan === PlanType.FREE) {
                        newStatus = 'active';
                        // Если дата в прошлом, сбрасываем её
                        if (newExpiry && new Date(newExpiry) < new Date()) {
                          newExpiry = undefined;
                        }
                      }
                      
                      setEditingOrg({
                        ...editingOrg, 
                        plan: newPlan,
                        status: newStatus,
                        expiryDate: newExpiry
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value={PlanType.FREE}>FREE</option>
                    <option value={PlanType.PRO}>PRO</option>
                    <option value={PlanType.BUSINESS}>BUSINESS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Статус</label>
                  <select 
                    value={editingOrg.status}
                    onChange={(e) => setEditingOrg({...editingOrg, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Дата истечения (Expiry Date)</label>
                <div className="flex gap-2">
                  <input 
                    type="date"
                    value={editingOrg.expiryDate ? editingOrg.expiryDate.split('T')[0] : ''}
                    onChange={(e) => setEditingOrg({
                      ...editingOrg, 
                      expiryDate: e.target.value ? new Date(e.target.value).toISOString() : undefined
                    })}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setEditingOrg({...editingOrg, expiryDate: undefined})}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Сбросить
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Оставьте пустым для бессрочного тарифа</p>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Изменение тарифа мгновенно обновит лимиты (пользователи, оборудование) и доступные функции для всех сотрудников этой организации.
                </p>
              </div>

              {editingAdmin && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Данные администратора
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">Имя админа</label>
                      <input 
                        type="text"
                        value={editingAdmin.name}
                        onChange={(e) => setEditingAdmin({...editingAdmin, name: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 tracking-wider">PIN админа</label>
                      <input 
                        type="text"
                        maxLength={4}
                        value={editingAdmin.pin}
                        onChange={(e) => setEditingAdmin({...editingAdmin, pin: e.target.value.replace(/[^0-9]/g, '')})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center tracking-widest"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold">Новая организация</h3>
              <button onClick={() => setIsCreating(false)} className="text-indigo-100 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Название компании *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Напр: ООО Вектор"
                    value={newOrg.name || ''}
                    onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email организации</label>
                  <input 
                    type="email"
                    placeholder="admin@company.com"
                    value={newOrg.email || ''}
                    onChange={(e) => setNewOrg({...newOrg, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Уникальный ID (slug) *</label>
                <input 
                  type="text"
                  required
                  placeholder="Напр: vector-llc"
                  value={newOrg.id || ''}
                  onChange={(e) => setNewOrg({...newOrg, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm ${newOrg.id === 'demo_org' ? 'border-amber-500 bg-amber-50' : 'bg-slate-50 border-slate-200'}`}
                />
                {newOrg.id === 'demo_org' && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 uppercase">⚠️ Внимание: Этот ID зарезервирован для демо-данных</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">Будет использоваться в URL и для входа</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ID Владельца (Admin ID) *</label>
                <input 
                  type="text"
                  required
                  placeholder="Напр: admin"
                  value={newOrg.ownerId || ''}
                  onChange={(e) => setNewOrg({...newOrg, ownerId: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Тариф</label>
                  <select 
                    value={newOrg.plan}
                    onChange={(e) => setNewOrg({...newOrg, plan: e.target.value as PlanType})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value={PlanType.FREE}>FREE</option>
                    <option value={PlanType.PRO}>PRO</option>
                    <option value={PlanType.BUSINESS}>BUSINESS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Статус</label>
                  <select 
                    value={newOrg.status}
                    onChange={(e) => setNewOrg({...newOrg, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Users Modal */}
      {viewingUsersOrg && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold">Сотрудники: {viewingUsersOrg.name}</h3>
                <p className="text-[10px] text-emerald-100 font-mono uppercase tracking-widest">{viewingUsersOrg.id}</p>
              </div>
              <button onClick={() => setViewingUsersOrg(null)} className="text-emerald-100 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingUsers ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-500">Загрузка списка сотрудников...</p>
                </div>
              ) : orgUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  В этой организации пока нет сотрудников
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orgUsers.map(user => (
                    <div key={user.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 font-bold shadow-sm border border-slate-100">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{user.position} • {user.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-slate-400">ID: {user.id}</p>
                        <p className="text-xs font-bold text-indigo-600">PIN: {user.pin}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setViewingUsersOrg(null)}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Reset Confirmation Modal */}
      {resetPinConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Сброс пароля</h3>
            <p className="text-sm text-slate-500 mb-6">
              Вы уверены, что хотите сбросить пароль администратора для организации <span className="font-bold text-slate-900">{resetPinConfirm.orgId}</span>?
            </p>
            
            <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Новый PIN-код</p>
              <p className="text-4xl font-black text-indigo-600 tracking-[0.2em]">{resetPinConfirm.pin}</p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setResetPinConfirm(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
              >
                Отмена
              </button>
              <button 
                onClick={confirmResetPin}
                disabled={saving}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {saving ? '...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminView;
