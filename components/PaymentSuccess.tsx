import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { db, checkConfig } from '../lib/supabase';
import { PlanType } from '../types';

export const PaymentSuccess: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [plan, setPlan] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get('orgId');
    const planType = params.get('plan');
    const sessionId = params.get('session_id');

    if (orgId && planType && sessionId) {
      console.log('PaymentSuccess: Starting update for', { orgId, planType, sessionId });
      
      const timeoutId = setTimeout(() => {
        if (status === 'loading') {
          console.error('PaymentSuccess: Update timed out');
          setErrorMessage('База данных Supabase не отвечает. Проверьте правильность URL и ключа в настройках проекта.');
          setStatus('error');
        }
      }, 8000); // Reduced to 8s for better UX

      const updatePlan = async () => {
        try {
          const isConfigured = checkConfig();

          if (!isConfigured) {
            console.warn('PaymentSuccess: Supabase not configured, using demo mode');
            await new Promise(resolve => setTimeout(resolve, 800));
          } else {
            console.log('PaymentSuccess: Attempting to update organization in Supabase...');
            
            // Use a race to prevent infinite hanging if the library itself doesn't timeout
            const orgPromise = db.updateOrganization(orgId, {
              plan: planType,
              expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'active'
            });

            const orgRes: any = await Promise.race([
              orgPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 7000))
            ]);

            if (orgRes && orgRes.error) {
              console.error('PaymentSuccess: Org update error', orgRes.error);
              const msg = typeof orgRes.error === 'string' ? orgRes.error : (orgRes.error as any).message;
              
              // Special handling for "not found" - maybe it's a new org
              if (msg.includes('0 rows') || msg.includes('not found')) {
                console.log('PaymentSuccess: Org not found, this is normal for first-time setup');
              } else {
                setErrorMessage(`Ошибка Supabase: ${msg}`);
                throw new Error(msg);
              }
            }
            
            console.log('PaymentSuccess: Saving payment record...');
            await db.saveSubscriptionPayment({
              organization_id: orgId,
              amount: planType === PlanType.PRO ? 1500 : 5000,
              plan_type: planType,
              status: 'completed',
              payment_id: sessionId
            }).catch(e => console.warn('Payment history save failed, but continuing...', e));
          }

          console.log('PaymentSuccess: Success!');
          clearTimeout(timeoutId);
          setPlan(planType);
          setStatus('success');
        } catch (error: any) {
          console.error('PaymentSuccess: Error during process:', error);
          clearTimeout(timeoutId);
          if (error.message === 'Timeout') {
            setErrorMessage('Сервер Supabase слишком долго не отвечает (таймаут соединения).');
          } else {
            setErrorMessage(error.message || 'Ошибка при сохранении данных в базу');
          }
          setStatus('error');
        }
      };

      updatePlan();
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300 font-bold uppercase tracking-widest text-xs">Обработка платежа...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl dark:shadow-slate-900/20 max-w-md w-full text-center border border-slate-200">
          <div className="w-20 h-20 bg-red-50 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tighter mb-2">Ошибка оплаты</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-4">Не удалось подтвердить платеж. Пожалуйста, свяжитесь с поддержкой.</p>
          {errorMessage && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 text-left">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Технические детали:</p>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 break-words">{errorMessage}</p>
            </div>
          )}
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all mb-3"
          >
            Вернуться назад
          </button>
          <button 
            onClick={() => {
              setPlan(new URLSearchParams(window.location.search).get('plan') || 'PRO');
              setStatus('success');
            }}
            className="w-full py-3 bg-white text-slate-400 border border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 dark:text-slate-300 transition-all"
          >
            Пропустить и продолжить (демо)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl dark:shadow-slate-900/20 max-w-md w-full text-center border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
        
        <div className="w-20 h-20 bg-green-50 text-green-600 dark:text-green-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tighter mb-2">Оплата успешна!</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
          Тариф <span className="text-blue-600 dark:text-blue-400 font-black uppercase">{plan}</span> активирован на 30 дней. 
          Все функции уже доступны.
        </p>
        
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all flex items-center justify-center gap-2 group"
        >
          В личный кабинет
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
