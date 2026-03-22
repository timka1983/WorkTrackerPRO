import React, { useState, useEffect } from 'react';
import { PlanType, Plan, Organization, PlanLimits, User, Machine } from '../../types';
import { format } from 'date-fns';
import { PLAN_LIMITS } from '../../constants';
import { db } from '../../lib/supabase';

interface BillingViewProps {
  currentOrg: Organization | null;
  plans: Plan[];
  planLimits: PlanLimits;
  users: User[];
  machines: Machine[];
  promoCode: string;
  setPromoCode: (code: string) => void;
  isApplyingPromo: boolean;
  handleApplyPromo: () => void;
  promoMessage: { text: string, type: 'success' | 'error' } | null;
}

export const BillingView: React.FC<BillingViewProps> = ({
  currentOrg,
  plans,
  planLimits,
  users,
  machines,
  promoCode,
  setPromoCode,
  isApplyingPromo,
  handleApplyPromo,
  promoMessage
}) => {
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (currentOrg) {
      db.getSubscriptionHistory(currentOrg.id).then(history => {
        if (history) setPaymentHistory(history);
      });
    }
  }, [currentOrg]);

  const handleSelectPlan = async (planType: PlanType) => {
    if (!currentOrg) return;
    setIsProcessingPayment(planType);
    
    try {
      const response = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: currentOrg.id,
          planType: planType,
          amount: planType === PlanType.PRO ? 1500 : 5000 // Example prices
        })
      });

      if (!response.ok) throw new Error('Failed to create payment session');
      
      const { url } = await response.json();
      // In a real app, you would redirect to the payment provider
      // For this demo, we'll open the URL in a new tab or redirect
      window.location.href = url;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Ошибка при создании платежа. Попробуйте позже.');
    } finally {
      setIsProcessingPayment(null);
    }
  };

  return (
    <div className="space-y-8 no-print animate-fadeIn">
      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.82v-1.91c-1.52-.35-2.82-1.3-3.27-2.7h1.82c.45.75 1.2 1.25 2.1 1.25 1.1 0 2-.9 2-2s-.9-2-2-2c-2.1 0-3.9-1.8-3.9-3.9s1.8-3.9 3.9-3.9V5h2.82v1.91c1.52.35 2.82 1.3 3.27 2.7h-1.82c-.45-.75-1.2-1.25-2.1-1.25-1.1 0-2 .9-2 2s.9 2 2 2c2.1 0 3.9 1.8 3.9 3.9s-1.8 3.9-3.9 3.9z"/></svg>
        </div>
        
        <div className="relative z-10">
          <h3 className="font-black text-slate-900 dark:text-slate-100 mb-2 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Ваш тарифный план</h3>
          <div className="flex items-baseline gap-3 mt-6">
            <span className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">{currentOrg?.plan || PlanType.FREE}</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100 dark:border-blue-800">Активен</span>
            {currentOrg?.expiryDate && (
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-4">
                До: {format(new Date(currentOrg.expiryDate), 'dd.MM.yyyy')}
              </span>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 max-w-md">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 ml-1">Активация промокода</h4>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                placeholder="Введите код..."
                className="flex-1 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-widest outline-none focus:border-blue-500 transition-all bg-white dark:bg-slate-900 dark:text-slate-100"
              />
              <button 
                onClick={handleApplyPromo}
                disabled={isApplyingPromo || !promoCode.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl dark:shadow-slate-900/20 shadow-blue-100 dark:shadow-none hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:shadow-none transition-all"
              >
                {isApplyingPromo ? '...' : 'ОК'}
              </button>
            </div>
            {promoMessage && (
              <p className={`mt-3 text-[10px] font-bold uppercase tracking-tight px-4 py-2 rounded-xl ${promoMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'}`}>
                {promoMessage.text}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Сотрудники</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{users.length}</span>
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">/ {planLimits.maxUsers}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${users.length / planLimits.maxUsers > 0.9 ? 'bg-red-500' : 'bg-blue-600'}`} 
                  style={{ width: `${Math.min((users.length / planLimits.maxUsers) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Оборудование</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{machines.length}</span>
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">/ {planLimits.maxMachines}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${machines.length / planLimits.maxMachines > 0.9 ? 'bg-red-500' : 'bg-blue-600'}`} 
                  style={{ width: `${Math.min((machines.length / planLimits.maxMachines) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Функционал</p>
              <div className="space-y-2 mt-1">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.photoCapture ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span className={`text-[10px] font-bold uppercase ${planLimits.features.photoCapture ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Фотофиксация</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.nightShift ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span className={`text-[10px] font-bold uppercase ${planLimits.features.nightShift ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Ночные смены</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.advancedAnalytics ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span className={`text-[10px] font-bold uppercase ${planLimits.features.advancedAnalytics ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Аналитика</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.payroll ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span className={`text-[10px] font-bold uppercase ${planLimits.features.payroll ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Зарплата</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.shiftMonitoring ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span className={`text-[10px] font-bold uppercase ${planLimits.features.shiftMonitoring ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Мониторинг</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[PlanType.FREE, PlanType.PRO, PlanType.BUSINESS].map((planType) => {
          const dynamicPlan = plans.find(p => p.type === planType);
          const limits = dynamicPlan ? dynamicPlan.limits : PLAN_LIMITS[planType];
          const isCurrent = currentOrg?.plan === planType;
          
          return (
            <div key={planType} className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 transition-all flex flex-col ${isCurrent ? 'border-blue-600 shadow-2xl dark:shadow-slate-900/20 shadow-blue-50 dark:shadow-none' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter text-xl">{dynamicPlan?.name || planType}</h4>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                    {planType === PlanType.FREE ? 'Для малого бизнеса' : planType === PlanType.PRO ? 'Для растущих команд' : 'Для крупных предприятий'}
                  </p>
                </div>
                {isCurrent && <span className="text-[8px] font-black bg-blue-600 text-white px-2 py-1 rounded-full uppercase">Текущий</span>}
              </div>
              
              <div className="mb-8 space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{limits.maxUsers === 1000 ? 'Безлимитно' : `${limits.maxUsers} сотрудников`}</p>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Макс. пользователей</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{limits.maxMachines === 1000 ? 'Безлимитно' : `${limits.maxMachines} станков`}</p>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Оборудование</p>
                  </div>
                </div>

                <div className="pt-4 space-y-2 border-t border-slate-50 dark:border-slate-800">
                  {[
                    { label: 'Фотофиксация', enabled: limits.features.photoCapture },
                    { label: 'Ночные смены', enabled: limits.features.nightShift },
                    { label: 'Аналитика', enabled: limits.features.advancedAnalytics },
                    { label: 'Зарплата', enabled: limits.features.payroll },
                    { label: 'Мониторинг смен', enabled: limits.features.shiftMonitoring },
                    { label: 'Облачная синхронизация', enabled: true },
                    { label: 'Техподдержка 24/7', enabled: planType !== PlanType.FREE },
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {feat.enabled ? (
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-3 h-3 text-slate-300 dark:text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                      )}
                      <span className={`text-[10px] font-bold uppercase ${feat.enabled ? 'text-slate-600 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600 dark:text-slate-300 line-through'}`}>{feat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                disabled={isCurrent || isProcessingPayment === planType}
                onClick={() => handleSelectPlan(planType as PlanType)}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isCurrent ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 dark:text-slate-400 cursor-default' : 'bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 shadow-xl dark:shadow-slate-900/20 shadow-slate-100 dark:shadow-none hover:shadow-blue-100 active:scale-95'}`}
              >
                {isCurrent ? 'Ваш тариф' : isProcessingPayment === planType ? 'Загрузка...' : 'Выбрать тариф'}
              </button>
            </div>

          );
        })}
      </div>

      {paymentHistory.length > 0 && (
        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 mt-8">
          <h3 className="font-black text-slate-900 dark:text-slate-100 mb-6 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">История платежей</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Дата</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Тариф</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Сумма</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {paymentHistory.map((payment, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                      {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm')}
                    </td>
                    <td className="py-4">
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                        {payment.plan_type}
                      </span>
                    </td>
                    <td className="py-4 text-xs font-black text-slate-900 dark:text-slate-100">
                      {payment.amount} {payment.currency || 'RUB'}
                    </td>
                    <td className="py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${
                        payment.status === 'completed' 
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' 
                          : 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800'
                      }`}>
                        {payment.status === 'completed' ? 'Успешно' : 'В обработке'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
};
