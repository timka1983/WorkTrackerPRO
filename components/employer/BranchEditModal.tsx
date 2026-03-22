import React, { useState, useEffect } from 'react';
import { Branch } from '../../types';

interface BranchEditModalProps {
  editingBranch: Branch | null;
  setEditingBranch: (branch: Branch | null) => void;
  onSave: (branch: Branch) => void;
}

export const BranchEditModal: React.FC<BranchEditModalProps> = ({
  editingBranch,
  setEditingBranch,
  onSave
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [radius, setRadius] = useState<number>(100);

  useEffect(() => {
    if (editingBranch) {
      setName(editingBranch.name);
      setAddress(editingBranch.address || '');
      setLatitude(editingBranch.locationSettings?.latitude || 0);
      setLongitude(editingBranch.locationSettings?.longitude || 0);
      setRadius(editingBranch.locationSettings?.radius || 100);
    } else {
      setName('');
      setAddress('');
      setLatitude(0);
      setLongitude(0);
      setRadius(100);
    }
  }, [editingBranch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    const updatedBranch: Branch = {
      ...editingBranch,
      name,
      address,
      locationSettings: {
        enabled: true,
        latitude,
        longitude,
        radius
      }
    };
    onSave(updatedBranch);
    setEditingBranch(null);
  };

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (error) => alert('Ошибка получения геопозиции: ' + error.message)
      );
    } else {
      alert('Геолокация не поддерживается');
    }
  };

  if (!editingBranch) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl dark:shadow-slate-900/40 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            {editingBranch.id ? 'Редактировать филиал' : 'Новый филиал'}
          </h3>
          <button onClick={() => setEditingBranch(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Название филиала</label>
              <input 
                required
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all shadow-sm dark:shadow-none"
                placeholder="Например: Центральный офис"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Адрес</label>
              <input 
                type="text" 
                value={address} 
                onChange={e => setAddress(e.target.value)}
                className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all shadow-sm dark:shadow-none"
                placeholder="г. Москва, ул. Ленина, 1"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Геолокация филиала
              </h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Широта</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    value={latitude}
                    onChange={e => setLatitude(parseFloat(e.target.value))}
                    className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Долгота</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    value={longitude}
                    onChange={e => setLongitude(parseFloat(e.target.value))}
                    className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Радиус (метров)</label>
                <input 
                  type="number" 
                  value={radius}
                  onChange={e => setRadius(parseInt(e.target.value))}
                  className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                />
              </div>

              <button 
                type="button"
                onClick={handleGetCurrentLocation}
                className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Взять текущие координаты
              </button>
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button 
              type="button" 
              onClick={() => setEditingBranch(null)}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-2xl dark:shadow-slate-900/20 shadow-blue-200 dark:shadow-none"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
