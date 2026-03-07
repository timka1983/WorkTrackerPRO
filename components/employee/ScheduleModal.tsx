import React, { useState, useMemo } from 'react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, subMonths, addMonths } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { User, WorkLog, EntryType } from '../../types';
import { X, Calendar as CalendarIcon, Wand2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDurationShort } from '../../utils';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (user: User) => void;
  currentMonth: string;
  setFilterMonth: (month: string) => void;
  onMonthChange?: (month: string) => void;
  readOnly?: boolean;
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
}

type ShiftType = 'Р' | 'В' | 'Д' | 'О' | 'Н';

const SHIFT_COLORS = {
  'Р': 'bg-blue-100 text-blue-700',
  'В': 'bg-slate-100 text-slate-500',
  'Д': 'bg-amber-100 text-amber-700',
  'О': 'bg-purple-100 text-purple-700',
  'Н': 'bg-indigo-100 text-indigo-700',
};

const SHIFT_LABELS = {
  'Р': 'Работа',
  'В': 'Выходной',
  'Д': 'День',
  'О': 'Отпуск',
  'Н': 'Ночь',
};

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  currentMonth,
  setFilterMonth,
  onMonthChange,
  readOnly = false,
  logsLookup = {}
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pattern, setPattern] = useState<ShiftType[]>([]);
  const [patternStartDate, setPatternStartDate] = useState<Date>(new Date());
  
  const monthStart = startOfMonth(new Date(currentMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);
  
  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  if (!isOpen) return null;

  const handleDayClick = (day: Date, currentShift?: ShiftType) => {
    if (readOnly) return;
    setSelectedDate(day);
    
    // Cycle shift
    const cycle = ['', 'Р', 'В', 'Д', 'О', 'Н'];
    const currentVal = currentShift || '';
    const nextIdx = (cycle.indexOf(currentVal) + 1) % cycle.length;
    const nextVal = cycle[nextIdx];
    
    const dateStr = format(day, 'yyyy-MM-dd');
    const newPlannedShifts = { ...(user.plannedShifts || {}) };
    
    if (nextVal === '') {
      delete newPlannedShifts[dateStr];
    } else {
      newPlannedShifts[dateStr] = nextVal as ShiftType;
    }
    
    onUpdateUser({ ...user, plannedShifts: newPlannedShifts });
  };

  const handlePrevMonth = () => {
    const prev = subMonths(monthStart, 1);
    const val = format(prev, 'yyyy-MM');
    setFilterMonth(val);
    if (onMonthChange) onMonthChange(val);
  };

  const handleNextMonth = () => {
    const next = addMonths(monthStart, 1);
    const val = format(next, 'yyyy-MM');
    setFilterMonth(val);
    if (onMonthChange) onMonthChange(val);
  };

  const handleSetShift = (shift: ShiftType | null) => {
    if (readOnly) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const newPlannedShifts = { ...(user.plannedShifts || {}) };
    
    if (shift === null) {
      delete newPlannedShifts[dateStr];
    } else {
      newPlannedShifts[dateStr] = shift;
    }
    
    onUpdateUser({ ...user, plannedShifts: newPlannedShifts });
  };

  const handleApplyPattern = () => {
    if (readOnly || pattern.length === 0) return;
    
    const newPlannedShifts = { ...(user.plannedShifts || {}) };
    let currentDate = patternStartDate;
    
    // Apply pattern for the next 3 months to be safe
    const endDate = addDays(patternStartDate, 90);
    
    let patternIndex = 0;
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const shift = pattern[patternIndex];
      
      if (shift === 'В') {
        delete newPlannedShifts[dateStr];
      } else {
        newPlannedShifts[dateStr] = shift;
      }
      
      currentDate = addDays(currentDate, 1);
      patternIndex = (patternIndex + 1) % pattern.length;
    }
    
    onUpdateUser({ ...user, plannedShifts: newPlannedShifts });
    setPattern([]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 rounded-t-3xl">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-500" />
            {readOnly ? 'График работы' : 'Составьте график'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Calendar View */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-slate-700 capitalize">{format(monthStart, 'LLLL yyyy', { locale: ru })}</h3>
              <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const logs = logsLookup?.[user.id]?.[dateStr] || [];
                const workLogs = logs.filter(l => l.entryType === EntryType.WORK);
                
                // Находим время по лучшему станку за смену (группируем по machineId)
                const machineDurations: Record<string, number> = {};
                workLogs.forEach(log => {
                  const mId = log.machineId || 'no-machine';
                  machineDurations[mId] = (machineDurations[mId] || 0) + log.durationMinutes;
                });
                
                const bestMachineMinutes = Object.values(machineDurations).length > 0 
                  ? Math.max(...Object.values(machineDurations)) 
                  : 0;

                const shift = readOnly ? (bestMachineMinutes > 0 ? 'Р' : undefined) : (user.plannedShifts?.[dateStr] as ShiftType | undefined);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isSelected = isSameDay(day, selectedDate);
                
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day, shift)}
                    className={`
                      aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
                      ${!isCurrentMonth ? 'opacity-30' : ''}
                      ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:bg-slate-50'}
                      ${shift ? SHIFT_COLORS[shift] : 'bg-slate-50'}
                      ${readOnly ? 'cursor-default' : ''}
                    `}
                  >
                    <span className={`text-sm font-bold ${shift ? '' : 'text-slate-600'}`}>
                      {format(day, 'd')}
                    </span>
                    {shift && (
                      <span className="text-[10px] font-black mt-0.5">
                        {readOnly ? formatDurationShort(bestMachineMinutes) : shift}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!readOnly && (
            <>
              {/* Single Day Edit */}
              <div className="mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Смена на {format(selectedDate, 'd MMMM', { locale: ru })}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(SHIFT_LABELS) as ShiftType[]).map(shift => (
                    <button
                      key={shift}
                      onClick={() => handleSetShift(shift)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${SHIFT_COLORS[shift]} hover:opacity-80`}
                    >
                      {SHIFT_LABELS[shift]}
                    </button>
                  ))}
                  <button
                    onClick={() => handleSetShift(null)}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Очистить
                  </button>
                </div>
              </div>

              {/* Pattern Builder */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Автоматическое заполнение
                </h4>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Начать с даты:</label>
                    <input 
                      type="date" 
                      value={format(patternStartDate, 'yyyy-MM-dd')}
                      onChange={(e) => setPatternStartDate(new Date(e.target.value))}
                      className="w-full p-2 rounded-xl border border-slate-200 text-sm font-bold"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Шаблон (добавьте смены по порядку):</label>
                    <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 bg-white rounded-xl border border-slate-200 items-center">
                      {pattern.length === 0 ? (
                        <span className="text-xs text-slate-400 font-medium px-2">Шаблон пуст</span>
                      ) : (
                        pattern.map((shift, idx) => (
                          <div key={idx} className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${SHIFT_COLORS[shift]}`}>
                            {shift}
                          </div>
                        ))
                      )}
                      {pattern.length > 0 && (
                        <button 
                          onClick={() => setPattern([])}
                          className="ml-auto p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Очистить шаблон"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(SHIFT_LABELS) as ShiftType[]).map(shift => (
                        <button
                          key={shift}
                          onClick={() => setPattern([...pattern, shift])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${SHIFT_COLORS[shift]} hover:opacity-80`}
                        >
                          + {shift}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Predefined patterns */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Или выберите готовый:</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setPattern(['Д', 'Д', 'В', 'В'])} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">2/2 (День)</button>
                      <button onClick={() => setPattern(['Д', 'Н', 'В', 'В'])} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">День/Ночь/2В</button>
                      <button onClick={() => setPattern(['Д', 'Д', 'Д', 'В', 'В', 'В'])} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">3/3</button>
                      <button onClick={() => setPattern(['Р', 'Р', 'Р', 'Р', 'Р', 'В', 'В'])} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">5/2</button>
                    </div>
                  </div>

                  <button 
                    onClick={handleApplyPattern}
                    disabled={pattern.length === 0}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Применить шаблон на 3 месяца
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
