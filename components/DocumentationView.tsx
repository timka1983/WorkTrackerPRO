
import React, { useState } from 'react';
import { HelpCircle, ChevronRight, ChevronDown, Shield, Users, Clock, CreditCard, Settings, Activity, Archive, MapPin, Bell } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const DocumentationView: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const sections: DocSection[] = [
    {
      id: 'overview',
      title: 'Обзор системы',
      icon: <HelpCircle className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            WorkTracker PRO — это комплексная PWA-платформа для автоматизации учета рабочего времени на производственных предприятиях. 
            Система построена на стеке React + Supabase и работает по модели SaaS.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">Для сотрудников</h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">Простая регистрация смен через смартфон, фотофиксация, просмотр своей статистики и начислений.</p>
            </div>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-100 mb-2">Для работодателей</h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300">Мониторинг в реальном времени, управление филиалами, автоматический расчет зарплат и аналитика.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'team',
      title: 'Управление командой',
      icon: <Users className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Сотрудники и Должности</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Раздел позволяет добавлять сотрудников, назначать им роли и привязывать к конкретным филиалам.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-2 ml-2">
            <li><b className="text-slate-900 dark:text-slate-50">Матрица компетенций</b>: Визуальное отображение навыков и допусков сотрудников к оборудованию.</li>
            <li><b className="text-slate-900 dark:text-slate-50">Конструктор функций</b>: Гибкая настройка прав доступа для каждой должности.</li>
            <li><b className="text-slate-900 dark:text-slate-50">Архивация</b>: Сотрудников нельзя удалить полностью, если у них есть история смен — их можно только архивировать для сохранения отчетности.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'shifts',
      title: 'Мониторинг смен',
      icon: <Clock className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Контроль в реальном времени</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Модуль «Монитор» отображает всех сотрудников, находящихся на смене в данный момент.
          </p>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Технические особенности:</h5>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <li>• <b className="text-slate-900 dark:text-slate-50">Авто-завершение</b>: Если сотрудник забыл закрыть смену, система автоматически закроет её через заданные интервалы (настраивается в Настройках).</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Фотофиксация</b>: Принудительное селфи при входе и выходе для исключения подмены (требует разрешения камеры).</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Геолокация</b>: Проверка координат устройства относительно центральной точки филиала.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'payroll',
      title: 'Зарплата и Финансы',
      icon: <CreditCard className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Автоматизация расчетов и взаиморасчеты</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Модуль «Зарплата» — это полноценная финансовая система, которая не только считает начисления, но и отслеживает реальный баланс задолженности перед сотрудниками.
          </p>
          
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Как работают взаиморасчеты:</h5>
              <ul className="text-xs space-y-3 text-slate-600 dark:text-slate-300">
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Автоматический расчет</b>: 
                  Система суммирует заработок на основе часов (по общим или станочным ставкам), сверхурочных, ночных смен, премий и штрафов.
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Учет выплат (Авансы)</b>: 
                  Вы можете фиксировать выдачу авансов и зарплат. Каждая операция сохраняется в «Истории выплат» сотрудника.
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Контроль баланса («К выплате»)</b>: 
                  Ключевой показатель, который показывает разницу между начисленной суммой и уже выданными деньгами. 
                  Красный цвет суммы сигнализирует о переплате.
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Финансовые периоды</b>: 
                  Статусы «Черновик», «Утверждено» и «Оплачено» позволяют защитить данные от изменений после закрытия месяца.
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Расчетные листки</b>: 
                  Возможность генерации PDF-документа для сотрудника со всеми деталями начислений и удержаний.
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Иконка «Сохранено» (Синяя галочка)</b>: 
                  Означает, что расчет для сотрудника зафиксирован (создан снимок). Это защищает данные от случайных изменений при редактировании старых логов. Для обновления данных используйте кнопку «Пересчитать».
                </li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                <b className="text-blue-900 dark:text-blue-100">Важно:</b> Модуль авансов и детальной истории выплат доступен в тарифе <b className="text-blue-900 dark:text-blue-100">BUSINESS</b>. 
                В базовых тарифах доступен только расчет начислений.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Правила начислений:</h5>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <li>• <b className="text-slate-900 dark:text-slate-50">Ночные смены</b>: Автоматическое добавление бонусных минут (процент настраивается).</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Округление</b>: Правило 15 минут (до 15 мин — в пользу часа, после 15 мин — по факту).</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Штрафы</b>: Возможность ручной корректировки суммы к выплате за конкретные смены.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'archive',
      title: 'Архивация и История',
      icon: <Archive className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Сохранность данных</h4>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/30">
            <p className="text-sm text-amber-900 dark:text-amber-100 font-bold mb-2">Важное правило оборудования:</p>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              При перемещении оборудования (станков) в архив, **вся информация о работе на нем сохраняется**. 
              В исторических отчетах и табелях за прошлые периоды вы по-прежнему будете видеть название этого оборудования. 
              Связь между логами смен и ID оборудования не разрывается, даже если станок больше не используется.
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Архивация позволяет поддерживать список активных элементов в чистоте, не теряя при этом юридически значимую информацию о прошлых периодах работы.
          </p>
        </div>
      )
    },
    {
      id: 'settings',
      title: 'Глобальные настройки',
      icon: <Settings className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
              <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">Геолокация (Анти-фрод)</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">Настройка координат и радиуса допустимой зоны работы. Блокирует вход в смену, если сотрудник вне зоны.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
              <Bell className="w-8 h-8 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">Telegram Уведомления</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">Интеграция через Bot API. Позволяет получать мгновенные отчеты о начале/конце смен и переработках в групповой чат.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'debug',
      title: 'Блок отладки',
      icon: <Activity className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Инструменты обслуживания и диагностики</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Блок отладки — это мощный инструмент для администраторов, позволяющий контролировать состояние системы «под капотом» и исправлять редкие технические коллизии.
          </p>
          
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 dark:bg-slate-950 rounded-2xl border border-slate-800 dark:border-slate-800">
              <h5 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-3">Интерфейс и возможности:</h5>
              <ul className="text-xs space-y-3 text-slate-400 dark:text-slate-400">
                <li>
                  <b className="text-slate-100 dark:text-slate-100">ID Организации и Пользователя</b>: 
                  Отображает уникальные UUID текущей сессии. Полезно для поиска логов в базе данных Supabase.
                </li>
                <li>
                  <b className="text-slate-100 dark:text-slate-100">Кнопка «Copy»</b>: 
                  Копирует технический отчет (JSON) со всеми текущими состояниями приложения для отправки в техподдержку.
                </li>
                <li>
                  <b className="text-slate-100 dark:text-slate-100">Кнопка «Clear Cache»</b>: 
                  Полностью очищает локальное хранилище (localStorage). Помогает, если приложение «зависло» из-за некорректных локальных данных.
                </li>
                <li>
                  <b className="text-slate-100 dark:text-slate-100">Диагностика БД</b>: 
                  Проверяет целостность связей между сотрудниками, должностями и филиалами. Выявляет «сиротские» записи.
                </li>
                <li>
                  <b className="text-slate-100 dark:text-slate-100">Очистка битых логов</b>: 
                  Автоматически удаляет записи о сменах, которые не имеют привязки к существующим пользователям (защита от мусора).
                </li>
                <li>
                  <b className="text-slate-100 dark:text-slate-100">Принудительная очистка $</b>: 
                  Сбрасывает кэшированные расчеты зарплат, заставляя систему пересчитать всё на основе актуальных логов смен.
                </li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/30">
              <h5 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">Как пользоваться:</h5>
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                Используйте инструменты отладки только при возникновении явных несоответствий в данных. 
                Перед использованием «Очистки» рекомендуется скопировать технический отчет кнопкой «Copy».
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'audit',
      title: 'Журнал аудита',
      icon: <Shield className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Логирование действий</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Система фиксирует каждое значимое действие администратора для обеспечения прозрачности и безопасности.
          </p>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Что записывается:</h5>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <li>• <b className="text-slate-900 dark:text-slate-50">Изменение зарплат</b>: Кто, когда и на сколько изменил ставку или сумму выплаты.</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Редактирование смен</b>: Фиксация ручных правок времени входа/выхода.</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Управление доступом</b>: Создание новых админов и изменение их прав.</li>
              <li>• <b className="text-slate-900 dark:text-slate-50">Удаление данных</b>: Любые операции по архивации или удалению объектов.</li>
            </ul>
          </div>
          <p className="text-xs text-slate-400 italic">
            Журнал аудита доступен только пользователям с ролью Владелец или Супер-админ.
          </p>
        </div>
      )
    },
    {
      id: 'tech',
      title: 'Техническая архитектура',
      icon: <Activity className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-slate-50">Синхронизация и Оффлайн-режим</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Приложение использует гибридную модель хранения данных (IndexedDB + Supabase Realtime).
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Механизмы работы:</h5>
              <ul className="text-xs space-y-3 text-slate-600 dark:text-slate-300">
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Оптимистичные обновления</b>: 
                  Когда вы нажимаете кнопку, изменения сначала применяются в локальном кэше, а затем отправляются на сервер. Это обеспечивает мгновенный отклик интерфейса.
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Lazy Cleanup (Серверная очистка)</b>: 
                  Раз в 5 минут система проверяет наличие «зависших» смен (если вкладка была закрыта или пропал интернет). 
                  Если время смены превысило лимит, она закрывается автоматически с пометкой «Auto-close».
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">Realtime Subscriptions</b>: 
                  Изменения, сделанные одним администратором, мгновенно отображаются у других без перезагрузки страницы (используется Supabase Realtime).
                </li>
                <li>
                  <b className="text-slate-900 dark:text-slate-50">PWA (Progressive Web App)</b>: 
                  Приложение можно установить на рабочий стол смартфона. Оно кэширует статические ресурсы, позволяя интерфейсу загружаться даже без интернета.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  const activeSectionData = sections.find(s => s.id === activeSection);

  return (
    <div className="flex flex-col md:flex-row h-full bg-white dark:bg-slate-900 rounded-3xl md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md dark:shadow-slate-900/20 no-print">
      {/* Sidebar / Top Navigation on Mobile */}
      <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col shrink-0">
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Инструкция
          </h2>
          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Документация системы</p>
        </div>

        {/* Mobile Dropdown */}
        <div className="md:hidden p-4">
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-blue-600 dark:text-blue-400">{activeSectionData?.icon}</span>
                {activeSectionData?.title}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                        activeSection === section.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className={activeSection === section.id ? 'text-white' : 'text-slate-400 dark:text-slate-500'}>
                        {section.icon}
                      </span>
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Sidebar Nav */}
        <nav className="hidden md:flex flex-col p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white shadow-xl dark:shadow-slate-900/20 shadow-blue-100'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
              }`}
            >
              {section.icon}
              {section.title}
              {activeSection === section.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          <div className="hidden md:block mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-3">
              {activeSectionData?.icon}
              {activeSectionData?.title}
            </h3>
          </div>
          
          {activeSectionData?.content}
          
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 md:p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl md:rounded-[2rem] border border-blue-100 dark:border-blue-800/30">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-md dark:shadow-slate-900/20 shrink-0">
                <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h5 className="font-bold text-blue-900 dark:text-blue-100 text-sm md:text-base">Нужна помощь?</h5>
                <p className="text-[11px] md:text-xs text-blue-700 dark:text-blue-300">Если вы не нашли ответ на свой вопрос, обратитесь в чат поддержки или к вашему персональному менеджеру.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
