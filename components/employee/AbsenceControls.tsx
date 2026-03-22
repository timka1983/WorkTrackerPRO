import React, { memo } from 'react';
import { EntryType } from '../../types';

interface AbsenceControlsProps {
  isAbsentToday: boolean;
  handleMarkAbsence: (type: EntryType) => void;
  isPaid?: boolean;
}

export const AbsenceControls = memo<AbsenceControlsProps>(({ isAbsentToday, handleMarkAbsence, isPaid }) => {
  return (
    <section className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 no-print transition-colors">
      <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-6">Отметить особый статус дня</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <button disabled={isAbsentToday || isPaid} onClick={() => {
          if (isPaid) { alert('Финансовый период закрыт. Изменение данных заблокировано.'); return; }
          handleMarkAbsence(EntryType.DAY_OFF);
        }} className="py-5 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl text-xs font-black text-blue-700 dark:text-blue-400 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white hover:border-blue-600 dark:hover:border-blue-600 transition-all shadow-md dark:shadow-slate-900/20 uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Выходной (В)</button>
        <button disabled={isAbsentToday || isPaid} onClick={() => {
          if (isPaid) { alert('Финансовый период закрыт. Изменение данных заблокировано.'); return; }
          handleMarkAbsence(EntryType.SICK);
        }} className="py-5 bg-red-50 dark:bg-red-900/20 border-2 border-red-100 dark:border-red-900/30 rounded-2xl text-xs font-black text-red-700 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white hover:border-red-600 dark:hover:border-red-600 transition-all shadow-md dark:shadow-slate-900/20 uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Больничный (Б)</button>
        <button disabled={isAbsentToday || isPaid} onClick={() => {
          if (isPaid) { alert('Финансовый период закрыт. Изменение данных заблокировано.'); return; }
          handleMarkAbsence(EntryType.VACATION);
        }} className="py-5 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-100 dark:border-purple-900/30 rounded-2xl text-xs font-black text-purple-700 dark:text-purple-400 hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white hover:border-purple-600 dark:hover:border-purple-600 transition-all shadow-md dark:shadow-slate-900/20 uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Отпуск (О)</button>
      </div>
    </section>
  );
});
