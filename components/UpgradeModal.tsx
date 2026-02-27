import React from 'react';

interface UpgradeModalProps {
  reason: string | null;
  onClose: () => void;
  onUpgrade: () => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ reason, onClose, onUpgrade }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 w-full max-w-sm border border-slate-200 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-50">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Обновите тариф</h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{reason}</p>
        </div>
        <div className="space-y-3">
          <button 
            onClick={onUpgrade}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
          >
            Посмотреть тарифы
          </button>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
