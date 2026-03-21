
import React from 'react';
import { InterfacePreview } from './InterfacePreview';

// ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО ПРИЛОЖЕНИЯ
const APP_URL = 'https://app.worktracker.pro';

const LandingPage: React.FC = () => {
  const onStart = () => window.location.href = `${APP_URL}/login`;
  const onRegister = () => window.location.href = `${APP_URL}/register`;

  const displayPlans = [
    { name: 'Бесплатный', price: 0, features: ['До 3 сотрудников', 'До 2 ед. оборудования', 'Выплаты'] },
    { name: 'Профессиональный', price: 2900, features: ['До 20 сотрудников', 'До 10 ед. оборудования', 'Фотофиксация', 'Ночные смены', 'Аналитика', 'Зарплата', 'Мониторинг смен', 'Филиалы', 'Журнал аудита'] },
    { name: 'Бизнес', price: 9900, features: ['Безлимит сотрудников', 'Безлимит оборудования', 'Все функции PRO', 'Персональный менеджер'] }
  ];

  const schemaData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "WorkTracker PRO",
      "operatingSystem": "Web, Android, iOS",
      "applicationCategory": "BusinessApplication",
      "description": "Профессиональная система контроля и учета рабочего времени для производственных предприятий.",
      "offers": displayPlans.map(plan => ({
        "@type": "Offer",
        "name": plan.name,
        "price": plan.price,
        "priceCurrency": "RUB"
      }))
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Как внедрить систему учета рабочего времени?",
          "acceptedAnswer": { "@type": "Answer", "text": "Внедрение WorkTracker PRO занимает от 15 минут." }
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 font-sans">
      {schemaData.map((data, idx) => (
        <script key={idx} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      ))}

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-slate-100 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-lg shadow-blue-200">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img">
                <title>Логотип WorkTracker PRO</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight">WorkTracker <span className="text-blue-600">PRO</span></span>
          </div>
          <button onClick={onStart} className="px-4 py-2 sm:px-6 sm:py-2.5 bg-slate-900 text-white rounded-full text-xs sm:text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200">
            Войти
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 animate-fadeIn">
          Версия 2.2.0-PRO уже доступна
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6 sm:mb-8 animate-slideUp">
          Автоматизация учета времени <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">для производственных предприятий</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-8 sm:mb-10 font-medium leading-relaxed">
          Профессиональная система контроля и учета рабочего времени, контроля смен сотрудников и автоматизации табеля. 
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4 sm:px-0">
          <button onClick={onRegister} className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-blue-600 text-white rounded-[2rem] font-black text-base sm:text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-wide">
            Начать бесплатно за 1 минуту
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-8 sm:py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">Все, что нужно для контроля</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { title: "Контроль без турникетов", desc: "Фотофиксация и PWA-технологии заменяют дорогостоящие системы.", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "Дисциплина", desc: "Прозрачная система учета, которая мотивирует сотрудников.", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
              { title: "Автоматизация табеля", desc: "Мгновенный расчет отработанных часов и ночных смен.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} /></svg>
                </div>
                <h3 className="text-lg font-black mb-3">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interface Preview */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black mb-12 text-center uppercase tracking-tight">Интуитивный интерфейс</h2>
          <InterfacePreview />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-12 text-center uppercase tracking-tight">Тарифные планы</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayPlans.map((plan, i) => (
              <div key={i} className={`p-8 rounded-[2.5rem] bg-white border-2 ${i === 1 ? 'border-blue-600 shadow-xl' : 'border-slate-100'}`}>
                <h3 className="text-lg font-black uppercase mb-2">{plan.name}</h3>
                <div className="text-3xl font-black mb-6">{plan.price} ₽ <span className="text-sm text-slate-400">/ мес</span></div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onRegister} className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${i === 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                  Выбрать
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-10 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="bg-blue-600 text-white p-1.5 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-xl font-black tracking-tight">WorkTracker <span className="text-blue-500">PRO</span></span>
          </div>
          <p className="text-slate-400 text-xs uppercase tracking-widest">© 2026 WorkTracker PRO • Все права защищены</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
