import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Archive, Trash2, Calendar, MessageSquare, User, Settings, RotateCcw } from 'lucide-react';
import { User as UserType, Machine } from '../../types';

interface ArchiveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  itemName: string;
}

export const ArchiveConfirmModal: React.FC<ArchiveConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl dark:shadow-slate-900/40 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Archive size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Вы уверены, что хотите архивировать {itemName}?</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Причина (необязательно)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Укажите причину удаления..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-amber-500 focus:ring-0 transition-all resize-none h-24"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Отмена
            </button>
            <button
              onClick={() => onConfirm(reason)}
              className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl dark:shadow-slate-900/20 shadow-amber-100 hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
            >
              <Archive size={16} />
              Архивировать
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface ArchiveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'users' | 'machines';
  getArchivedItems: () => Promise<any[] | null>;
  onRestore: (id: string) => Promise<{ error: any }>;
}

export const ArchiveViewModal: React.FC<ArchiveViewModalProps> = ({
  isOpen,
  onClose,
  type,
  getArchivedItems,
  onRestore
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    const data = await getArchivedItems();
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen]);

  const handleRestore = async (id: string) => {
    if (confirm(`Вы уверены, что хотите восстановить этот объект?`)) {
      setRestoringId(id);
      const { error } = await onRestore(id);
      if (error) {
        alert('Ошибка при восстановлении: ' + (error.message || error));
      } else {
        await loadItems();
      }
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl dark:shadow-slate-900/40 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Archive size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">
                Архив {type === 'users' ? 'сотрудников' : 'оборудования'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                История удаленных объектов (очистка невозможна)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-md dark:shadow-slate-900/20"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка архива...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3">
              <Archive size={48} strokeWidth={1} />
              <p className="text-sm font-bold uppercase tracking-widest">Архив пуст</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-50 transition-colors">
                        {type === 'users' ? <User size={18} /> : <Settings size={18} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar size={10} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {item.archivedAt ? new Date(item.archivedAt).toLocaleString('ru-RU') : 'Дата неизвестна'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {type === 'users' && (
                        <span className="text-[9px] font-black px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                          {item.position}
                        </span>
                      )}
                      <button
                        onClick={() => handleRestore(item.id)}
                        disabled={restoringId === item.id}
                        className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all disabled:opacity-50"
                        title="Восстановить"
                      >
                        <RotateCcw size={16} className={restoringId === item.id ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <MessageSquare size={12} className="text-slate-300 dark:text-slate-600 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Причина удаления:</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 italic">
                        {item.archiveReason || 'Причина не указана'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
