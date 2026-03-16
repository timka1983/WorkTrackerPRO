
import React from 'react';
import { Plan } from '../types';
import { InterfacePreview } from '../src/components/landing/InterfacePreview';

interface LandingPageProps {
  onStart: () => void;
  onRegister: () => void;
  plans: Plan[];
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onRegister, plans }) => {
  // Fallback plans if none provided or empty
  // We cast to any here because the fallback structure is slightly different for display purposes, 
  // or we should align it with Plan type. Let's align it with Plan type but use a helper for features.
  const displayPlans = plans.length > 0 ? plans : [
    { 
      type: 'FREE', 
      name: 'Старт', 
      price: 0, 
      limits: { 
        maxUsers: 3, 
        maxMachines: 1,
        features: { photoCapture: false, nightShift: false, advancedAnalytics: false, payroll: false } 
      } 
    },
    { 
      type: 'PRO', 
      name: 'Профи', 
      price: 990, 
      limits: { 
        maxUsers: 20, 
        maxMachines: 5,
        features: { photoCapture: true, nightShift: true, advancedAnalytics: true, payroll: true } 
      } 
    },
    { 
      type: 'BUSINESS', 
      name: 'Бизнес', 
      price: 2990, 
      limits: { 
        maxUsers: 100, 
        maxMachines: 20,
        features: { photoCapture: true, nightShift: true, advancedAnalytics: true, payroll: true } 
      } 
    }
  ] as any[]; // Cast to any[] to allow flexible rendering logic below

  const getFeatures = (plan: any) => {
    const features = [];
    // Handle maxUsers
    if (plan.limits?.maxUsers) {
      features.push(`До ${plan.limits.maxUsers} сотрудников`);
    } else {
      features.push('Безлимит сотрудников');
    }

    // Handle explicit features array (if coming from DB with different schema) or object (from types)
    if (Array.isArray(plan.limits?.features)) {
      features.push(...plan.limits.features);
    } else if (plan.limits?.features) {
      if (plan.limits.features.photoCapture) features.push('Фотофиксация');
      if (plan.limits.features.nightShift) features.push('Ночные смены');
      if (plan.limits.features.advancedAnalytics) features.push('PRO Аналитика');
      if (plan.limits.features.payroll) features.push('Модуль Зарплата');
      if (plan.limits.features.shiftMonitoring) features.push('Мониторинг смен');
      if (plan.type === 'FREE') {
         features.push('Базовый табель');
         features.push('Локальное хранение');
      }
      if (plan.type === 'BUSINESS') {
         features.push('Управление ролями');
         features.push('API доступ');
      }
    }
    return features;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-slate-100 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-lg shadow-blue-200">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight">WorkTracker <span className="text-blue-600">PRO</span></span>
          </div>
          <button 
            onClick={onStart}
            className="px-4 py-2 sm:px-6 sm:py-2.5 bg-slate-900 text-white rounded-full text-xs sm:text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            Войти
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 animate-fadeIn">
          Версия 2.2.0-PRO уже доступна
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6 sm:mb-8 animate-slideUp">
          Автоматизация учета времени <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">для производственных предприятий</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-8 sm:mb-10 font-medium leading-relaxed">
          Профессиональная система контроля смен и автоматизации табеля. 
          Никаких турникетов и дорогого оборудования — только смартфоны сотрудников и дисциплина.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4 sm:px-0">
          <button 
            onClick={onRegister}
            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-blue-600 text-white rounded-[2rem] font-black text-base sm:text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-wide"
          >
            Начать бесплатно
          </button>
          <a 
            href="#pricing"
            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-[2rem] font-black text-base sm:text-lg hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wide flex items-center justify-center"
          >
            Тарифы
          </a>
        </div>
        
        {/* Interface Preview */}
        <div className="mt-12 sm:mt-20 relative max-w-7xl mx-auto px-2 sm:px-0">
          <InterfacePreview />
        </div>
      </section>

      {/* For Whom */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black mb-16 text-center uppercase tracking-tight">Для кого наше решение</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Мебельные цеха", desc: "Контроль выработки и времени на сборку изделий без турникетов." },
              { title: "Металлообработка", desc: "Учет работы на станках и дисциплина в производственных зонах." },
              { title: "Пекарни и пищевое производство", desc: "Прозрачный график смен и автоматизация расчетов для сменного персонала." }
            ].map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black mb-3">{item.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">Все, что нужно для контроля</h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium">Технологии, которые работают на ваш бизнес</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { 
                title: "Контроль без турникетов", 
                desc: "Организуйте пункт пропуска в любом цеху. Фотофиксация и PWA-технологии заменяют дорогостоящие системы контроля доступа.",
                icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              },
              { 
                title: "Дисциплина и самоконтроль", 
                desc: "Прозрачная система учета, которая мотивирует сотрудников к самоконтролю и исключает ошибки в расчетах.",
                icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              },
              { 
                title: "Автоматизация табеля", 
                desc: "Мгновенный расчет отработанных часов, ночных смен и переработок. Готовые отчеты для производства и бухгалтерии.",
                icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              },
              { 
                title: "Масштабируемость", 
                desc: "От малого цеха до крупного завода. Система легко адаптируется под рост вашего бизнеса и увеличение штата.",
                icon: "M13 10V3L4 14h7v7l9-11h-7z"
              },
              { 
                title: "Безопасность данных", 
                desc: "Все данные защищены современными протоколами шифрования и хранятся в надежном облаке с ежедневным бэкапом.",
                icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              },
              { 
                title: "Техподдержка 24/7", 
                desc: "Наша команда всегда на связи, чтобы помочь с настройкой системы и ответить на любые технические вопросы.",
                icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              }
            ].map((f, i) => (
              <div key={i} className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2 group">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-black mb-3 sm:mb-4">{f.title}</h3>
                <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black mb-16 text-center uppercase tracking-tight">Как начать работу</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: "01", title: "Регистрация", desc: "Создайте аккаунт компании за 1 минуту." },
              { step: "02", title: "Настройка", desc: "Добавьте сотрудников через ссылку или QR-код." },
              { step: "03", title: "Старт", desc: "Сотрудники отмечаются в приложении — вы видите отчеты." }
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="text-6xl font-black text-blue-100 mb-6">{item.step}</div>
                <h3 className="text-xl font-black mb-4">{item.title}</h3>
                <p className="text-slate-500 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black mb-16 text-center uppercase tracking-tight">Нам доверяют</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Алексей, владелец мебельного цеха", text: "Раньше тратили часы на Excel, теперь расчет зарплаты занимает 10 минут. Сотрудники стали дисциплинированнее." },
              { name: "Марина, управляющая пекарней", text: "Идеально для нас: не нужно ставить турникеты, все работает через смартфоны. Очень просто в настройке." },
              { name: "Сергей, начальник производства", text: "Наконец-то видим реальную картину по сменам. Масштабируемость системы позволила нам подключить второй цех без проблем." }
            ].map((t, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <p className="text-slate-600 font-medium italic mb-6 leading-relaxed">«{t.text}»</p>
                <p className="text-sm font-black uppercase tracking-widest text-blue-600">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-black mb-12 text-center uppercase tracking-tight">Часто задаваемые вопросы</h2>
          <div className="space-y-6">
            {[
              { q: "Как внедрить систему учета рабочего времени?", a: "Внедрение WorkTracker PRO занимает от 15 минут. Просто зарегистрируйте организацию, добавьте сотрудников и установите приложение на их устройства." },
              { q: "Можно ли использовать систему оффлайн?", a: "Да, благодаря PWA-технологиям приложение работает оффлайн, а данные синхронизируются с облаком при появлении сети." },
              { q: "Как происходит расчет зарплаты?", a: "Система автоматически суммирует отработанные часы, учитывает ночные смены, переработки и штрафы на основе настроенных вами правил." }
            ].map((faq, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black mb-3">{faq.q}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black mb-4 uppercase tracking-tight">Тарифные планы</h2>
          <p className="text-slate-500 font-medium italic">Выберите идеальный вариант для масштаба вашего бизнеса</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayPlans.map((plan, index) => {
            const isPopular = plan.type === 'PRO'; // Assuming 'PRO' is popular
            
            // Determine styling based on plan type to match original design
            let containerClasses = "p-10 rounded-[3rem] flex flex-col transition-all ";
            let titleColor = "text-slate-400";
            let checkColor = "text-green-500";
            let buttonClasses = "w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all";
            
            if (plan.type === 'FREE') {
               containerClasses += "border-2 border-slate-100 hover:border-blue-200";
            } else if (plan.type === 'PRO') {
               containerClasses += "border-4 border-blue-600 relative shadow-2xl shadow-blue-100 scale-105 bg-white z-10";
               titleColor = "text-blue-600";
               checkColor = "text-blue-600";
               buttonClasses = "w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95";
            } else if (plan.type === 'BUSINESS') {
               containerClasses += "border-2 border-slate-100 hover:border-slate-300";
               checkColor = "text-indigo-500";
               buttonClasses = "w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all";
            }

            return (
              <div key={plan.type} className={containerClasses}>
                {isPopular && (
                  <div className="absolute top-0 right-10 -translate-y-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Популярный
                  </div>
                )}
                <h3 className={`text-lg font-black uppercase tracking-widest mb-2 ${titleColor}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">{plan.price} ₽</span>
                  <span className="text-slate-400 font-bold">/ мес</span>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {getFeatures(plan).map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                      <svg className={`w-5 h-5 ${checkColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={onRegister} 
                  className={buttonClasses}
                >
                  {plan.price === 0 ? 'Начать бесплатно' : (plan.type === 'BUSINESS' ? 'Связаться с нами' : `Выбрать ${plan.name}`)}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 sm:py-20 px-4 mt-12 sm:mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
           <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
                <div className="bg-blue-600 text-white p-1.5 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xl font-black tracking-tight">WorkTracker <span className="text-blue-500">PRO</span></span>
              </div>
              <p className="text-slate-400 font-medium max-w-sm mx-auto md:mx-0">
                Создано для тех, кто ценит свое время и время своих сотрудников. 
                Лучшее решение для малого и среднего производственного бизнеса.
              </p>
           </div>
           <div className="text-center md:text-right">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Начните сегодня</p>
              <button 
                onClick={onStart}
                className="px-8 sm:px-10 py-3 sm:py-4 bg-white text-slate-900 rounded-full font-black uppercase text-xs tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-2xl shadow-black/20"
              >
                Запустить приложение
              </button>
           </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/10 mt-12 sm:mt-20 pt-8 text-center text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em]">
          © 2026 WorkTracker PRO • Все права защищены
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
