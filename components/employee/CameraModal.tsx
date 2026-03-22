import React, { memo } from 'react';

interface CameraModalProps {
  showCamera: { slot: number; type: 'start' | 'stop'; location?: any } | null;
  setShowCamera: (val: any) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isUploadingPhoto: boolean;
  onCapture: () => void;
  onCancel?: () => void;
}

export const CameraModal = memo<CameraModalProps>(({
  showCamera,
  setShowCamera,
  videoRef,
  isUploadingPhoto,
  onCapture,
  onCancel
}) => {
  if (!showCamera) return null;

  const handleCancel = () => {
    if (onCancel) onCancel();
    else setShowCamera(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
       <div className="bg-white dark:bg-slate-800 p-2 rounded-[2.5rem] shadow-2xl dark:shadow-slate-900/40 overflow-hidden mb-8 border-4 border-blue-600 dark:border-blue-500">
         <video ref={videoRef} autoPlay playsInline className="w-full max-sm rounded-[2rem] aspect-square object-cover" />
       </div>
       <h3 className="text-white text-xl font-black uppercase tracking-widest mb-2">Фотофиксация</h3>
       <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-8">
         {showCamera.type === 'start' ? 'Начало смены' : 'Завершение смены'}
       </p>
       <div className="flex gap-4">
          <button 
            onClick={handleCancel}
            className="px-8 py-4 bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/20 hover:bg-white/20 transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={onCapture}
            disabled={isUploadingPhoto}
            className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl dark:shadow-slate-900/20 shadow-blue-500/20 dark:shadow-blue-900/40 disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {isUploadingPhoto ? 'Сохранение...' : 'Сфотографировать'}
          </button>
       </div>
    </div>
  );
});
