import { Activity, Grid3X3, Calculator, CalendarOff } from 'lucide-react';

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  // Placeholder for a screenshot or component preview
  preview: string; 
}

export const features: Feature[] = [
  {
    id: 'monitoring',
    title: 'Мониторинг смен',
    description: 'Отслеживайте активность сотрудников в реальном времени. Визуальная панель показывает, кто сейчас на смене, на каком оборудовании работает и текущий статус выполнения задач.',
    icon: Activity,
    preview: 'https://picsum.photos/seed/monitoring/800/600'
  },
  {
    id: 'matrix',
    title: 'Матрица сотрудников',
    description: 'Управляйте расписанием через интерактивную матрицу. Быстрое переключение между сотрудниками, назначение смен и контроль загрузки персонала в едином окне.',
    icon: Grid3X3,
    preview: 'https://picsum.photos/seed/matrix/800/600'
  },
  {
    id: 'payroll',
    title: 'Автоматизация зарплаты',
    description: 'Забудьте о ручных расчетах. Система автоматически учитывает отработанные часы, ночные смены, переработки и штрафы согласно настроенным правилам организации.',
    icon: Calculator,
    preview: 'https://picsum.photos/seed/payroll/800/600'
  },
  {
    id: 'absence',
    title: 'Учет отсутствий',
    description: 'Полный контроль за посещаемостью. Фиксируйте больничные, отпуска и прогулы, с автоматическим обновлением графиков и расчетов заработной платы.',
    icon: CalendarOff,
    preview: 'https://picsum.photos/seed/absence/800/600'
  }
];
