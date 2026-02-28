import React, { memo } from 'react';
import { EntryType } from '../../types';

interface AbsenceControlsProps {
  isAbsentToday: boolean;
  handleMarkAbsence: (type: EntryType) => void;
}

export const AbsenceControls = memo<AbsenceControlsProps>(({ isAbsentToday, handleMarkAbsence }) => {
  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Отметить особый статус дня</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <button disabled={isAbsentToday} onClick={() => handleMarkAbsence(EntryType.DAY_OFF)} className="py-5 bg-blue-50 border-2 border-blue-100 rounded-2xl text-xs font-black text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Выходной (В)</button>
        <button disabled={isAbsentToday} onClick={() => handleMarkAbsence(EntryType.SICK)} className="py-5 bg-red-50 border-2 border-red-100 rounded-2xl text-xs font-black text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Больничный (Б)</button>
        <button disabled={isAbsentToday} onClick={() => handleMarkAbsence(EntryType.VACATION)} className="py-5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-xs font-black text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all shadow-sm uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Отпуск (О)</button>
      </div>
    </section>
  );
});
