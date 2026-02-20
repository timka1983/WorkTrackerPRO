
import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-lg shadow-blue-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-black tracking-tight">WorkTracker <span className="text-blue-600">PRO</span></span>
          </div>
          <button 
            onClick={onStart}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            Войти в систему
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 animate-fadeIn">
          Версия 1.9.0-PRO уже доступна
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.1] mb-8 animate-slideUp">
          Умный табель для <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">эффективных команд</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
          Профессиональная система учета рабочего времени с фотофиксацией, 
          облачной синхронизацией и мощной аналитикой. Забудьте о бумажных журналах навсегда.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button 
            onClick={onStart}
            className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-wide"
          >
            Начать бесплатно
          </button>
          <a 
            href="#pricing"
            className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-[2rem] font-black text-lg hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wide"
          >
            Тарифы
          </a>
        </div>
        
        {/* Mockup Preview */}
        <div className="mt-20 relative max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full"></div>
          <div className="relative bg-white rounded-[2.5rem] border-8 border-slate-900 shadow-2xl overflow-hidden aspect-[16/10] sm:aspect-[16/9]">
             <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <div className="bg-blue-100 text-blue-600 p-4 rounded-full inline-block mb-4">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Предварительный просмотр интерфейса</p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Все, что нужно для контроля</h2>
            <p className="text-slate-500 font-medium">Технологии, которые работают на ваш бизнес</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                title: "Фотофиксация", 
                desc: "Контроль присутствия через камеру. Исключает возможность того, что за сотрудника отметится кто-то другой.",
                icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              },
              { 
                title: "Облако и PWA", 
                desc: "Данные всегда под рукой. Установите приложение на телефон как обычную иконку и работайте оффлайн.",
                icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              },
              { 
                title: "PRO Аналитика", 
                desc: "Автоматический расчет часов, отчеты в PDF/CSV, графики выработки и учет ночных смен.",
                icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              }
            ].map((f, i) => (
              <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2 group">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-black mb-4">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.desc}</p>
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
          {/* Plan 1 */}
          <div className="p-10 rounded-[3rem] border-2 border-slate-100 flex flex-col hover:border-blue-200 transition-all">
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-400 mb-2">Старт</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">0 ₽</span>
              <span className="text-slate-400 font-bold">/ мес</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {["До 3 сотрудников", "Базовый табель", "Локальное хранение", "Экспорт в JSON"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={onStart} className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Начать бесплатно</button>
          </div>

          {/* Plan 2 - Popular */}
          <div className="p-10 rounded-[3rem] border-4 border-blue-600 flex flex-col relative shadow-2xl shadow-blue-100 scale-105 bg-white z-10">
            <div className="absolute top-0 right-10 -translate-y-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Популярный</div>
            <h3 className="text-lg font-black uppercase tracking-widest text-blue-600 mb-2">Профи</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">990 ₽</span>
              <span className="text-slate-400 font-bold">/ мес</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {["До 20 сотрудников", "Фотофиксация", "Облачная синхронизация", "Отчеты PDF/CSV", "Ночные смены"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-800">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={onStart} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">Выбрать Профи</button>
          </div>

          {/* Plan 3 */}
          <div className="p-10 rounded-[3rem] border-2 border-slate-100 flex flex-col hover:border-slate-300 transition-all">
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-400 mb-2">Бизнес</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">2 990 ₽</span>
              <span className="text-slate-400 font-bold">/ мес</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {["Безлимит сотрудников", "Управление ролями", "Мульти-слот оборудование", "Приоритетная поддержка", "API доступ"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={onStart} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all">Связаться с нами</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20 px-4 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
           <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-blue-600 text-white p-1.5 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xl font-black tracking-tight">WorkTracker <span className="text-blue-500">PRO</span></span>
              </div>
              <p className="text-slate-400 font-medium max-w-sm">
                Создано для тех, кто ценит свое время и время своих сотрудников. 
                Лучшее решение для малого и среднего производственного бизнеса.
              </p>
           </div>
           <div className="text-left md:text-right">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Начните сегодня</p>
              <button 
                onClick={onStart}
                className="px-10 py-4 bg-white text-slate-900 rounded-full font-black uppercase text-xs tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-2xl shadow-black/20"
              >
                Запустить приложение
              </button>
           </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/10 mt-20 pt-8 text-center text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">
          © 2024 WorkTracker PRO • Все права защищены
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
