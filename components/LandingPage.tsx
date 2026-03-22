
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
      name: 'Бесплатный', 
      price: 0, 
      limits: { 
        maxUsers: 3, 
        maxMachines: 2,
        features: { 
          photoCapture: false, 
          nightShift: false, 
          advancedAnalytics: false, 
          payroll: false,
          shiftMonitoring: false,
          payments: true,
          multipleBranches: false,
          auditLog: false
        } 
      } 
    },
    { 
      type: 'PRO', 
      name: 'Профессиональный', 
      price: 2900, 
      limits: { 
        maxUsers: 20, 
        maxMachines: 10,
        features: { 
          photoCapture: true, 
          nightShift: true, 
          advancedAnalytics: true, 
          payroll: true,
          shiftMonitoring: true,
          payments: true,
          multipleBranches: true,
          auditLog: true
        } 
      } 
    },
    { 
      type: 'BUSINESS', 
      name: 'Бизнес', 
      price: 9900, 
      limits: { 
        maxUsers: 1000, 
        maxMachines: 1000,
        features: { 
          photoCapture: true, 
          nightShift: true, 
          advancedAnalytics: true, 
          payroll: true,
          shiftMonitoring: true,
          payments: true,
          multipleBranches: true,
          auditLog: true
        } 
      } 
    }
  ] as any[]; // Cast to any[] to allow flexible rendering logic below

  const getFeatures = (plan: any) => {
    const features = [];
    
    // Сотрудники
    if (plan.limits?.maxUsers >= 1000) {
      features.push('Безлимит сотрудников');
    } else {
      features.push(`До ${plan.limits?.maxUsers || 3} сотрудников`);
    }

    // Оборудование
    if (plan.limits?.maxMachines >= 1000) {
      features.push('Безлимит оборудования');
    } else {
      features.push(`До ${plan.limits?.maxMachines || 2} ед. оборудования`);
    }

    if (plan.limits?.features) {
      const f = plan.limits.features;
      if (f.photoCapture) features.push('Фотофиксация');
      if (f.nightShift) features.push('Ночные смены');
      if (f.advancedAnalytics) features.push('Аналитика');
      if (f.payroll) features.push('Зарплата');
      if (f.shiftMonitoring) features.push('Мониторинг смен');
      if (f.multipleBranches) features.push('Филиалы');
      if (f.auditLog) features.push('Журнал аудита');
      if (f.payments) features.push('Выплаты');
    }

    return features;
  };

  const schemaData = React.useMemo(() => {
    const softwareApp = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "WorkTracker PRO",
      "operatingSystem": "Web, Android, iOS",
      "applicationCategory": "BusinessApplication",
      "description": "Профессиональная система контроля и учета рабочего времени, контроля смен сотрудников и автоматизации табеля для производственных предприятий.",
      "offers": displayPlans.map(plan => ({
        "@type": "Offer",
        "name": plan.name,
        "price": plan.price,
        "priceCurrency": "RUB",
        "description": getFeatures(plan).join(", ")
      }))
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Как внедрить систему учета рабочего времени?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Внедрение WorkTracker PRO занимает от 15 минут. Просто зарегистрируйте организацию, добавьте сотрудников и установите приложение на их устройства."
          }
        },
        {
          "@type": "Question",
          "name": "Можно ли использовать систему оффлайн?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Да, благодаря PWA-технологиям приложение работает оффлайн, а данные синхронизируются с облаком при появлении сети."
          }
        },
        {
          "@type": "Question",
          "name": "Как происходит расчет зарплаты?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Система автоматически суммирует отработанные часы, учитывает ночные смены, переработки и штрафы на основе настроенных вами правил."
          }
        }
      ]
    };

    return [softwareApp, faqPage];
  }, [displayPlans]);

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:text-slate-50 selection:bg-blue-100 font-sans">
      {/* Schema.org JSON-LD */}
      {schemaData.map((data, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-slate-100 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-xl dark:shadow-slate-900/20 shadow-blue-200">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img">
                <title>Логотип WorkTracker PRO — учет времени</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight">WorkTracker <span className="text-blue-600 dark:text-blue-400">PRO</span></span>
          </div>
          <button 
            onClick={onStart}
            className="px-4 py-2 sm:px-6 sm:py-2.5 bg-slate-900 text-white rounded-full text-xs sm:text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl dark:shadow-slate-900/20 shadow-slate-200"
          >
            Войти
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 animate-fadeIn">
          Версия 2.2.0-PRO уже доступна
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6 sm:mb-8 animate-slideUp">
          Автоматизация учета времени <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">для производственных предприятий</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8 sm:mb-10 font-medium leading-relaxed">
          Профессиональная система контроля и учета рабочего времени, контроля смен сотрудников и автоматизации табеля. 
          Никаких турникетов и дорогого оборудования — только смартфоны сотрудников и дисциплина.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4 sm:px-0">
          <button 
            onClick={onRegister}
            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-blue-600 text-white rounded-[2rem] font-black text-base sm:text-lg shadow-2xl dark:shadow-slate-900/40 shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-wide"
          >
            Начать бесплатно за 1 минуту
          </button>
          <a 
            href="#pricing"
            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-white text-slate-900 dark:text-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-base sm:text-lg hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wide flex items-center justify-center"
          >
            Тарифы
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-8 sm:py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">Все, что нужно для контроля</h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">Технологии, которые работают на ваш бизнес</p>
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
              <div key={i} className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-md dark:shadow-slate-900/20 hover:shadow-2xl dark:shadow-slate-900/20 transition-all hover:-translate-y-2 group">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img">
                    <title>{f.title}</title>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-black mb-3 sm:mb-4">{f.title}</h3>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Whom */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black mb-12 text-center uppercase tracking-tight">Для кого наше решение</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Мебельные цеха", desc: "Контроль выработки и времени на сборку изделий без турникетов." },
              { title: "Металлообработка", desc: "Учет работы на станках и дисциплина в производственных зонах." },
              { title: "Пекарни и пищевое производство", desc: "Прозрачный график смен и автоматизация расчетов для сменного персонала." }
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-md dark:shadow-slate-900/20">
                <h3 className="text-lg font-black mb-3">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role-based Benefits */}
      <section className="py-10 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Выгода для каждого сотрудника</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                role: "Владелец бизнеса", 
                benefit: "Полный контроль ФОТ и дисциплины. Сокращение издержек на 15-20% за счет исключения приписок и ошибок.",
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              },
              { 
                role: "Начальник цеха", 
                benefit: "Видит статус всех смен в реальном времени. Больше не нужно бегать по цеху с журналами и проверять присутствие.",
                icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              },
              { 
                role: "Бухгалтер", 
                benefit: "Автоматический табель Т-13. Расчет зарплаты, ночных и переработок в один клик. Интеграция с 1С.",
                icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              }
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:bg-white/10 transition-all group">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-xl dark:shadow-slate-900/20 shadow-blue-500/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-black mb-4 text-blue-400 uppercase tracking-tight">{item.role}</h3>
                <p className="text-slate-400 font-medium leading-relaxed">{item.benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interface Preview Section */}
      <section className="py-8 sm:py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 uppercase tracking-tight">Интуитивный интерфейс</h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">Управляйте производством с любого устройства</p>
          </div>
          <div className="relative max-w-5xl mx-auto">
            <InterfacePreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black mb-12 text-center uppercase tracking-tight">Как начать работу</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: "01", title: "Регистрация", desc: "Создайте аккаунт компании за 1 минуту." },
              { step: "02", title: "Настройка", desc: "Добавьте сотрудников через ссылку или QR-код." },
              { step: "03", title: "Старт", desc: "Сотрудники отмечаются в приложении — вы видите отчеты." }
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="text-6xl font-black text-blue-100 mb-6">{item.step}</div>
                <h3 className="text-xl font-black mb-4">{item.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Guarantees */}
      <section className="py-8 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 100 L100 0 L100 100 Z" fill="currentColor" />
          </svg>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {[
              {
                title: "Данные зашифрованы",
                desc: "Используем SSL/TLS шифрование банковского уровня для защиты всей передаваемой информации.",
                icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              },
              {
                title: "Ежедневные бэкапы",
                desc: "Ваши данные дублируются в нескольких дата-центрах. Мы гарантируем сохранность истории за последние 5 лет.",
                icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              },
              {
                title: "Соответствие ФЗ-152",
                desc: "Полное соответствие законодательству РФ о персональных данных. Сервера находятся на территории России.",
                icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04M12 21.48l-.392-.232a12.81 12.81 0 01-9.89-8.115l-.494-1.483.007-.001a11.952 11.952 0 0110.769-9.05l.008-.001.008.001a11.952 11.952 0 0110.769 9.05l.007.001-.494 1.483a12.81 12.81 0 01-9.89 8.115l-.392.232z"
              }
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center md:items-start md:text-left gap-4 group">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors duration-500">
                  <svg className="w-7 h-7 text-blue-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img">
                    <title>{s.title}</title>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black mb-1 uppercase tracking-tight">{s.title}</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black mb-12 text-center uppercase tracking-tight">Нам доверяют</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Алексей, владелец мебельного цеха", text: "Раньше тратили часы на Excel, теперь расчет зарплаты занимает 10 минут. Сотрудники стали дисциплинированнее." },
              { name: "Марина, управляющая пекарней", text: "Идеально для нас: не нужно ставить турникеты, все работает через смартфоны. Очень просто в настройке." },
              { name: "Сергей, начальник производства", text: "Наконец-то видим реальную картину по сменам. Масштабируемость системы позволила нам подключить второй цех без проблем." }
            ].map((t, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <p className="text-slate-600 dark:text-slate-300 font-medium italic mb-6 leading-relaxed">«{t.text}»</p>
                <p className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-10 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-black mb-10 text-center uppercase tracking-tight">Часто задаваемые вопросы</h2>
          <div className="space-y-6">
            {[
              { q: "Как внедрить систему учета рабочего времени?", a: "Внедрение WorkTracker PRO занимает от 15 минут. Просто зарегистрируйте организацию, добавьте сотрудников и установите приложение на их устройства." },
              { q: "Можно ли использовать систему оффлайн?", a: "Да, благодаря PWA-технологиям приложение работает оффлайн, а данные синхронизируются с облаком при появлении сети." },
              { q: "Как происходит расчет зарплаты?", a: "Система автоматически суммирует отработанные часы, учитывает ночные смены, переработки и штрафы на основе настроенных вами правил." }
            ].map((faq, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-md dark:shadow-slate-900/20">
                <h3 className="text-lg font-black mb-3">{faq.q}</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Block */}
      <section className="py-10 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-600 rounded-[3rem] p-8 sm:p-16 text-white flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="flex-1 text-center md:text-left relative z-10">
              <h2 className="text-3xl sm:text-4xl font-black mb-6 uppercase tracking-tight">Интеграция с 1С и Excel</h2>
              <p className="text-blue-100 text-lg font-medium mb-8 leading-relaxed">
                Выгружайте готовые табели и расчеты напрямую в вашу учетную систему. 
                Поддержка форматов CSV, XLSX и прямая совместимость с 1С:ЗУП.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/20 font-black uppercase text-xs tracking-widest">1С:ЗУП</div>
                <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/20 font-black uppercase text-xs tracking-widest">Excel</div>
                <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/20 font-black uppercase text-xs tracking-widest">Google Sheets</div>
              </div>
            </div>
            <div className="w-full md:w-1/3 flex justify-center relative z-10">
               <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl dark:shadow-slate-900/40 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </div>
                    <span className="text-slate-900 dark:text-slate-50 font-black uppercase text-xs tracking-widest">Экспорт табеля</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-slate-100 rounded-full"></div>
                    <div className="h-2 w-3/4 bg-slate-100 rounded-full"></div>
                    <div className="h-2 w-1/2 bg-blue-100 rounded-full"></div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black mb-4 uppercase tracking-tight">Тарифные планы</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium italic">Выберите идеальный вариант для масштаба вашего бизнеса</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayPlans.map((plan, index) => {
            const isPopular = plan.type === 'PRO'; // Assuming 'PRO' is popular
            
            // Determine styling based on plan type to match original design
            let containerClasses = "p-10 rounded-[3rem] flex flex-col transition-all ";
            let titleColor = "text-slate-400";
            let checkColor = "text-green-500";
            let buttonClasses = "w-full py-4 bg-slate-100 text-slate-900 dark:text-slate-50 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all";
            
            if (plan.type === 'FREE') {
               containerClasses += "border-2 border-slate-100 hover:border-blue-200";
            } else if (plan.type === 'PRO') {
               containerClasses += "border-4 border-blue-600 relative shadow-2xl dark:shadow-slate-900/40 shadow-blue-100 scale-105 bg-white z-10";
               titleColor = "text-blue-600 dark:text-blue-400";
               checkColor = "text-blue-600 dark:text-blue-400";
               buttonClasses = "w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-2xl dark:shadow-slate-900/20 shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95";
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
                    <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
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
      <footer className="bg-slate-900 text-white py-8 sm:py-10 px-4 mt-8 sm:mt-12">
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
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Начните сегодня</p>
              <button 
                onClick={onStart}
                className="px-8 sm:px-10 py-3 sm:py-4 bg-white text-slate-900 dark:text-slate-50 rounded-full font-black uppercase text-xs tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-2xl dark:shadow-slate-900/40 shadow-black/20"
              >
                Запустить приложение
              </button>
           </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/10 mt-12 sm:mt-20 pt-8 text-center text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em]">
          © 2026 WorkTracker PRO • Все права защищены
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
