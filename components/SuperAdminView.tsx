
import React, { useState, useEffect } from 'react';
import { Organization, PlanType, Plan, PromoCode } from '../types';
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
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'orgs' | 'plans' | 'marketing'>('orgs');
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgs, globalStats, dbPlans, dbPromoCodes] = await Promise.all([
        db.getAllOrganizations(),
        db.getGlobalStats(),
        db.getPlans(),
        db.getPromoCodes()
      ]);
      if (orgs) setOrganizations(orgs);
      if (globalStats) setStats(globalStats);
      
      if (dbPromoCodes) {
        setPromoCodes(dbPromoCodes);
      } else {
        const cachedPromos = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
        if (cachedPromos) setPromoCodes(JSON.parse(cachedPromos));
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

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    
    setSaving(true);
    try {
      await db.updateOrganization(editingOrg.id, {
        plan: editingOrg.plan,
        status: editingOrg.status,
        name: editingOrg.name,
        email: editingOrg.email
      });
      setOrganizations(prev => prev.map(o => o.id === editingOrg.id ? editingOrg : o));
      setEditingOrg(null);
    } catch (error) {
      console.error('Error updating org:', error);
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
    if (!confirm(`Вы действительно хотите сбросить пароль администратора для организации ${orgId}? Новый PIN: ${newPin}`)) return;
    
    setSaving(true);
    try {
      await db.resetAdminPin(orgId, newPin);
      alert(`Пароль администратора для ${orgId} успешно сброшен. Новый PIN: ${newPin}`);
    } catch (error) {
      console.error('Error resetting admin pin:', error);
      alert('Ошибка при сбросе пароля.');
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

    setSaving(true);
    try {
      const promo: PromoCode = {
        id: crypto.randomUUID(),
        code: newPromo.code.toUpperCase(),
        planType: newPromo.planType || PlanType.PRO,
        durationDays: newPromo.durationDays || 14,
        maxUses: newPromo.maxUses || 1,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      await db.savePromoCode(promo);
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
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono">
                              {org.id}
                            </code>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setEditingOrg(org)}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Управление тарифом"
                              >
                                <Settings2 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleResetAdminPin(org.id)}
                                className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                                title="Сбросить пароль админа"
                              >
                                <RefreshCw className="w-5 h-5" />
                              </button>
                              <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                <ExternalLink className="w-5 h-5" />
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
          </>
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
                    onChange={(e) => setEditingOrg({...editingOrg, plan: e.target.value as PlanType})}
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

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Изменение тарифа мгновенно обновит лимиты (пользователи, оборудование) и доступные функции для всех сотрудников этой организации.
                </p>
              </div>

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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                />
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
    </div>
  );
};

export default SuperAdminView;
